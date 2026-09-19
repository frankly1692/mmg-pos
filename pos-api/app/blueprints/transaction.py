from bson import ObjectId
from flask import Blueprint, jsonify, request
from pydantic import ValidationError
from pydash import get, omit
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.database.config import roles, users
from app.filters.date_filter import DateFilter, compare_date_filter
from app.middlewares.authorized_attribute import authorized
from app.new_models.AuditLog import AuditCode, AuditLog
from app.new_models.Transaction import ChequeTender, CreateCashTransaction, CreateChequeTransaction, CreateTransaction, TenderType
from app.new_models.Transaction import CreateRefundTransaction, CreateTransaction, CreateCancelledTransaction, TransactionStatus
from app.repositories.audit_log import AuditLogRepository
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
auditLogRepository = AuditLogRepository()


def _log_number_gap(user_id, number_type, number, ptu_number, branch_id, error):
    """Standalone MongoDB has no multi-document transactions, so a sequence counter increment
    (invoice/cancel/refund number) and the transaction insert that follows it can't be made
    atomic. If the insert fails, the number is permanently burned with no transaction to show
    for it — this records that fact so the gap is explainable/auditable (BIR reconciliation)
    instead of silent. Never raises: a logging failure must not mask the original error.
    """
    try:
        auditLogRepository.insert_one(AuditLog(
            action=AuditCode.INVOICE_NUMBER_GAP,
            userId=user_id,
            data={
                'numberType': number_type,
                'number': number,
                'ptuNumber': ptu_number,
                'branchId': branch_id,
            },
            error=repr(error),
        ))
    except Exception:
        pass


def _get_cancel_permission(user_id, branch_id):
    """Who may cancel/refund a transaction: the cashier who completed it always can; a manager
    or admin can override for any transaction in a branch they're assigned to; admin additionally
    bypasses the branch check entirely (HQ-level override). Role names are matched
    case-insensitively per mmg-app/src/utils/Role.js. Returns (is_privileged, role_name) — a
    lookup failure (missing user/role) fails closed as unprivileged, never open.
    """
    user = users.find_one({'_id': ObjectId(user_id)})
    if not user or not user.get('role'):
        return False, None
    role = roles.find_one({'_id': ObjectId(user['role'])})
    role_name = role['name'].lower() if role and role.get('name') else None

    if role_name == 'admin':
        return True, role_name
    if role_name == 'manager' and branch_id in (user.get('branches') or []):
        return True, role_name
    return False, role_name

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
        return jsonify({'message': 'Unable to get transactions', 'error': e.errors(include_input=False, include_context=False, include_url=False)}), 400
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
        return jsonify({'message': 'Unable to process data', 'error': e.errors(include_input=False, include_context=False, include_url=False)}), 400
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
        # Present only when completing a transaction that was previously put on hold and
        # restored from History (see PosComponent.jsx: handleRestoreTransaction) — never part of
        # the transaction's own business fields, so it's pulled out before the pydantic model
        # sees the payload.
        hold_transaction_id = request_data.pop('holdTransactionId', None)
        args = { **request_data, "cashierId": user_id }

        tenderType = get(request_data, 'tender.type', None)
        status = get(request_data, 'status')

        if(status == TransactionStatus.COMPLETED and tenderType == TenderType.CHEQUE):
            model = CreateChequeTransaction(**args)
        else:
            model = CreateCashTransaction(**args)

        if(model.idempotencyKey):
            # Same click/submission arriving again (double-click that beat the frontend's own
            # guard, a retried request after a dropped response, etc). Return the transaction
            # that submission already created instead of generating a second invoice number.
            existing = transactionRepository.find_one({"idempotencyKey": model.idempotencyKey})
            if existing:
                return jsonify({'message': 'Transaction already processed', 'data': existing})

        # A restored hold is completed by converting its existing document (same _id) to
        # "completed" rather than inserting a second transaction — otherwise the original hold
        # document is orphaned with status "hold" forever while a disconnected duplicate
        # "completed" transaction is created next to it in History. Scoped to this cashier: a
        # crafted/stale id must never let one cashier finalize another cashier's hold, and if the
        # hold can't be found (already completed elsewhere, wrong id, not actually a hold
        # anymore) we block rather than silently falling back to creating an untracked duplicate.
        existing_hold = None
        if hold_transaction_id:
            existing_hold = transactionRepository.find_one({
                "_id": ObjectId(hold_transaction_id),
                "cashierId": user_id,
                "status": TransactionStatus.HOLD,
            }, agreggate=False)
            if not existing_hold:
                return jsonify({'message': 'Held transaction was not found, or is no longer on hold'}), 404

        if(status == TransactionStatus.COMPLETED and model.status == TransactionStatus.COMPLETED):
            # Invoice numbers are a single sequential series per accredited terminal (BIR PTU
            # rule) — shared by every cashier using that terminal, but never scoped by cashierId,
            # and never shared across terminals/PTUs either. model.ptuNumber is required whenever
            # status is completed (enforced by CreateTransaction.requirePtuNumberWhenCompleted).
            model.invoiceNumber = transactionRepository._get_next_sequence({ "type": "INVOICE_NUMBER", "ptuNumber": model.ptuNumber })

        model.transactionNumber = transactionRepository._get_next_sequence({ "type": "TRANSACTION_NUMBER", "cashierId": user_id })

        try:
            data = model.model_dump(by_alias=True, exclude={'discounts', 'transactionItems'})
            if existing_hold:
                result = transactionRepository.update_one_bare({ "_id": existing_hold["_id"] }, data)
                # The cart may have been edited after restoring the hold (items added/removed,
                # discount changed) — the items/discounts saved when it was first held no longer
                # necessarily match what's being paid for now, so replace them outright rather
                # than trying to reconcile old vs. new.
                itemRepository.delete_many({ "transactionId": str(existing_hold["_id"]) })
                discountRepository.delete_many({ "transactionId": str(existing_hold["_id"]) })
            else:
                result = transactionRepository.insert_one(data)
        except DuplicateKeyError as e:
            # The idempotencyKey race the check above couldn't close (two requests for the same
            # click both passed the check before either inserted) — the unique index is the real
            # guard. Whoever lost the race just returns the winner's transaction.
            if model.idempotencyKey and 'idempotencyKey' in str(e):
                existing = transactionRepository.find_one({"idempotencyKey": model.idempotencyKey})
                if existing:
                    return jsonify({'message': 'Transaction already processed', 'data': existing})
            if model.invoiceNumber is not None:
                _log_number_gap(user_id, "INVOICE_NUMBER", model.invoiceNumber, model.ptuNumber, model.branchId, e)
            raise
        except Exception as e:
            if model.invoiceNumber is not None:
                _log_number_gap(user_id, "INVOICE_NUMBER", model.invoiceNumber, model.ptuNumber, model.branchId, e)
            raise

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
        return jsonify({'message': 'Unable to process data', 'error': e.errors(include_input=False, include_context=False, include_url=False)}), 400
    except Exception as e:
        return jsonify({'message': 'Unable to create transaction', 'error': repr(e)}), 500

