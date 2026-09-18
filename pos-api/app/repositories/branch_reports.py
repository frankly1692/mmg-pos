


from datetime import datetime, timedelta
from itertools import groupby

from pydash import get
from app.filters.date_filter import DateFilter, compare_date_filter
from app.new_models.CashierReport import CashierReport
from app.new_models.Transaction import TenderType, TransactionStatus
from app.repositories.base import BackupRepository
from app.repositories.cashier_report import CashierReportRepository
from app.repositories.report_cash_count import CashCountRepository
from app.repositories.transaction import TransactionRepository
from app.new_models.CashCount import _cash_keys, CashCount
from app.utils.utils import getLocalDateStr, getLocalTime
import json

class BranchReportRepository(BackupRepository):
    _collection = 'branch_reports'
    _transaction_collection = TransactionRepository()._collection
    _cashier_report_collection = CashierReportRepository()._collection
    _cash_count_collection = CashCountRepository()._collection

    _defaultFilter = {
                "$match": {
                    "$expr": {
                        "$and": [
                            { "$eq": ["$branchId", "$$branchId"] },
                            { "$eq": ["$date", "$$date"] },
                        ]
                    }
                }
            }


    def find(self, query={}, *args):
     
        try:
            data = list(self._db[self._transaction_collection].aggregate([
                { '$match': query },
                { '$match': { "status": { "$in": [TransactionStatus.COMPLETED, TransactionStatus.REFUNDED] } } },
                {
                    "$group": {
                        "_id": { "branchId": "$branchId", "date": "$date"  },
                        'date': { '$first': '$date' },
                        'branchId': { '$first': '$branchId' },
                        "totalGrossSales": { "$sum": "$totalGrossSales" },
                        "totalNetSales": { "$sum": "$totalNetSales" },
                        "totalDiscount": { "$sum": "$totalDiscount" },
                        "totalSalesWithoutMemberDiscount": { "$sum": '$totalSalesWithoutMemberDiscount' } ,
                        "totalMemberDiscount": { "$sum": '$totalMemberDiscount' } ,
                        "invoiceStartNumber": { '$min': "$invoiceNumber" },
                        "invoiceEndNumber": { '$max': "$invoiceNumber" }
                    }
                },
                *self._create_branch_query(),
                *self._create_cash_count_query("openingFund", "opening"),
                *self._create_cash_count_query("endingCashCount", "ending"),
                *self._create_serial_number_range_query("cancelledNumber", TransactionStatus.CANCELLED),
                *self._create_serial_number_range_query("refundedNumber", TransactionStatus.REFUNDED),
                
                *self._create_cashier_report_query(),
                *self._create_branch_report_query(),
                # *self._create_net_sales_query("previousAccumulatedSales", False),
                # *self._create_net_sales_query("presentAccumulatedSales"),
                {
                    "$lookup": {
                        "from": self._transaction_collection,
                        "let": {
                            "branchId": "$branchId",
                            "date": "$date"
                        },
                        "pipeline": [
                            self._defaultFilter,
                            {
                                "$addFields": {
                                    "_id": { "$toString": "$_id" },
                                }
                            }
                        ],
                        "as": "transactions"
                    }
                },
                {
                    "$lookup": {
                        "from": 'transaction_discounts',
                        "let": {
                            "branchId": "$branchId",
                            "date": "$date"
                        },
                        "pipeline": [
                            self._defaultFilter,
                            {
                                "$addFields": {
                                    "transactionId": {"$toObjectId": "$transactionId"}
                                }
                            },
                            { 
                                '$lookup': {
                                    'from': self._transaction_collection,
                                    'localField': 'transactionId',
                                    'foreignField': '_id',
                                    'as': 'transaction'
                                }, 
                            },
                            { "$unwind": "$transaction" },
                            {
                                '$project': {
                                    "_id": 0,
                                    "transactionId": 0,
                                }
                            },
                        ],
                        "as": "discounts"
                    }
                },
                { "$sort": { "date": 1 }},
                {
                    '$project': {
                        "_id": 0,
                        'branchId': 0,
                        "discounts._id": 0,
                        "discounts.transaction._id": 0,
                        "discounts.transaction.transactionId": 0,
                        "discounts.transaction.transactionItems": 0,
                        "transactions._id": 0,
                        "transactions.transactionItems": 0,
                    }
                },
                {
                    "$addFields": {
                        "branch._id": { "$toString": "$branch._id" },
                    }
                }
            ]))

            reports = []
            for index, item in enumerate(data):
                discountSummary = {}
                discounts = filter(lambda i: i['memberType'] is not None, item['discounts'])
                for key, value in groupby(discounts, lambda i: i['memberType']):
                    total = sum(map(lambda i: i['transaction']['totalMemberDiscount'], value))
                    total += discountSummary.get(key, 0)
                    discountSummary[key] = total
                item['discountSummary'] = discountSummary


                salesAdjustment = {}
                transactions = filter(lambda i: i['totalNetSales'] > 0, item['transactions'])
                for key, value in groupby(transactions, lambda i: i['status']):
                    total = sum(map(lambda i: i['totalNetSales'], value))
                    total += salesAdjustment.get(key, 0)
                    salesAdjustment[key] = total
                item['salesAdjustment'] = salesAdjustment

                transactions = filter(lambda i: i['status'] == TransactionStatus.COMPLETED and get(i, 'tender.type') != TenderType.CASH, item['transactions'])
                item['totalPayments'] = sum(map(lambda i: i['tender']['amount'], transactions))
                item['totalPayments'] += get(item, 'endingCashCount.total', 0)
                
                openingFundTotal = get(item, 'openingFund.total', 0)
                difference = item['totalPayments'] - openingFundTotal - item['totalNetSales']
                item['cashDifference'] = difference

                item['totalPayments'] -= get(item, 'cashierReport.withdraw', 0)

                transactionSummary = {}
                transactions = filter(lambda i: get(i, 'tender.type') is not None and i['status'] == 'completed', item['transactions'])
                for key, value in groupby(transactions, lambda i: get(i, 'tender.type')):
                    total = sum(map(lambda i: i['totalNetSales'], value))
                    total += transactionSummary.get(key, 0)
                    transactionSummary[key] = total
                item['transactionSummary'] = transactionSummary

                item['presentAccumulatedSales'] = self.calculate_accumulated_sales(item['branch']['_id'], datetime.strptime(item['date'], '%Y-%m-%d'), True)
                item['previousAccumulatedSales'] = self.calculate_accumulated_sales(item['branch']['_id'], datetime.strptime(item['date'], '%Y-%m-%d'), False)

                # item['presentAccumulatedSales'] = get(item, 'presentAccumulatedSales.totalSales', 0)
                # item['previousAccumulatedSales'] = get(item, 'previousAccumulatedSales.totalSales', 0)         
                item['zCounter'] = index + 1

                reports.append(item)
            return reports
        except Exception as e:
            raise e

    def find_by_date_and(self, date_filter: DateFilter, start_date=None, end_date=None, custom_date=None, query={}):
        reports = self.find(query)

        if(date_filter == DateFilter.CUSTOM_DATE and custom_date is None):
            return []
        
        if(date_filter == DateFilter.CUSTOM_FILTER and start_date is None and end_date is None):
            return []


        filtered_reports = [
            report for report in reports 
            if compare_date_filter(
                date_filter, 
                report['date'],
                custom_date,
                start_date,
                end_date
            )
        ]

        return filtered_reports

    def calculate_accumulated_sales(self, branchId: str, date: datetime, present: bool = True):
        queryDate = date if present else (date - timedelta(days=1))

        try:
            data = list(self._db[self._transaction_collection].aggregate([
                { 
                    '$match': { 
                        "branchId": { "$eq": branchId },
                        "status": { "$in": [TransactionStatus.COMPLETED, TransactionStatus.REFUNDED] },
                        "date": { "$lte": str(queryDate.date()) }
                    } 
                },
                {
                    "$group": {
                        "_id": None,
                        'date': { '$first': '$date' },
                        'branchId': { '$first': '$branchId' },
                        "totalNetSales": { "$sum": "$totalNetSales" },
                    }
                },
            ]))
            # print(f"Data: {json.dumps(data, indent=2)}")
            if(len(data) != 0):
                return data[0]['totalNetSales']
            return 0
        except Exception as e:
            raise e

    def _create_branch_query(self): 
        return [
            {
                    "$addFields": {
                        "branchId": {"$toObjectId": "$branchId"}
                    }
                },
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
                    "$addFields": {
                        "branchId": {"$toString": "$branchId"}
                    }
                }
        ]
    
    def _create_net_sales_query(self, name, present: bool = True):
        startDate = getLocalTime().replace(day=1)
        endDate = getLocalTime()

        if(not present):
            endDate = (endDate - timedelta(days=1))
        
        # typeQuery = [
        #     {  "$gte": [ "$date", str(startDate.date()) ] },
        #     {  "$lte": [ "$date", str(endDate.date()) ] },
        # ]
        return [
            {
                "$lookup": {
                    "from": self._transaction_collection,
                    "let": {
                        "branchId": "$branchId",
                        "date": "$date"
                    },
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$and": [
                                        *self._defaultFilter['$match']['$expr']['$and'],
                                        { "$eq": ["$status", TransactionStatus.COMPLETED] },
                                        { "$lte": [ "$date", "$$date" ] },
                                        # { "$gte": [ "$date", str(startDate.date()) ] },
                                    ],
                                }
                            }
                        },
                        {
                            "$group": {
                                "_id": None,
                                "totalSales": { "$sum": "$totalNetSales" }
                            }
                        },
                        {
                            "$project": {
                                "_id": 0
                            }
                        }
                    ],
                    "as": name
                }
            },
             { "$unwind": {
                'path': f"${name}",
                'preserveNullAndEmptyArrays': True    
            }}
        ]

    def _create_branch_report_query(self):
        now = getLocalDateStr()

        return [
            {
                "$lookup": {
                    "from": self._collection,
                    "let": {
                        "branchId": "$branchId",
                    },
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$and": [
                                        { "$eq": ["$branchId", "$$branchId"] },
                                        { "$lt": [ "date", now ] }
                                    ]
                                }
                            }
                        },
                        { "$sort": { "_id": -1 } },
                        { "$limit": 1 },
                        {
                            "$project": {
                                "_id": 0
                            }
                        }
                    ],
                    "as": "branchReport"
                }
            },
            { "$unwind": {
                'path': "$branchReport",
                'preserveNullAndEmptyArrays': True    
            }}
        ]

    def _create_serial_number_range_query(self, name, type):
        return [
            {
                    "$lookup": {
                        "from": self._transaction_collection,
                        "let": {
                            "branchId": "$branchId",
                            "date": "$date"
                        },
                        "pipeline": [
                            {
                                "$match": {
                                    "$expr": {
                                        "$and": [
                                            { "$eq": ["$branchId", "$$branchId"] },
                                            { "$eq": ["$date", "$$date"] },
                                            {"$eq": ["$status", type]}
                                        ]
                                    }
                                }
                            },
                           { 
                                '$group': {
                                    "_id": None,
                                    "beginning": { "$min": "$serialNumber" },
                                    "ending": { "$max": "$serialNumber" },
                                }
                            },
                        ],
                        "as": name
                    }
                },
                { "$unwind": {
                    'path': f"${name}",
                    'preserveNullAndEmptyArrays': True    
                }},
        ]
    
    def _create_cashier_report_query(self, name = "cashierReport"):
        return [
            {
                    "$lookup": {
                        "from": self._cashier_report_collection,
                        "let": {
                            "branchId": "$branchId",
                            "date": "$date"
                        },
                        "pipeline": [
                            self._defaultFilter,
                           { 
                                '$group': {
                                    "_id": None,
                                    "timeIn": { "$min": "$serialNumber" },
                                    "timeOut": { "$max": "$serialNumber" },
                                    "withdraw": { "$sum": "$withdraw" },
                                }
                            },
                        ],
                        "as": name
                    }
                },
                { "$unwind": {
                    'path': f"${name}",
                    'preserveNullAndEmptyArrays': True    
                }},
        ]

    def _create_cash_count_query(self, name, type):

        cashCountScript = [{ CashCount.formatKey(key): { "$sum": f'${CashCount.formatKey(key)}' } } for key in _cash_keys]
        cashCountQuery = {}
        for item in cashCountScript:
            cashCountQuery.update(item)

        return [
            {
                "$lookup": {
                    "from": self._cash_count_collection,
                        "let": {
                        "branchId": "$branchId",
                        "date": "$date"
                    },
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$and": [
                                        { "$eq": ["$branchId", "$$branchId"] },
                                        { "$eq": ["$date", "$$date"] },
                                        { "$eq": ["$type", type] },
                                    ]
                                }
                            }
                        },
                        { 
                            '$group': {
                                "_id": None,
                                **cashCountQuery,
                                "total": { '$sum': "$total" },
                            }
                        },
                    ],
                    "as": name
                }
            },
            { "$unwind": {
                'path': f"${name}",
                'preserveNullAndEmptyArrays': True    
            }},
        ]