


from itertools import groupby

from pydash import get
from app.filters.date_filter import DateFilter, compare_date_filter
from app.new_models.CashierReport import CashierReport
from app.new_models.Transaction import TenderType, TransactionStatus
from app.repositories.base import BackupRepository, Repository
from app.repositories.report_cash_count import CashCountRepository
from app.repositories.transaction import TransactionRepository
from app.repositories.transaction_discount import TransactionDiscountRepository

class CashierReportRepository(Repository):
    _collection = 'cashier_reports'
    _transaction_collection = TransactionRepository()._collection
    _cash_count_collection = CashCountRepository()._collection
    _transaction_discount_collection = TransactionDiscountRepository()._collection


    def find(self, query={}, *args):

        try:
            data = list(self._db[self._collection].aggregate([
                { '$match': query },
                {
                    "$addFields": {
                        "cashierId": {"$toObjectId": "$cashierId"},
                        "branchId": {"$toObjectId": "$branchId"},
                        "openingFundId": {"$toObjectId": "$openingFundId"},
                        "endingCashCountId": {"$toObjectId": "$endingCashCountId"},
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
                    '$lookup': {
                        'from': self._cash_count_collection,
                        'localField': 'openingFundId',
                        'foreignField': '_id',
                        'as': 'openingFund'
                    }, 
                },
                { "$unwind": {
                    'path': "$openingFund",
                    'preserveNullAndEmptyArrays': True    
                }},
                { 
                    '$lookup': {
                        'from': self._cash_count_collection,
                        'localField': 'endingCashCountId',
                        'foreignField': '_id',
                        'as': 'endingCashCount'
                    }, 
                },
                { "$unwind": {
                    'path': "$endingCashCount",
                    'preserveNullAndEmptyArrays': True    
                }},
                {
                    "$addFields": {
                        "cashierId": {"$toString": "$cashierId"},
                        "branchId": {"$toString": "$branchId"}
                    }
                },
                {
                    "$lookup": {
                        "from": self._transaction_collection,
                        # Matched by the shift's actual [timeIn, timeOut] window, not by calendar
                        # `date` equality — a shift crossing midnight (time-in 23:30, time-out
                        # 00:20) has sales on two different calendar dates, but is still one shift
                        # that should show up as one X-Reading. timeIn/timeOut and a transaction's
                        # transactionDate are all ISO 8601 strings from the same fixed-offset
                        # timezone (getLocalTimeStr — app/utils/utils.py), so they compare
                        # correctly as plain strings. timeOut is null for a shift still in
                        # progress, in which case there's no upper bound yet.
                        "let": {
                            "branchId": "$branchId",
                            "cashierId": "$cashierId",
                            "timeIn": "$timeIn",
                            "timeOut": "$timeOut"
                        },
                        "pipeline": [
                            {
                                "$match": {
                                    "$expr": {
                                        "$and": [
                                            { "$eq": ["$branchId", "$$branchId"] },
                                            { "$eq": ["$cashierId", "$$cashierId"] },
                                            { "$gte": ["$transactionDate", "$$timeIn"] },
                                            { "$or": [
                                                { "$eq": ["$$timeOut", None] },
                                                { "$lte": ["$transactionDate", "$$timeOut"] },
                                            ]},
                                        ]
                                    }
                                }
                            },
                        ],
                        "as": "transactions"
                    }
                },
                {
                    "$lookup": {
                        "from": self._transaction_collection,
                        # Same shift-window matching as the "transactions" lookup above.
                        "let": {
                            "branchId": "$branchId",
                            "cashierId": "$cashierId",
                            "timeIn": "$timeIn",
                            "timeOut": "$timeOut"
                        },
                        "pipeline": [
                            {
                                "$match": {
                                    "$expr": {
                                        "$and": [
                                            { "$eq": ["$branchId", "$$branchId"] },
                                            { "$eq": ["$cashierId", "$$cashierId"] },
                                            { "$gte": ["$transactionDate", "$$timeIn"] },
                                            { "$or": [
                                                { "$eq": ["$$timeOut", None] },
                                                { "$lte": ["$transactionDate", "$$timeOut"] },
                                            ]},
                                            { "$in": [ "$status", ['completed', 'refunded'] ]}
                                        ]
                                    }
                                }
                            },
                            { 
                                '$group': {
                                    "_id": None,
                                    "totalGrossSales": { "$sum": "$totalGrossSales" },
                                    "totalNetSales": { "$sum": "$totalNetSales" },
                                    "totalDiscount": { "$sum": '$totalDiscount' } ,
                                    "totalSalesWithoutMemberDiscount": { "$sum": '$totalSalesWithoutMemberDiscount' } ,
                                    "totalMemberDiscount": { "$sum": '$totalMemberDiscount' } ,
                                    "invoiceStartNumber": { '$min': "$invoiceNumber" },
                                    "invoiceEndNumber": { '$max': "$invoiceNumber" },
                                }
                            },
                        ],
                        "as": "sales"
                    }
                },
                {
                    "$lookup": {
                        "from": self._transaction_discount_collection,
                        # transaction_discounts only carries a coarse `date` (no time-of-day), so
                        # the shift-window test below runs after joining to the full transaction
                        # and reading ITS transactionDate, same as the two lookups above.
                        "let": {
                            "branchId": "$branchId",
                            "cashierId": "$cashierId",
                            "timeIn": "$timeIn",
                            "timeOut": "$timeOut"
                        },
                        "pipeline": [
                            {
                                "$match": {
                                    "$expr": {
                                        "$and": [
                                            { "$eq": ["$branchId", "$$branchId"] },
                                            { "$eq": ["$cashierId", "$$cashierId"] },
                                        ]
                                    }
                                },
                            },
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
                                "$match": {
                                    "$expr": {
                                        "$and": [
                                            { "$gte": ["$transaction.transactionDate", "$$timeIn"] },
                                            { "$or": [
                                                { "$eq": ["$$timeOut", None] },
                                                { "$lte": ["$transaction.transactionDate", "$$timeOut"] },
                                            ]},
                                        ]
                                    }
                                }
                            },
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
                { "$unwind": {
                    'path': "$sales",
                    'preserveNullAndEmptyArrays': True    
                }},
                {
                    "$addFields": {
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
                        "discounts._id": 0,
                        "discounts.transaction._id": 0,
                        "discounts.transaction.transactionId": 0,
                        "discounts.transaction.transactionItems": 0,
                        "transactions._id": 0,
                        "transactions.transactionItems": 0,
                        "sales._id": 0,
                        'cashierId': 0,
                        "openingFundId": 0,
                        "endingCashCountId": 0,
                        'branchId': 0,
                        'cashier': {
                            'password': 0,
                            'branches': 0
                        }
                    }
                },
                { "$sort": { "_id": -1 }},
                *args,
                {
                    "$addFields": {
                        "_id": { "$toString": "$_id" },
                        "cashier._id": { "$toString": "$cashier._id" },
                        "openingFund._id": { "$toString": "$openingFund._id" },
                        "endingCashCount._id": { "$toString": "$endingCashCount._id" },
                        "branch._id": { "$toString": "$branch._id" },
                    }
                }
            ]))
            reports = []
            for item in data:
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
                item['totalPayments'] += get(item, 'endingCashCount.total') or 0

                if(item.get('sales') is not None):
                    openingFundTotal = get(item, 'openingFund.total') or 0
                    difference = item['totalPayments'] - openingFundTotal - item['sales']['totalNetSales']
                    item['sales']['cashDifference'] = difference
                
                item['totalPayments'] -= get(item, 'withdraw') or 0

                transactionSummary = {}
                transactions = filter(lambda i: get(i, 'tender.type') is not None and i['status'] == 'completed', item['transactions'])
                for key, value in groupby(transactions, lambda i: get(i, 'tender.type')):
                    total = sum(map(lambda i: i['totalNetSales'], value))
                    total += transactionSummary.get(key, 0)
                    transactionSummary[key] = total
                item['transactionSummary'] = transactionSummary                

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