@transaction_bp.post('/v3/transactions/cancel')
@authorized
def v3_cancel_transaction(user_id):
    try:
        request_data = request.get_json()
        args = { **request_data, "cashierCancelled": user_id }
        model = CreateCancelledTransaction(**args)

        is_privileged, _role_name = _get_cancel_permission(user_id, model.branchId)

        # Z/X-reports for new_transactions are live aggregations grouped by the transaction's own
        # `date` (BranchReportRepository.find / CashierReportRepository.find), with no snapshot
        # taken at generation time and no "day closed" flag anywhere. A transaction's status can
        # only ever be flipped by a cancel/refund on the SAME calendar day it was completed —
        # otherwise, cancelling it in place would retroactively lower a business day's totals
        # after that day's Z has already been printed, which no BIR-compliant system can allow.
        # A cancel on a later day is rejected outright rather than silently rewriting history;
        # voiding a closed day's sale is a back-office adjustment, not a POS Cancel-button action.
        today = getLocalDateStr()

        claim_query = {
            "invoiceNumber": model.invoiceNumber,
            "branchId": model.branchId,
            "status": TransactionStatus.COMPLETED,
            "date": today,
        }
        if not is_privileged:
            claim_query["cashierId"] = user_id

        # Atomically claim the transaction: the status="completed" filter (plus cashierId, for a
        # non-privileged caller) and the flip to cancelled/refunded happen as one findAndModify
        # instead of a separate find_one() + update_one_bare(). Of two simultaneous cancel/refund
        # requests for the same invoice, only the first to reach MongoDB can match a still-
        # "completed" document — by the time the second's filter runs, status is already
        # "cancelled"/"refunded", so it matches nothing and gets None back, same as any other
        # not-found case. A separate read-then-write here leaves a window where both requests see
        # status="completed" and each create their own void document for the same invoice.
        transaction = transactionRepository._db[transactionRepository._collection].find_one_and_update(
            claim_query,
            { "$set": { "status": model.status } },
            return_document=ReturnDocument.AFTER,
        )

        if(not transaction or not transaction.get('invoiceNumber')):
            # The claim above is intentionally silent about *why* it failed (it's a single atomic
            # op, not a diagnosis) — this read-only lookup afterward exists purely to pick a
            # clear error message and doesn't affect correctness, since no write depends on it.
            existing = transactionRepository.find_one(
                { "invoiceNumber": model.invoiceNumber, "branchId": model.branchId }, agreggate=False
            )
            if not existing:
                return jsonify({'message': 'No transaction found for this invoice number on this branch.'}), 404
            if existing.get('status') != TransactionStatus.COMPLETED:
                return jsonify({'message': f"Transaction is already {existing.get('status')} and cannot be cancelled/refunded again."}), 409
            if not is_privileged and existing.get('cashierId') != user_id:
                return jsonify({'message': 'You do not have permission to cancel this transaction — only the cashier who completed the sale, or a manager/admin for this branch, can do this.'}), 403
            if existing.get('date') != today:
                return jsonify({'message': f"This transaction was completed on {existing.get('date')}, which is already closed out — it can no longer be cancelled or refunded from the POS. Contact back-office for a manual adjustment."}), 409
            return jsonify({'message': 'Transaction could not be claimed — it may have just been processed by another request.'}), 409

        original_id = transaction["_id"]
        next_sequence = "CANCEL_NUMBER" if model.status == TransactionStatus.CANCELLED else "REFUND_NUMBER"

        # The status flip above already committed — it's the atomic claim that makes this
        # request the sole owner of the transaction (see the find_one_and_update comment). From
        # here to the void document's insert, standalone MongoDB gives no multi-document
        # transaction to make the two writes atomic (see CLAUDE.md: "Standalone MongoDB has no
        # multi-collection transactions"), so anything that fails in between — a validation
        # error, a transient Mongo error, the discount update below — would otherwise leave the
        # transaction "cancelled"/"refunded" with no matching void document. Best-effort revert
        # the claim back to "completed" so that failure converges back to "neither exists" rather
        # than a half-done state. This can only run for an in-process failure; nothing can
        # recover a request whose process dies mid-write (no code executes to catch that) — that
        # needs a periodic reconciliation query (cancelled/refunded documents with no
        # serialNumber) rather than in-request handling.
        void_doc = None
        try:
            discountRepository.update_many_bare({ "transactionId": str(original_id) }, { "status": model.status })

            # idempotencyKey identifies one Pay-click submission — this negative document is a
            # new, separate submission (the cancel/refund action), not a retry of the original
            # sale, so it must not carry the original's key forward (every real completed sale
            # has one, which would otherwise collide with the original on unique_idempotency_key
            # and fail every cancel/refund of an idempotencyKey-bearing transaction).
            void_doc = omit(transaction, "_id", "idempotencyKey")
            void_doc['cashierId'] = user_id
            void_doc['transactionNumber'] = transactionRepository._get_next_sequence({ "type": "TRANSACTION_NUMBER", "cashierId": user_id })
            # Cancel/refund serial numbers are sequential per accredited terminal (BIR PTU rule),
            # same as invoiceNumber above. This is the PTU of the terminal performing the
            # cancel/refund right now, not necessarily the terminal that issued the original invoice.
            void_doc['ptuNumber'] = model.ptuNumber
            void_doc['serialNumber'] = transactionRepository._get_next_sequence({ "type": next_sequence, "ptuNumber": model.ptuNumber })
            void_doc['status'] = model.status
            void_doc['totalNetSales'] = -1 * void_doc['totalNetSales']
            void_doc['totalGrossSales'] = -1 * void_doc['totalGrossSales']
            void_doc['totalSalesWithoutMemberDiscount'] = -1 * void_doc['totalSalesWithoutMemberDiscount']
            void_doc['totalDiscount'] = -1 * void_doc['totalDiscount']
            void_doc['totalMemberDiscount'] = -1 * void_doc['totalMemberDiscount']
            void_doc['transactionDate'] = getLocalTimeStr()
            void_doc['date'] = getLocalDateStr()
            void_doc['reason'] = model.reason

            transactionRepository.insert_one(void_doc, refetch=False)
        except Exception as e:
            rollback_error = None
            try:
                transactionRepository._db[transactionRepository._collection].update_one(
                    { "_id": original_id, "status": model.status },
                    { "$set": { "status": TransactionStatus.COMPLETED } }
                )
                discountRepository.update_many_bare({ "transactionId": str(original_id) }, { "status": TransactionStatus.COMPLETED })
            except Exception as rollback_e:
                rollback_error = rollback_e

            _log_number_gap(
                user_id, next_sequence, void_doc.get('serialNumber') if void_doc else None, model.ptuNumber, model.branchId,
                e if rollback_error is None else f'{e!r}; ROLLBACK ALSO FAILED: {rollback_error!r}'
            )

            if rollback_error is not None:
                return jsonify({
                    'message': 'Unable to process transaction, and automatic recovery failed — this transaction requires manual review',
                    'error': repr(e)
                }), 500
            raise

        return jsonify({'message': f'Transaction {model.status.lower()} successfully' })
    except ValidationError as e:
        return jsonify({'message': 'Unable to process data', 'error': e.errors(include_input=False, include_context=False, include_url=False)}), 400
    except Exception as e:
        return jsonify({'message': 'Unable to process transaction', 'error': repr(e)}), 500
