


from bson import ObjectId
from flask import Blueprint, jsonify, request,g
from pydantic import ValidationError
from pydash import omit, pick
from pymongo.errors import DuplicateKeyError

from app.filters.date_filter import DateFilter
from app.middlewares.authorized_attribute import authorized
from app.new_models.AuditLog import AuditCode, AuditLog
from app.new_models.CashierReport import TimeInCashierReport, TimeOutCashierReport
from app.new_models.Transaction import TransactionStatus
from app.repositories.audit_log import AuditLogRepository
from app.repositories.cashier_report import CashierReportRepository
from app.repositories.report_cash_count import CashCountRepository
from app.repositories.transaction import TransactionRepository
from app.utils.utils import getLocalDateStr, getLocalTimeStr

api = '/v2/cashier-reports'
cashier_report_bp = Blueprint('cashier-reports', __name__)
reportRepository = CashierReportRepository()
cashCountRepository = CashCountRepository()
transactionRepository = TransactionRepository()
logger = AuditLogRepository()


@cashier_report_bp.route(api)
@authorized
def get_reports(user_id):
    date_filter = int(request.args.get('dateFilter', DateFilter.ALL))
    custom_date = request.args.get('customDate')
    start_date = request.args.get('startDate')
    end_date = request.args.get('endDate')
    params = pick(request.args.to_dict(), ['date', 'cashierId'])
    

    try:
        previous_report = reportRepository.find_one({ 
            'cashierId': user_id, 
        })

        # query = {} if cashierId is None else { 'cashierId': cashierId }
        reports = reportRepository.find_by_date_and(date_filter, start_date, end_date, custom_date, params)

        return jsonify({
            'data': {
                'previousReports': previous_report,
                'reports': reports
            }
        })
    # except ValidationError as e:
    #     return jsonify({'message': 'Unable to get reports', 'error': e.errors(include_input=False)}), 500
    except Exception as e:
        return jsonify({'message': 'Unable to get reports', 'error': repr(e)}), 500

@cashier_report_bp.post(api + '/time-in')
@authorized
def time_in_report(user_id):
    request_data = request.get_json()

    date_today = getLocalDateStr()
    branch_id = request_data['branchId']

    # Fast path only — avoids creating an orphaned opening-fund CashCount record for the common
    # case (a reload, or a session that's already timed in hitting this again). It is NOT what
    # makes this safe under a race: unique_cashier_report_per_day (app/database/indexes.py) is
    # the actual guarantee, enforced by the insert below.
    existing = reportRepository.find_one({
        'cashierId': user_id,
        'date': date_today,
        'branchId': branch_id
    })
    if(existing is not None):
        return jsonify({ 'data': existing, 'message': 'Report today returned' })

    # date/timeIn must always come from the server's own clock, never the client — otherwise a
    # workstation with an adjusted system date/time (or a modified/direct API call) could open a
    # shift dated for a day other than today, bypassing the same-day guarantees the rest of the
    # reporting system relies on (see the cross-day cancel guard in transaction.py for why that
    # matters). TimeInCashierReport's date/timeIn default_factory only fires when the field is
    # absent from **request_data, so passing them explicitly here, after the spread, is what
    # actually forces the server's clock to win.
    model = TimeInCashierReport(
        **request_data,
        cashierId=user_id,
        date=date_today,
        timeIn=getLocalTimeStr(),
    )

    openingFund = cashCountRepository.insert_one({
        **model.openingFund.count,
        **model.model_dump(include={'branchId', 'date'}),
        "total": model.openingFund.total,
        "type": "opening"
    })

    try:
        reportRepository.insert_one({
            **model.model_dump(exclude={'openingFund'}),
            "openingFundId": str(openingFund.inserted_id)
        })
    except DuplicateKeyError:
        # Lost a genuine race: another time-in for this cashier/branch/date landed between the
        # check above and this insert (two tabs, a reload racing a slow first request, a retried
        # POST). The opening-fund CashCount just inserted above is now an orphan — cosmetic, not
        # referenced by anything — acceptable cost for a rare race rather than adding a second
        # transactional guarantee here. Logged as a traceable duplicate attempt rather than
        # silently discarding it, then the real (first) report is returned so the session
        # proceeds normally.
        logger.insert_one(AuditLog(
            action=AuditCode.CASHIER_REPORT_TIME_IN_DUPLICATE,
            userId=user_id,
            data={'branchId': branch_id, 'date': date_today},
        ))
        existing = reportRepository.find_one({
            'cashierId': user_id,
            'date': date_today,
            'branchId': branch_id
        })
        return jsonify({ 'data': existing, 'message': 'Report today returned' })

    logger.insert_one(AuditLog(action=AuditCode.CASHIER_REPORT_TIME_IN, userId=g.user_id, data=model.model_dump()))
    return jsonify({'message': 'Report created successfully'})

