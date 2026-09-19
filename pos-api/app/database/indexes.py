from pymongo import ASCENDING, DESCENDING
from pymongo.errors import OperationFailure


def _create_or_replace_index(collection, keys, **kwargs):
    """create_index with an existing name but a changed spec raises IndexOptionsConflict
    instead of updating it in place — needed here because unique_invoice_number_per_terminal's
    partialFilterExpression changed after it first shipped (see comment below). Self-healing:
    installs that already have the old spec get it dropped and recreated once; everyone else
    (fresh installs, or a server that already picked up the new spec) just succeeds normally.

    Gunicorn boots several worker processes at once, each calling this at import time, so the
    drop/recreate below can race across workers (one drops it out from under another, or two try
    to create it back to back) — both drop and the retry are individually best-effort so a race
    fails that one worker's attempt instead of crashing it; whichever worker wins leaves the
    collection with the correct index, which is all that actually matters.
    """
    try:
        collection.create_index(keys, **kwargs)
    except OperationFailure:
        try:
            collection.drop_index(kwargs['name'])
        except OperationFailure:
            pass
        try:
            collection.create_index(keys, **kwargs)
        except OperationFailure:
            pass


def ensure_indexes(db):
    # sales — queried by branch+date in report generation and cashier sales reports
    db.sales.create_index([("branch", ASCENDING), ("date", ASCENDING)])
    db.sales.create_index([("cashierId", ASCENDING), ("date", ASCENDING)])

    # cashier_reports — queried by branchId+date in generate_branch_report aggregation
    db.cashier_reports.create_index([("branchId", ASCENDING), ("date", ASCENDING)])

    # cashier_reports — a cashier can only have one shift (time-in) per branch per day. Without
    # this, time_in_report's "does a report already exist for today?" check is a plain find-then-
    # insert with a race window: a reload/double-click, two browser tabs, or a retried request
    # can both pass the check before either write lands, producing two live documents for one
    # shift. Each duplicate independently $lookups the same day's transactions in
    # CashierReportRepository.find, and branch-level Z-report generation sums `withdraw` across
    # every cashier_reports doc for a branch+date with no per-cashier grouping — so a duplicate
    # silently double-counts that cashier's withdraw in the Z-report. This index is what makes
    # the insert in time_in_report atomic: the second attempt gets a DuplicateKeyError instead of
    # a second document, which the route catches and logs as a traceable duplicate attempt.
    db.cashier_reports.create_index(
        [("cashierId", ASCENDING), ("branchId", ASCENDING), ("date", ASCENDING)],
        unique=True,
        name="unique_cashier_report_per_day",
    )

    # transactions — queried by status+cashierId+date for active transaction lookup
    db.transactions.create_index([("status", ASCENDING), ("cashierId", ASCENDING), ("date", ASCENDING)])
    db.transactions.create_index([("branchId", ASCENDING), ("date", ASCENDING)])

    # branch_reports — queried by branchId+date to check for existing daily report
    db.branch_reports.create_index([("branchId", ASCENDING), ("date", ASCENDING)])

    # audit_logs — typically queried by userId and datetime range
    db.audit_logs.create_index([("userId", ASCENDING)])
    db.audit_logs.create_index([("datetime", DESCENDING)])

    # new_transactions — BIR compliance guardrail: invoice numbers (and cancel/refund serial
    # numbers) must be unique per accredited terminal (PTU), not per branch or per cashier — see
    # "Invoice Number" in CLAUDE.md. The atomic counter in `counters` already prevents duplicates
    # from ever being *generated*; these indexes are the defense-in-depth backstop that makes it
    # impossible to *write* a duplicate to the database, even via a future bug, a manual edit, or
    # a code path that bypasses the counter entirely. Partial, because hold/draft transactions
    # have no real invoiceNumber/serialNumber yet and must not collide with each other.
    #
    # IMPORTANT: `invoiceNumber` is a declared pydantic field (`invoiceNumber: int = None` on
    # BaseTransaction), so model_dump() always includes the key — hold transactions get
    # `invoiceNumber: null`, not an absent field. `{"$exists": True}` matches null values too, so
    # it would wrongly pull every hold transaction into this unique constraint and make the
    # *second* hold ever created collide with the first. `{"$type": "number"}` correctly matches
    # only real invoice numbers. serialNumber has no such trap — it's never a declared model
    # field, only ever set as a raw dict key with a real value in the cancel/refund flow — but
    # $type is used there too for consistency and to stay safe if that ever changes.
    #
    # Scoped to status="completed": v3_cancel_transaction deliberately clones a cancelled/
    # refunded transaction keeping the SAME invoiceNumber (a cancel/refund is a negative mirror
    # of the original invoice, not a new one — see CLAUDE.md "Invoice Number"), on the same
    # ptuNumber whenever the void happens on the terminal that issued it. Without this scoping
    # that insert collides with the very index meant to protect invoice numbers, since one
    # (ptuNumber, invoiceNumber) pair would then exist on two documents. Only one COMPLETED
    # transaction may ever hold a given (ptuNumber, invoiceNumber) — that's the actual BIR
    # requirement — while its cancelled/refunded mirrors are free to share it.
    _create_or_replace_index(
        db.new_transactions,
        [("ptuNumber", ASCENDING), ("invoiceNumber", ASCENDING)],
        unique=True,
        partialFilterExpression={"invoiceNumber": {"$type": "number"}, "status": "completed"},
        name="unique_invoice_number_per_terminal",
    )
    db.new_transactions.create_index(
        [("ptuNumber", ASCENDING), ("serialNumber", ASCENDING)],
        unique=True,
        partialFilterExpression={"serialNumber": {"$type": "number"}},
        name="unique_serial_number_per_terminal",
    )

    # new_transactions — double-submit guard. mmg-app sends one client-generated idempotencyKey
    # per Pay/Hold click; this index is the authoritative backstop that rejects a second insert
    # with the same key (a double-click that slipped past the frontend's own click-guard, or a
    # retried request after a dropped response) with a DuplicateKeyError, which
    # v3_create_transaction catches and turns into "return the transaction already created"
    # instead of a second transaction / a second invoice number. Partial, since most transactions
    # (legacy /transaction/create, holds created without a key) have no idempotencyKey at all.
    db.new_transactions.create_index(
        [("idempotencyKey", ASCENDING)],
        unique=True,
        partialFilterExpression={"idempotencyKey": {"$type": "string"}},
        name="unique_idempotency_key",
    )

    # counters — prevents the sequence generator itself from ever splitting into two documents
    # for the same logical counter (which would silently defeat the atomic $inc guarantee that
    # _get_next_sequence relies on). One index covers every counter shape in this collection —
    # {type, ptuNumber} for INVOICE_NUMBER/CANCEL_NUMBER/REFUND_NUMBER, {type, cashierId} for
    # TRANSACTION_NUMBER — since `type` alone keeps the different shapes from ever colliding.
    db.counters.create_index(
        [("type", ASCENDING), ("ptuNumber", ASCENDING), ("cashierId", ASCENDING)],
        unique=True,
        name="unique_counter_key",
    )
