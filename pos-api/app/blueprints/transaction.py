from bson import ObjectId
from flask import Blueprint, jsonify, request
from pydantic import ValidationError
from pydash import get, omit

from app.filters.date_filter import DateFilter, compare_date_filter
from app.middlewares.authorized_attribute import authorized
from app.new_models.Transaction import ChequeTender, CreateCashTransaction, CreateChequeTransaction, CreateTransaction, TenderType
from app.new_models.Transaction import CreateRefundTransaction, CreateTransaction, CreateCancelledTransaction, TransactionStatus
from app.repositories.transaction import TransactionRepository
from app.repositories.transaction_discount import TransactionDiscountRepository
from app.repositories.transaction_item import TransactionItemRepository
from app.services.Transaction import TransactionService
from app.utils.utils import getLocalDateStr, getLocalTimeStr

api = '/v2/transactions'
transaction_bp = Blueprint('transactions', __name__)
transactionRepository = TransactionRepository()
discountRepository = TransactionDiscountRepository()
itemRepository = TransactionItemRepository()

@transaction_bp.get(api)
@authorized
def get_transactions(user_id):
    date_filter = int(request.args.get('dateFilter', DateFilter.ALL))
    custom_date = request.args.get('customDate')
    start_date = request.args.get('startDate')
    end_date = request.args.get('endDate')
    cashierId = request.args.get('cashierId')

    try:
        query = {} if cashierId is None else { 'cashierId': cashierId }

        transaction = transactionRepository.find(query)

        filtered_transaction = [
            transaction for transaction in transaction 
            if compare_date_filter(
                date_filter, 
                transaction['date'],
                custom_date,
                start_date,
                end_date
            )
        ]

        return jsonify({'data': filtered_transaction})
    except ValidationError as e:
        return jsonify({'message': 'Unable to get transactions', 'error': e.errors(include_input=False)}), 500
    except Exception as e:
        return jsonify({'message': 'Unable to get transactions', 'error': repr(e)}), 500
    

@transaction_bp.post(api)
@authorized
def create_transaction(user_id):
    try:
        request_data = request.get_json()
        active_transaction = transactionRepository.find_active(user_id)

        if active_transaction is not None:
            return { 
                'data': active_transaction, 
                'message': 'Return active transaction' 
            }, 200
            
        transaction = CreateTransaction(
            **request_data,
            cashierId=user_id,
        )

        result = transactionRepository.insert_one(transaction.model_dump())
        if result is None:
            raise Exception()
        
        return jsonify({'message': 'Transaction created successfully', 'data': result })
    except ValidationError as e:
        return jsonify({'message': 'Unable to process data', 'error': e.errors(include_input=False)}), 500
    except Exception as e:
        return jsonify({'message': 'Unable to create transaction', 'error': repr(e)}), 500


@transaction_bp.get(api + '/<id>')
@authorized
def get_transaction(user_id, id):
    try:
        data = transactionRepository.find_one({ '_id': ObjectId(id) })
        return jsonify({'data': data})
    except Exception as e:
        return jsonify({'message': 'Unable to get transaction', 'error': repr(e)}), 500

@transaction_bp.get(api + '/active')
@authorized
def get_active_transaction(user_id):
    try:
        data = transactionRepository.find_active(user_id)
        return jsonify({'data': data})
    except Exception as e:
        return jsonify({'message': 'Unable to get active transaction', 'error': repr(e)}), 500

@transaction_bp.get(api + '/<id>/print')
@authorized
def print_transaction(user_id, id):
    service = TransactionService()

    try:
        data = transactionRepository.find_one({ '_id': ObjectId(id) })
        service.print(data)
        return jsonify({'message': 'Transaction printed successfully'})
    except Exception as e:
        return jsonify({'message': 'Unable to get transaction', 'error': repr(e)}), 500


