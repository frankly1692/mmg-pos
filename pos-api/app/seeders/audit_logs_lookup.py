"""Seed audit_logs_lookup — display names for AuditCode, joined in by AuditLogRepository.find()."""
from app.database.config import database
from app.new_models.AuditLog import AuditCode

audit_logs_lookup = database.audit_logs_lookup

DISPLAY_NAMES = {
    AuditCode.USER_LOGIN: "User Login",
    AuditCode.USER_LOGOUT: "User Logout",
    AuditCode.USER_CREATE: "User Created",
    AuditCode.USER_UPDATE: "User Updated",
    AuditCode.USER_UPDATE_ERR: "User Update Failed",
    AuditCode.USER_LOGIN_ERR_NOT_EXIST: "User Login Failed (User Not Found)",
    AuditCode.USER_LOGIN_ERR_INCORRECT_CRED: "User Login Failed (Incorrect Credentials)",
    AuditCode.ROLE_CREATE: "Role Created",
    AuditCode.ROLE_CREATE_ERR: "Role Creation Failed",
    AuditCode.ROLE_UPDATE: "Role Updated",
    AuditCode.ROLE_UPDATE_ERR: "Role Update Failed",
    AuditCode.TRANSACTION_CREATE: "Transaction Created",
    AuditCode.TRANSACTION_CREATE_ERR: "Transaction Creation Failed",
    AuditCode.TRANSACTION_CREATE_ERR_SALES: "Transaction Creation Failed (Sales Record)",
    AuditCode.INVOICE_NUMBER_GAP: "Invoice/Serial Number Gap",
    AuditCode.CASHIER_REPORT_TIME_IN: "Cashier Time In",
    AuditCode.CASHIER_REPORT_TIME_IN_ERR: "Cashier Time In Failed",
    AuditCode.CASHIER_REPORT_TIME_IN_DUPLICATE: "Duplicate Cashier Time In Blocked",
    AuditCode.CASHIER_REPORT_TIME_OUT: "Cashier Time Out",
    AuditCode.CASHIER_REPORT_TIME_OUT_ERR: "Cashier Time Out Failed",
    AuditCode.CUSTOMER_CREATE: "Customer Created",
    AuditCode.CUSTOMER_UPDATE: "Customer Updated",
    AuditCode.PACKAGE_UPDATE: "Package Updated",
    AuditCode.LABTEST_UPDATE: "Lab Test Updated",
    AuditCode.DISCOUNT_UPDATE: "Discount Updated",
    AuditCode.BRANCH_UPDATE: "Branch Updated",
    AuditCode.DOCTOR_UPDATE: "Doctor Updated",
    AuditCode.Z_REPORT_GENERATE: "Z-Report Generated",
    AuditCode.Z_REPORT_GENERATE_ERR: "Z-Report Generation Failed",
    AuditCode.X_REPORT_GENERATE: "X-Report Generated",
    AuditCode.X_REPORT_GENERATE_ERR: "X-Report Generation Failed",
    AuditCode.CORPORATE_UPDATE: "Corporate Updated",
}


def seed(log_fn):
    """Seed one lookup document per AuditCode, keyed by its numeric code."""
    created, skipped = 0, 0

    for code, name in DISPLAY_NAMES.items():
        existing = audit_logs_lookup.find_one({"code": code.value})
        if existing:
            if existing.get("name") != name:
                audit_logs_lookup.update_one({"_id": existing["_id"]}, {"$set": {"name": name}})
                log_fn(f"Updated audit code {code.value} ({code.name}) — name changed to '{name}'")
            skipped += 1
        else:
            audit_logs_lookup.insert_one({"code": code.value, "name": name})
            created += 1

    log_fn(f"Created {created}, already present {skipped} (of {len(DISPLAY_NAMES)} audit codes)")
