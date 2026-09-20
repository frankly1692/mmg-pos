from flask import Blueprint, g, request
from pydash import merge, omit, pick

from app.database.config import cashier_reports
from app.utils.compare_date import compare_date_year_month, compare_date_range, compare_date_today
from app.utils.utils import ToStringId
from app.filters.date_filter import DateFilter


get_cashier_reports = Blueprint("/cashier-reports", __name__)

@get_cashier_reports.route('/cashier-reports', methods=['GET'])
def _get_cashier_reports():
     try:
          query = request.args.to_dict()
          filters = pick(query, ['dateFilter', 'customDate', 'startDate', 'endDate'])
          query = omit(query, ['dateFilter', 'customDate', 'startDate', 'endDate'])

          reports = cashier_reports.aggregate([
              { '$match': query },
              {
                    # onError/onNull: null — a corrupt/test-seeded id that isn't a valid 24-hex-char
                    # ObjectId string would otherwise throw and fail this aggregation for every
                    # report, not just the offending document (see app/repositories/cashier_report.py
                    # for the same fix on the v2 route).
                    "$addFields": {
                         "cashierId": {"$convert": {"input": "$cashierId", "to": "objectId", "onError": None, "onNull": None}},
                         "branchId": {"$convert": {"input": "$branchId", "to": "objectId", "onError": None, "onNull": None}}
                    }
               },
              { 
                    '$lookup': {
                         'from': 'users',
                         'localField': 'cashierId',
                         'foreignField': '_id',
                         'as': 'cashier'
                    }, 
               },
               { "$unwind": "$cashier" },
               { 
                    '$lookup': {
                        'from': 'branches',
                        'localField': 'branchId',
                        'foreignField': '_id',
                        'as': 'branch'
                    }, 
               },
               { "$unwind": "$branch" },
               {
                    "$lookup": {
                         "from": "sales",
                         "let": {
                              "branchId": "$branchId",
                              "cashierId": "$cashierId",
                              "date": "$date"
                         },
                         "pipeline": [
                              {
                                   "$match": {
                                        "$expr": {
                                             "$and": [
                                                  { "$eq": ["$branch", "$$branchId"] },
                                                  { "$eq": ["$cashierId", "$$cashierId"] },
                                                  { "$eq": ["$date", "$$date"] }
                                             ]
                                        }
                                   }
                              },
                              {
                                   "$group": {
                                        "_id": "$cashierId",
                                        "total": { "$sum": "$amount" }
                                   }
                              },
                         ],
                         "as": "sales"
                    }
               },
               {
                    "$addFields": {
                         "id": { "$toString": "$_id" },
                         "cashSales": { 
                              "$cond": [
                                   { "$gt": [ { "$size": "$sales" }, 0 ] },
                                   { "$arrayElemAt": ["$sales", 0] },
                                   None
                              ]
                         },
                         "cashier.name": {
                              "$concat": [
                                   "$cashier.first_name",
                                   " ",
                                   "$cashier.last_name"
                              ]
                         }
                    }
               },
               {
                   '$project': {
                         'cashierId': 0,
                         'branchId': 0,
                         'sales': 0,
                         'cashier': {
                              'password': 0,
                              'branches': 0
                         }
                   }
               },
               { "$sort": { "_id": -1 }}
          ])

          dateFilter = DateFilter.TODAY
          if(filters.get('dateFilter') is not None):
               dateFilter = int(filters.get('dateFilter'))

          report_list = []
          for report in reports:
               date = report['date']

               if(dateFilter != DateFilter.ALL):

                    if(dateFilter == DateFilter.CUSTOM_DATE and not compare_date_year_month(date, filters.get('customDate'))):
                         continue
                    if(dateFilter == DateFilter.CUSTOM_FILTER and not compare_date_range(date, filters.get('startDate'),  filters.get('endDate'))):
                         continue
                    if(dateFilter < 9 and not compare_date_today(dateFilter, date)):
                         continue
               
               report = ToStringId(report)
               report['branch'] = ToStringId(report['branch'])
               report['cashier'] = ToStringId(report['cashier'])
               report['cashGain'] = None
               report['cashLoss'] = None

               cashSales = report['cashSales']['total'] if report['cashSales'] is not None else 0
               cashOnHand = report['endingCashOnHand']['total'] if report['endingCashOnHand'] is not None else 0
               
               difference = cashSales - cashOnHand
               report['cashGain'] = difference if difference > 0 else 0
               report['cashLoss'] = difference * -1 if difference < 0 else 0

               if(report['cashSales'] is not None):
                    report['cashSales'] = report['cashSales']['total']

               report_list.append(report)

          return { 'data': report_list, }, 200
     except Exception as e:
      return {
            'message': 'Unable to get cashier reports.',
            'error': repr(e),
         }, 500