@cashier_report_bp.post(api + '/time-out')
@authorized
def time_out_report(user_id):
    request_data = request.get_json()

    model = TimeOutCashierReport(
        **request_data,
        timeOut=getLocalTimeStr(),
    )

    # Fast path only — avoids creating an ending CashCount record for a call that's already known
    # to fail (wrong id, wrong owner, or already timed out). It is NOT what makes this safe: the
    # atomic claim on the update below is the actual guarantee. cashierId scoping is the
    # ownership check — a report can only be timed out by the cashier who timed in, never by a
    # different cashier who happens to know/guess its id.
    blocking_report = reportRepository._db[reportRepository._collection].find_one({
        '_id': ObjectId(model.id)
    })
    if blocking_report is None:
        message = 'No cashier report found for this id.'
        logger.insert_one(AuditLog(action=AuditCode.CASHIER_REPORT_TIME_OUT_ERR, userId=g.user_id, data=model.model_dump(), error=message))
        return jsonify({'message': message}), 404
    if blocking_report.get('cashierId') != user_id:
        message = 'You do not have permission to time out this report — it belongs to a different cashier.'
        logger.insert_one(AuditLog(action=AuditCode.CASHIER_REPORT_TIME_OUT_ERR, userId=g.user_id, data=model.model_dump(), error=message))
        return jsonify({'message': message}), 403
    if blocking_report.get('timeOut') is not None:
        message = 'This report has already been timed out — ending cash was already counted and cannot be recorded again.'
        logger.insert_one(AuditLog(action=AuditCode.CASHIER_REPORT_TIME_OUT_ERR, userId=g.user_id, data=model.model_dump(), error=message))
        return jsonify({'message': message}), 409

    # A shift's business date is fixed at time-in and must never move, even when time-out falls
    # on the next calendar day (a shift crossing midnight) — otherwise the opening CashCount
    # (dated at time-in) and the ending CashCount (dated at time-out) end up on two different
    # dates for what is really one shift, and the report's own `date` field — what X/Z-report
    # generation groups and matches by — would silently jump to the time-out's calendar day.
    # Reuse the report's original `date` here rather than `model.date` (TimeOutCashierReport
    # defaults it to *now*, i.e. the moment of time-out).
    business_date = blocking_report['date']

    cashCount = cashCountRepository.insert_one({
        **model.endingCashCount.count,
        **model.model_dump(include={'branchId'}),
        "date": business_date,
        "total": model.endingCashCount.total,
        "type": "ending"
    })

    # `cashierId: user_id` + `timeOut: None` together are the atomic claim — a report can only be
    # timed out once, and only by the cashier who owns it. TimeInCashierReport declares timeOut
    # as a field defaulting to None, and pydantic always includes declared fields in
    # model_dump(), so every freshly timed-in report genuinely has `timeOut: null` on disk (not
    # an absent key) until its first time-out sets it. Without the timeOut condition, a second
    # time-out call for the same report id (accidental double submit, a retry, or a genuine race)
    # would silently overwrite timeOut/withdraw/endingCashCountId with whatever the second call
    # sent, and the CashCount inserted above for the FIRST call becomes an orphan. Without the
    # cashierId condition, any authenticated user who knows/guesses another cashier's report id
    # could close out that cashier's shift. `date` is excluded from the update — see
    # business_date above — so time-out can never move the report off its time-in date.
    result = reportRepository.update_one_bare(
        { '_id': ObjectId(model.id), 'cashierId': user_id, 'timeOut': None },
        {
            **model.model_dump(exclude={'endingCashCount', 'id', 'date'}),
            "endingCashCountId": str(cashCount.inserted_id)
        }
    )

    if result is not None:
        logger.insert_one(AuditLog(action=AuditCode.CASHIER_REPORT_TIME_OUT, userId=g.user_id, data=model.model_dump()))
        logger.insert_one(AuditLog(action=AuditCode.X_REPORT_GENERATE, userId=user_id))
        return jsonify({'message': 'Report updated successfully', 'data': result })

    # The claim above is intentionally silent about *why* it failed — this read-only lookup
    # afterward exists purely to pick a clear error message and doesn't affect correctness. The
    # CashCount just inserted above is now an orphan in this failure path (cosmetic, not
    # referenced by anything) — an acceptable cost for a rare race rather than a second
    # transactional guarantee here.
    existing = reportRepository._db[reportRepository._collection].find_one({ '_id': ObjectId(model.id) })
    if existing is None:
        message, status = 'No cashier report found for this id.', 404
    elif existing.get('cashierId') != user_id:
        message, status = 'You do not have permission to time out this report — it belongs to a different cashier.', 403
    elif existing.get('timeOut') is not None:
        message, status = 'This report has already been timed out — ending cash was already counted and cannot be recorded again.', 409
    else:
        message, status = 'Unable to update report.', 409

    logger.insert_one(AuditLog(action=AuditCode.CASHIER_REPORT_TIME_OUT_ERR, userId=g.user_id, data=model.model_dump(), error=message))
    return jsonify({'message': message}), status
    