@transaction_bp.post('/v3/transactions')
@authorized
def v3_create_transaction(user_id):
    try:
        request_data = request.get_json()
        args = { **request_data, "cashierId": user_id }
        
        tenderType = get(request_data, 'tender.type', None)
        status = get(request_data, 'status')

        if(status == TransactionStatus.COMPLETED and tenderType == TenderType.CHEQUE):
            model = CreateChequeTransaction(**args)
        else:
            model = CreateCashTransaction(**args)

        if(status == TransactionStatus.COMPLETED and model.status == TransactionStatus.COMPLETED):
            model.invoiceNumber = transactionRepository._get_next_sequence({ "type": "INVOICE_NUMBER", "cashierId": user_id })

        model.transactionNumber = transactionRepository._get_next_sequence({ "type": "TRANSACTION_NUMBER", "cashierId": user_id })
        data = model.model_dump(by_alias=True, exclude={'discounts', 'transactionItems'})
        result = transactionRepository.insert_one(data)

        discounts = list(map(
            lambda i: { 
                **i.model_dump(exclude='id'),
                'discountId': i.id, 
                'transactionId': result['_id'],
                'customerId': result['customer']['_id'],
                'memberId': result['customer'].get('customer_type_id'),
                **model.model_dump(
                    include={
                        'cashierId', 
                        'branchId', 
                        'date',
                        'status'
                    }
                )
            }, 
            model.discounts
        ))
        
        if(len(discounts) > 0):
            discountRepository.insert_many(discounts)

        transactionItems = list(map(
            lambda i: { 
                **i.model_dump(exclude='id'),
                'transactionId': result['_id'],
                **model.model_dump(include={'date'})
            }, 
            model.transactionItems
        ))

        if(len(transactionItems) > 0):
            itemRepository.insert_many(transactionItems)

        result = transactionRepository.find_one({ '_id': ObjectId(result['_id']) })
        return jsonify({'message': 'Transaction created successfully', 'data': result })
    except ValidationError as e:
        return jsonify({'message': 'Unable to process data', 'error': e.errors(include_input=False)}), 500
    except Exception as e:
        return jsonify({'message': 'Unable to create transaction', 'error': repr(e)}), 500

@transaction_bp.post('/v3/transactions/cancel')
@authorized
def v3_cancel_transaction(user_id):
    try:
        request_data = request.get_json()
        args = { **request_data, "cashierCancelled": user_id }
        model = CreateCancelledTransaction(**args)

        transaction = transactionRepository.find_one({ 
            "invoiceNumber": model.invoiceNumber, 
            "branchId": model.branchId, 
            "status": TransactionStatus.COMPLETED,
            "cashierId": user_id
        }, agreggate=False)

        if(not transaction or not transaction.get('invoiceNumber')):
            return jsonify({'message': 'Transaction not found nor refundable (No invoice number)', 'data': transaction })

        updateQuery =  { "status": model.status }
        transactionRepository.update_one_bare({ "_id": transaction["_id"] }, updateQuery)
        discountRepository.update_many_bare({ "transactionId": str(transaction["_id"]) }, updateQuery)

        next_sequence = "CANCEL_NUMBER" if model.status == TransactionStatus.CANCELLED else "REFUND_NUMBER"

        transaction = omit(transaction, "_id")
        transaction['cashierId'] = user_id
        transaction['transactionNumber'] = transactionRepository._get_next_sequence({ "type": "TRANSACTION_NUMBER", "cashierId": user_id })
        transaction['serialNumber'] = transactionRepository._get_next_sequence({ "type": next_sequence, "cashierId": user_id })
        transaction['status'] = model.status
        transaction['totalNetSales'] = -1 * transaction['totalNetSales']
        transaction['totalGrossSales'] = -1 * transaction['totalGrossSales']
        transaction['totalSalesWithoutMemberDiscount'] = -1 * transaction['totalSalesWithoutMemberDiscount']
        transaction['totalDiscount'] = -1 * transaction['totalDiscount']
        transaction['totalMemberDiscount'] = -1 * transaction['totalMemberDiscount']
        transaction['transactionDate'] = getLocalTimeStr()
        transaction['date'] = getLocalDateStr()
        transaction['reason'] = model.reason
        transactionRepository.insert_one(transaction, refetch=False)

        return jsonify({'message': f'Transaction {model.status.lower()} successfully' })
    except ValidationError as e:
        return jsonify({'message': 'Unable to process data', 'error': e.errors(include_input=False)}), 500
    except Exception as e:
        return jsonify({'message': 'Unable to process transaction', 'error': repr(e)}), 500
