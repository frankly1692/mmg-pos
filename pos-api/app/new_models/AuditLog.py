from enum import IntEnum

from pydantic import BaseModel, Field

from app.utils.utils import getLocalTimeStr


class AuditCode(IntEnum):
    USER_LOGIN = 1001
    USER_LOGOUT = 1002
    USER_CREATE = 1003
    USER_UPDATE = 1004
    USER_UPDATE_ERR = 1104
    USER_LOGIN_ERR_NOT_EXIST = 1101
    USER_LOGIN_ERR_INCORRECT_CRED = 1201
    ROLE_CREATE = 2001
    ROLE_CREATE_ERR = 2101
    ROLE_UPDATE = 2002
    ROLE_UPDATE_ERR = 2102
    TRANSACTION_CREATE = 3001
    TRANSACTION_CREATE_ERR = 3101
    TRANSACTION_CREATE_ERR_SALES = 3201
    INVOICE_NUMBER_GAP = 3301
    CASHIER_REPORT_TIME_IN = 4001
    CASHIER_REPORT_TIME_IN_ERR = 4101
    CASHIER_REPORT_TIME_IN_DUPLICATE = 4102
    CASHIER_REPORT_TIME_OUT = 5001
    CASHIER_REPORT_TIME_OUT_ERR = 5101
    CUSTOMER_CREATE = 6001
    CUSTOMER_UPDATE = 6002
    PACKAGE_UPDATE = 7002
    LABTEST_UPDATE = 8002
    DISCOUNT_UPDATE = 9002
    BRANCH_UPDATE = 10002
    DOCTOR_UPDATE = 11002
    Z_REPORT_GENERATE = 12001
    Z_REPORT_GENERATE_ERR = 13001
    X_REPORT_GENERATE = 14001
    X_REPORT_GENERATE_ERR = 15001
    CORPORATE_UPDATE = 16002


DEFAULT_MESSAGES = {
    AuditCode.USER_LOGIN: "User logged in.",
    AuditCode.USER_LOGOUT: "User logged out.",
    AuditCode.USER_CREATE: "User account created.",
    AuditCode.USER_UPDATE: "User account updated.",
    AuditCode.USER_UPDATE_ERR: "Failed to update user account.",
    AuditCode.USER_LOGIN_ERR_NOT_EXIST: "Login failed — user does not exist.",
    AuditCode.USER_LOGIN_ERR_INCORRECT_CRED: "Login failed — incorrect credentials.",
    AuditCode.ROLE_CREATE: "Role created.",
    AuditCode.ROLE_CREATE_ERR: "Failed to create role.",
    AuditCode.ROLE_UPDATE: "Role updated.",
    AuditCode.ROLE_UPDATE_ERR: "Failed to update role.",
    AuditCode.TRANSACTION_CREATE: "Transaction created.",
    AuditCode.TRANSACTION_CREATE_ERR: "Failed to create transaction.",
    AuditCode.TRANSACTION_CREATE_ERR_SALES: "Failed to create sales record for transaction.",
    AuditCode.INVOICE_NUMBER_GAP: "A sequential number (invoice or cancel/refund serial) was allocated but the transaction failed to save — gap requires review.",
    AuditCode.CASHIER_REPORT_TIME_IN: "Cashier timed in.",
    AuditCode.CASHIER_REPORT_TIME_IN_ERR: "Failed to time in cashier report.",
    AuditCode.CASHIER_REPORT_TIME_IN_DUPLICATE: "Duplicate time-in attempt blocked — a shift report already exists for this cashier/branch/date.",
    AuditCode.CASHIER_REPORT_TIME_OUT: "Cashier timed out.",
    AuditCode.CASHIER_REPORT_TIME_OUT_ERR: "Failed to time out cashier report.",
    AuditCode.CUSTOMER_CREATE: "Customer record created.",
    AuditCode.CUSTOMER_UPDATE: "Customer record updated.",
    AuditCode.PACKAGE_UPDATE: "Package updated.",
    AuditCode.LABTEST_UPDATE: "Lab test updated.",
    AuditCode.DISCOUNT_UPDATE: "Discount updated.",
    AuditCode.BRANCH_UPDATE: "Branch updated.",
    AuditCode.DOCTOR_UPDATE: "Doctor updated.",
    AuditCode.Z_REPORT_GENERATE: "Z-Report generated.",
    AuditCode.Z_REPORT_GENERATE_ERR: "Failed to generate Z-Report.",
    AuditCode.X_REPORT_GENERATE: "X-Report generated.",
    AuditCode.X_REPORT_GENERATE_ERR: "Failed to generate X-Report.",
    AuditCode.CORPORATE_UPDATE: "Corporate account updated.",
}


class AuditLog(BaseModel):
    action: AuditCode
    data: object = None
    message: str = None
    error: str = None
    userId: str
    ipaddress: str = None
    datetime: str = Field(default_factory=getLocalTimeStr)

    def model_post_init(self, __context) -> None:
        if self.message is None:
            self.message = DEFAULT_MESSAGES.get(self.action)