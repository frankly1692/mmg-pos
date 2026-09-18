import asyncio
import datetime
import os
import sys
import time
import traceback
import itertools
from itertools import groupby
import json
import numbers
import escpos
from pydash import get, start_case, to_lower, upper_case
import pytz
import serial
from websockets.asyncio.server import serve
import escpos.exceptions
from escpos.printer import Usb, Network

import threading
import config as helper_config
import logsetup

_DATA_DIR = helper_config.resolve_data_dir()
LOG_PATH = logsetup.setup(_DATA_DIR)
EJOURNAL_PATH = os.path.join(_DATA_DIR, "ejournal.txt")

# Per-workstation settings (BIR credentials, printer IP, display port, WS port)
CONFIG, CONFIG_WARNINGS = helper_config.load(_DATA_DIR)
TERMINAL_MIN    = CONFIG["MIN"]
TERMINAL_SN     = CONFIG["SN"]
TERMINAL_PTU_NO = CONFIG["PTU_NO"]

print(f"Config loaded from {_DATA_DIR} — MIN: {TERMINAL_MIN}, SN: {TERMINAL_SN}, PTU: {TERMINAL_PTU_NO}")
print(f"Printer: {CONFIG['printer_ip']}  Display: {CONFIG['display_port']}  WS port: {CONFIG['ws_port']}")
for _w in CONFIG_WARNINGS:
    print(f"[CONFIG WARN] {_w}")


def reload_config():
    """Re-read config.json in place so running code picks up edits without a new process."""
    global CONFIG_WARNINGS, TERMINAL_MIN, TERMINAL_SN, TERMINAL_PTU_NO
    new_cfg, CONFIG_WARNINGS = helper_config.load(_DATA_DIR)
    CONFIG.clear()
    CONFIG.update(new_cfg)
    TERMINAL_MIN, TERMINAL_SN, TERMINAL_PTU_NO = CONFIG["MIN"], CONFIG["SN"], CONFIG["PTU_NO"]
    for w in CONFIG_WARNINGS:
        print(f"[CONFIG WARN] {w}")

# Debouncing state
last_processed_transaction = {
    "id": None,
    "time": 0
}

# Patch for missing DeviceNotFoundError in some python-escpos versions
if not hasattr(escpos.exceptions, 'DeviceNotFoundError'):
    class DeviceNotFoundError(Exception):
        pass
    escpos.exceptions.DeviceNotFoundError = DeviceNotFoundError


MAX_CHAR_PER_ROW = 40

def get_local_time():
    return datetime.datetime.now(pytz.timezone('Asia/Manila'))

def clip(value):
    return "{:.2f}".format(value)

PRINTER_CONNECT_ATTEMPTS = 2
PRINTER_CONNECT_TIMEOUT = 2    # seconds per connection attempt
PRINTER_CONNECT_PAUSE = 0.5    # seconds between attempts
PRINTER_WRITE_TIMEOUT = 10     # seconds a print may take once connected

def get_printer_device(setting: dict = {}):
    """Connect to the receipt printer, retrying a few times to ride out a network blip.

    Retrying is only safe because nothing has been sent yet: python-escpos connects lazily, so we
    open the socket here and either hand back a live printer or an error. Once connected, a failure
    during printing is never retried (see ReceiptWriter._printer_failed), so a receipt can't print twice.
    """
    # Handle case where setting is not a dict (e.g., string "network")
    if not isinstance(setting, dict):
        setting = {}
    url = setting.get('url') or CONFIG['printer_ip']
    error = None
    for attempt in range(1, PRINTER_CONNECT_ATTEMPTS + 1):
        print(f"Attempting printer connection to: {url} ({attempt}/{PRINTER_CONNECT_ATTEMPTS})")
        p = Network(url, timeout=PRINTER_CONNECT_TIMEOUT)
        try:
            p.open()
            p.device.settimeout(PRINTER_WRITE_TIMEOUT)
            return p, None
        except Exception as e:
            error = str(e).strip() or f"{type(e).__name__} connecting to {url}"
            print(f"Printer connection error: {error}")
            if attempt < PRINTER_CONNECT_ATTEMPTS:
                time.sleep(PRINTER_CONNECT_PAUSE)
    return None, error

def get_display_device():
    return serial.Serial(port=CONFIG['display_port'], baudrate=CONFIG['display_baudrate'])

class ReceiptWriter:
    def __init__(self, settings: dict, journal: bool = True):
        self.printer, self.error = get_printer_device(settings)
        self.file = None
        self.journal = journal
        self.journal_error = None

    def __enter__(self):
        if self.journal:
            try:
                self.file = open(EJOURNAL_PATH, "a", encoding="utf-8")
            except Exception as e:
                self.journal_error = f"Could not open ejournal at {EJOURNAL_PATH}: {e}"
                print(f"[{get_local_time()}] [ERR] {self.journal_error}")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.file:
            try:
                self.file.close()
            except Exception as e:
                print(f"Error closing journal: {e}")
        
        if self.printer:
            try:
                self.printer.cut()
                self.printer.close()
            except Exception as e:
                self._printer_failed("close", e)

    def _printer_failed(self, op: str, e: Exception):
        """A print failed after the connection was made. Record it in self.error (callers report
        'printer unavailable' from that) and stop touching the printer. Deliberately NOT retried:
        some of the receipt may already have printed, and retrying could print it twice."""
        print(f"[{get_local_time()}] [ERR] Printer {op} error: {e}")
        if not self.error:
            self.error = str(e).strip() or f"{type(e).__name__} during {op}"
        self.printer = None

    def set(self, **kwargs):
        if self.printer:
            try:
                self.printer.set(**kwargs)
            except Exception as e:
                self._printer_failed("set", e)

    def write(self, text: str):
        if text is None: return
        if not isinstance(text, str): text = str(text)

        if self.file:
            try:
                self.file.write(text)
                self.file.flush()
            except Exception as e:
                self.journal_error = f"Could not write to ejournal at {EJOURNAL_PATH}: {e}"
                print(f"[{get_local_time()}] [ERR] {self.journal_error}")

        if self.printer and hasattr(self.printer, 'text'):
            try:
                self.printer.text(text)
            except Exception as e:
                self._printer_failed("write", e)

    def writeln(self, text: str = ""):
        self.write(text)
        self.write('\n')

    def row(self, label: str, value, transform=True):
        if(transform and isinstance(value, numbers.Number) and not isinstance(value, bool)):
            value = clip(value)
        if(not isinstance(value, str)):
            value = str(value)
        self.writeln(label + value.rjust(MAX_CHAR_PER_ROW - len(label)))

    def line(self):
        self.writeln('-' * MAX_CHAR_PER_ROW)

    def title(self, name):
        self.set(align='center')
        self.writeln(name)
        self.set(align='left')


def print_test(data: dict = {}):
    try:
        with ReceiptWriter(data.get('settings', {}), journal=False) as w:
            w.set(align='center', bold=True)
            w.write(f'Test Print: {data.get("message", "TEST PRINT")}\n\n')
    except Exception as e:
        print(f"[{get_local_time()}] [ERR] Test print error: {repr(e)}")
        return {'message': 'Error during test print', 'error': repr(e)}

    if w.error:
        print(f"[{get_local_time()}] [WARN] Test print - Printer unavailable: {w.error}")
        return {'message': 'Printer unavailable', 'error': w.error}

    print(f"[{get_local_time()}] [OK] Test print successful")
    return { 'message': 'Printed successfully' }

def print_ejournal(data: dict = {}):
    try:
        if not os.path.exists(EJOURNAL_PATH):
            return {'message': 'Electronic journal not found', 'error': f'{EJOURNAL_PATH} does not exist yet — no receipts have been journaled here'}

        with open(EJOURNAL_PATH, 'r', encoding='utf-8') as f:
            journal_content = f.read()

        if not journal_content.strip():
            return {'message': 'Electronic journal is empty', 'error': f'{EJOURNAL_PATH} exists but has no content'}

        with ReceiptWriter(data.get('settings', {}), journal=False) as w:
            w.set(align='center', bold=True)
            w.write('ELECTRONIC JOURNAL REPORT\n\n')
            w.set(align='center', bold=False)
            w.write(f'Printed: {get_local_time().strftime("%Y-%m-%d %H:%M:%S")}\n')
            w.write('=' * MAX_CHAR_PER_ROW + '\n\n')
            w.set(align='left', bold=False)
            w.write(journal_content)
            w.write('\n' + '=' * MAX_CHAR_PER_ROW + '\n')
            w.set(align='center', bold=True)
            w.write('END OF JOURNAL\n')
    except Exception as e:
        return {'message': 'Error printing electronic journal', 'error': repr(e)}

    if w.error:
        return {'message': 'Journal content ready but printer unavailable', 'error': w.error}

    return {'message': 'Electronic journal printed successfully'}

def print_receipt(request_data: dict = {}):
    transaction = request_data['transaction']
    
    # Debouncing Logic
    # global last_processed_transaction
    # current_time = time.time()
    # current_id = str(transaction.get('invoiceNumber')) + str(request_data.get('reprint', False))
    
    # if last_processed_transaction['id'] == current_id and (current_time - last_processed_transaction['time']) < 2.0:
    #     print(f"Skipping duplicate print request for ID: {current_id}")
    #     return { 'message': 'Duplicate print request skipped' }
    
    # last_processed_transaction['id'] = current_id
    # last_processed_transaction['time'] = current_time

    branch = transaction['branch']
    cashier = transaction['cashier']
    dvote = request_data['dvoteDetails'][0]
    customer = transaction['customer']
    reprint = request_data.get('reprint') 
    reprintLabel = '(RE-PRINT)' if reprint else ''

    companyCopy = request_data.get('companyCopy')
    companyLabel = '(COMPANY\'S COPY)' if companyCopy else ''

    discounts = list(filter(lambda i: i.get('memberType') is not None, transaction['discounts']))
    memberDiscount = discounts[0] if len(discounts) > 0 else None

    memberDiscountName = f'({start_case(memberDiscount["memberType"])})' if memberDiscount is not None else ""

    dt = datetime.datetime.fromisoformat(transaction['transactionDate'])
    dateNow = get_local_time()

    try:
        with ReceiptWriter(request_data.get('settings', {}), journal=not reprint) as p:
            p.set(align='center', bold=True)
            p.write(f'MMG-ALBAY {companyLabel}\n\n')
            p.set(align='center', bold=False)
            p.write('Operated By:\n')
            p.set(align='center', bold=True)
            p.write('MEDICAL MISSION GROUP MULTIPURPOSE COOPERATIVE-ALBAY\n')
            p.set(align='center', bold=False)
            p.write('VAT REG TIN ' + branch['tin'] + '\n')
            p.write(upper_case(branch['streetAddress']) + '\n\n')

            p.set(align='center', bold=True)
            if(transaction['status'] == 'completed'):
                p.write(f'SERVICE INVOICE\n')
            else:
                p.write(f'{transaction["status"].upper()} DOCUMENT\n')
            
            if(reprint):
                p.write(f'{reprintLabel}\n')

            p.set(align='left', bold=False)
            p.line()

            if(reprint):
                p.row("Reprint Date: ", dateNow.strftime("%Y-%m-%d %I:%M%p"))

            
            p.row("MIN: ", TERMINAL_MIN)
            p.row("SN: ", TERMINAL_SN)
            p.row("PTU No: ", TERMINAL_PTU_NO)
            p.row("Date & Time: ", dt.strftime("%Y-%m-%d %I:%M%p"))
            p.row("Cashier: ", start_case(cashier["first_name"] + " " + cashier["last_name"]))
            if(transaction['status'] == 'completed'):
                p.row("Invoice #: ", str(transaction["invoiceNumber"]).zfill(6))
            else:
                p.row("Serial #: ", str(transaction["serialNumber"]).zfill(6))
                p.row("Reference #: ", str(transaction["invoiceNumber"]).zfill(6))

            p.line()
            p.set(align='center', bold=True)
            p.write('SOLD TO\n')
            p.set(align='left', bold=False)

            p.row("Name: ", start_case(to_lower(customer["name"])))
            p.row("Address: ", start_case(to_lower(customer["address"])))
            p.row("TIN: ", customer.get("tin_number") or "---")

            if(companyCopy):
                p.row("Age: ", customer["age"], transform=False)
                p.row("Birth Date: ", str(customer["birthDate"]).split("T")[0])
            else:
                p.row("Age: ", "---")
                p.row("Birth Date: ", "---")
                
            p.row("Requested By: ", transaction.get("requestedByName", "---"))

            p.line()
            p.set(align='center', bold=True)
            p.row("ITEM ", "|QTY|PRICE|AMOUNT")
            p.set(align='left', bold=False)
            p.line()

            for key, items in groupby(transaction['transactionItems'], lambda i: i.get('package')):
                package = key

                indented = ''
                if(package is not None):
                    indented = '  '
                    p.write(f'> {package["name"]} \n')

                for item in list(items):
                    amount = item['price'] if transaction['status'] != 'refunded' else item['price'] * -1
                    p.writeln(str((indented + item["name"])[:22]).ljust(23) + f'({item["quantity"]})'.center(5) + str(amount).center(6) + str(amount).rjust(6))
                
                if(package is not None):
                    discounts = list(filter(lambda i: i.get('packageId') == package['id'] and i['memberType'] is None, transaction['discounts']))
                    if(len(discounts) > 0):
                        discount = discounts[0]
                        totalDiscount = discount['value'] if discount['type'] == 'fixed' else (transaction['totalGrossSales'] * (discount['value'] / 100))
                        p.row(f'  - Less: {discount["name"]}', f'- {"{:.2f}".format(totalDiscount)}')

            p.line()
            p.set(align='left', bold=True)
            
            totalSales = transaction['totalSalesWithoutMemberDiscount']
            totalMemberDiscount = transaction['totalMemberDiscount']
            totalNetSales = transaction['totalNetSales']
            
            # Calculate VAT components
            vatableAmount = transaction.get('vatableAmount', 0.00)
            vatExemptAmount = transaction.get('vatExemptAmount', totalNetSales if vatableAmount == 0 else 0.00)
            vatAmount = transaction.get('vatAmount', 0.00)

            p.row("Total Sales: ", totalSales)
            p.set(bold=False)
            
            memberDiscountVal = f'{memberDiscount["value"]}%' if memberDiscount is not None else '0%'

            if memberDiscount is not None: 
                p.writeln(f"Less Discount: ")
                p.row(f'  - {memberDiscountVal} {memberDiscountName}:', f'{totalMemberDiscount}')
            else: 
                p.row(f"Less Discount: ", "0.00")
            
            p.set(bold=True)
            p.row("Net Sales: ", totalNetSales)
            p.set(bold=False)
            p.line()
            
            p.row("Vatable Amount: ", vatableAmount)
            p.row("Vat Exempt Amount: ", vatExemptAmount)
            p.row("12% Vat: ", vatAmount)
            
            p.set(bold=True)
            p.row("Total Amount Due: ", totalNetSales)
            
            p.set(bold=False)
            p.line()
            
            p.row("Tender Amount: ", get(transaction, 'tender.amount'))
            p.row("Tender Type: ", upper_case(get(transaction, 'tender.type')))
            p.row("Change: ", transaction["change"])

            # This block only needed for dry run
            # p.line()
            # p.set(align='center', bold=True)
            # p.write('*THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX*\n')

            if(memberDiscount is not None):
                p.line()
                p.writeln()
                p.set(align='left', bold=False)

                customerTypeId = customer.get('customer_type_id') or ('_' * 10) 
                p.row(f'ID Member: ', f'{customerTypeId}\n')
                p.row("Signature: ", f'{("_" * 12)}\n')

            p.set(align="center")
            p.writeln('Supplier:')
            p.set(align="center", bold=True)
            p.write(dvote['name'].upper() + '\n')
            p.set(align="center", bold=False)
            p.writeln('VAT REG TIN ' + dvote['tin'])
            p.writeln(upper_case(dvote['address']))
            p.write('Accred No: ' + dvote['accredNo'] + '\n')
            p.write('Date Issued: ' + dvote['accredDateIssued'] + '\n')
            p.write('Valid Until: ' + '---' + '\n')
            p.write('PTU No: ' + dvote.get('PTUno', '---') + '\n')
            p.write('Date Issued: ' + dvote['ptuDateIssued'] + '\n\n')
            p.writeln()
            
    except Exception as e: 
        return {
            'message': 'Journaled (printer unavailable)',
            'error': repr(e)
        }

    if p.journal_error:
        print(f"[{get_local_time()}] [WARN] Ejournal error (receipt): {p.journal_error}")

    if p.error:
        print(f"[{get_local_time()}] [WARN] Printer error (receipt): {p.error}")
        return {
            'message': 'Journaled successfully (printer unavailable)' if not p.journal_error else 'Printed to printer, but ejournal write failed',
            'error': p.error if not p.journal_error else p.journal_error
        }
    if p.journal_error:
        return {
            'message': 'Printed successfully, but ejournal write failed',
            'error': p.journal_error
        }
    print(f"[{get_local_time()}] [OK] Receipt printed successfully")
    return { 'message': 'Printed successfully' }

def print_report(data: dict = {}):
    branch = data['branch']
    dvote = data['dvoteDetails'][0]
    type = data['type']

    timeInDate = None
    timeOutDate = None
    if(type == 'X_REPORT'):
        timeInDate = datetime.datetime.fromisoformat(data['timeIn'])
        if(data.get('timeOut') is not None):
            timeOutDate = datetime.datetime.fromisoformat(data['timeOut'])

    cashierReport = data if type == 'X_REPORT' else (data.get('cashierReport') or {})
    withdraw = get(cashierReport, 'withdraw', 0)
    sales = data if type == 'Z_REPORT' else data['sales']
    
    salesAdjustment = data['salesAdjustment']
    discountSummary = data['discountSummary']
    transactionSummary = data['transactionSummary']

    reprint = data.get('reprint') 
    reprintLabel = '(RE-PRINT)' if reprint else ''
    dateNow = get_local_time()

    try:
        with ReceiptWriter(data.get('settings', {}), journal=False) as p:
            p.set(align='center', bold=True)
            p.write(f'MMG-ALBAY\n\n')
            p.set(align='center', bold=False)
            p.write(f'Operated By: \n')
            p.set(align='center', bold=True)
            p.write(f'MEDICAL MISSION GROUP MULTIPURPOSE COOPERATIVE-ALBAY\n')
            p.set(align='center', bold=False)
            p.write('VAT REG TIN ' + branch['tin'] + '\n')
            p.write(upper_case(branch['streetAddress']) + '\n\n')

            p.set(align='center', bold=True)

            if(type == 'X_REPORT'):
                p.writeln(f'X-READING REPORT {reprintLabel}')
            else:
                p.writeln(f'Z-READING REPORT {reprintLabel}')

            p.set(align='left', bold=False)
            p.line()

            if(reprint):
                p.row("Reprint: ", dateNow.strftime("%Y-%m-%d %I:%M%p"))

            p.row("MIN: ", TERMINAL_MIN)
            p.row("SN: ", TERMINAL_SN)
            p.row("PTU No: ", TERMINAL_PTU_NO)

            if(type == 'X_REPORT'):
                cashier = data['cashier']
                p.row("Cashier: ", start_case(cashier["first_name"] + " " + cashier["last_name"]))
                
            p.row("Report Date: ", data["date"])
            if(type == 'X_REPORT'):
                timeOutDate = timeOutDate.strftime("%I:%M%p") if timeOutDate is not None else ''
                p.row("Time In: ", timeInDate.strftime("%I:%M%p"))
                p.row("Time Out: ", timeOutDate)
                
            p.row("Beg. Invoice #: ", str(sales["invoiceStartNumber"]).zfill(6))
            p.row("End. Invoice #: ", str(sales["invoiceEndNumber"]).zfill(6))
            if(type == 'Z_REPORT'):
                refund = sales.get('refundedNumber', {})
                cancel = sales.get('cancelledNumber', {})
                p.row("Beg. Cancel #: ", str(cancel.get('beginning', 0)).zfill(6))
                p.row("End. Cancel #: ", str(cancel.get('ending', 0)).zfill(6))
                p.row("Beg. Refund #: ", str(refund.get('beginning', 0)).zfill(6))
                p.row("End. Refund #: ", str(refund.get('ending', 0)).zfill(6))
                p.row("Z-Counter #: ", str(1))
                p.row("Reset Counter: ", "0")

                p.line()
                p.row("Present Accumulated Sales: ", sales['presentAccumulatedSales'])
                p.row("Previous Accumulated Sales: ", sales['previousAccumulatedSales'])
                p.row("Sales for the Day: ", sales['totalSalesWithoutMemberDiscount'])
                
            p.line()
            p.row("VATable Sales: ", "0")
            p.row("VAT-Exempt Sales: ", sales['totalSalesWithoutMemberDiscount'])
            p.row("Zero-Rated Sales: ", "0")
            p.row("Gross Sales: ", sales['totalSalesWithoutMemberDiscount'])
            p.row("Less Discount: ", sales["totalMemberDiscount"])
            p.row("Less Cancelled: ", salesAdjustment.get('cancelled', 0))
            p.row("Less Refunded: ", salesAdjustment.get('refunded', 0))
            # p.row("Less VAT Adjustment: ", 0)
            p.row("Net Sales: ", sales["totalNetSales"])

            if(type == 'Z_REPORT'):
                p.line()
                p.title("DISCOUNT SUMMARY")
                p.row("SC Discount: ", discountSummary.get('senior_citizen', 0))
                p.row("PWD Discount: ", discountSummary.get('pwd', 0))
                p.row("NAAC Discount: ", discountSummary.get('naac', 0))
                p.row("Solo Parent Discount: ", discountSummary.get('solo_parent', 0))
                
            p.line()
            p.title("SALES ADJUSTMENT")
            p.row("Cancel: ", salesAdjustment.get('cancelled', 0))
            p.row("Refund: ", salesAdjustment.get('refunded', 0))

            endingCashCount = data.get('endingCashCount')

            p.line()
            p.title("CASH IN DRAWER COUNT")
            if(endingCashCount is not None):

                def toFloat(i):
                    val = str(i).split('M')
                    if(len(val) >= 1):
                        val = val[1].replace('P', '.')
                        return float(val)
                    return 0.00
                    

                keys = list(endingCashCount.keys())
                keys = list(filter(lambda i: i.startswith('M'), keys))
                keys = list(map(toFloat, keys))
                keys = list(sorted(keys, reverse=True))

                for key in keys:
                    formattedKey = f'M{int(key)}' if key >= 1 else f'M{key}'.replace('.', 'P')
                    value = endingCashCount[formattedKey]
                    result = clip(value * key)
                    key = f'{clip(key)}:'
                    length = MAX_CHAR_PER_ROW - len(key) - len(result)
                    p.writeln(key + str(value).center(length) + result)

            p.line()
            p.title("TRANSACTION SUMMARY")
            p.row("Cash In Drawer: ", get(data, 'endingCashCount.total', 0))
            p.row("Cheque: ", transactionSummary.get('cheque', 0))
            p.row("Credit Card: ", 0)
            p.row("Gift Certificate: ", 0)
            p.row("Opening Fund: ", get(data, 'openingFund.total', 0))
            p.row("Less Withdrawal: ", withdraw)
            p.row("Payments Received: ", data.get('totalPayments', 0))
            p.row("Short/Over: ", sales.get('cashDifference', 0))

            p.writeln()
            p.set(align="center")
            p.writeln('Supplier:')
            p.set(align="center", bold=True)
            p.write(dvote['name'].upper() + '\n')
            p.set(align="center", bold=False)
            p.writeln('VAT REG TIN ' + dvote['tin'])
            p.write('Accred No: ' + dvote['accredNo'] + '\n')
            p.write('Date Issued: ' + dvote['accredDateIssued'] + '\n')
            p.write('Valid Until: ' + '---' + '\n')
            p.write('PTU No: ' + dvote.get('PTUno', '---') + '\n')
            p.write('Date Issued: ' + dvote['ptuDateIssued'] + '\n\n')
            
    except Exception as e:
        print(f"[{get_local_time()}] [ERR] Report print error: {repr(e)}")
        return {
            'message': 'Journaled (printer unavailable)',
            'error': repr(e)
        }

    if p.error:
        print(f"[{get_local_time()}] [WARN] Printer error (report): {p.error}")
        return {
            'message': 'Journaled successfully (printer unavailable)',
            'error': p.error
        }
    print(f"[{get_local_time()}] [OK] Report printed successfully")
    return { 'message': 'Printed successfully' }

def display_welcome():
    vfd = None
    try:
        vfd = get_display_device()
    except:
        pass
    
    if(vfd is None):
        return

    vfd.write("\x0C".encode())
    vfd.write('WELCOME TO'.center(20).encode())
    vfd.write("MMG-ALBAY!!".center(20).encode())
    
def display_message():
    vfd = get_display_device()
    vfd.write("\x0C".encode())
    vfd.write('WELCOME TO'.center(20).encode())
    vfd.write("MMG-ALBAY!!".center(20).encode())

    return { 'message': 'Displayed successfully' }

def display_item(data):
    item = data
    
    vfd = get_display_device()
    vfd.write("\x0C".encode())
    vfd.write('MMG-ALBAY'.ljust(20).encode())
    vfd.write(f'{item["name"][:11]:<12}{"{:.2f}".format(item["price"])[:8]:>8}'.encode())

    return { 'message': 'Displayed successfully' }

def display_total(data):
    total = data['total']
        
    vfd = get_display_device()
    vfd.write("\x0C".encode())
    vfd.write('TOTAL'.ljust(20).encode())
    vfd.write("{:.2f}".format(total).rjust(20).encode())

    return { 'message': 'Displayed successfully' }

def display_next():
    vfd = get_display_device()
    vfd.write("\x0C".encode())
    vfd.write('THANK YOU!'.center(20).encode())
    vfd.write('COME AGAIN!'.center(20).encode())
    time.sleep(5)

    vfd.write('WELCOME TO'.center(20).encode())
    vfd.write("MMG-ALBAY!!".center(20).encode())

    return { 'message': 'Displayed successfully' }


_req_ids = itertools.count(1)
_print_lock = None   # created on first use so it belongs to the server's event loop


async def _run_print_job(fn, data):
    """Printer jobs run strictly one at a time. Two tabs (or a double click) can't interleave
    their output on the paper or open two connections to the printer at once."""
    global _print_lock
    if _print_lock is None:
        _print_lock = asyncio.Lock()
    async with _print_lock:
        return await asyncio.to_thread(fn, data)


def _preview(message, limit=4000):
    """Request text for the log, truncated so one huge receipt can't flood helper.log."""
    text = message if isinstance(message, str) else repr(message)
    return text if len(text) <= limit else text[:limit] + f"... [{len(text) - limit} more chars]"


async def handler(websocket):
    client_address = websocket.remote_address
    display_welcome()
    print(f"[{get_local_time()}] [CONN] Client connected from: {client_address}")

    try:
        async for message in websocket:
            req_id = next(_req_ids)
            started = time.monotonic()
            data = None   # this request's payload; never a leftover from the previous message
            try:
                data = json.loads(message)
                device = data.get("device")
                dtype = data.get("device_type")

                print(f"[{get_local_time()}] [REQ #{req_id}] {device}/{dtype} from {client_address} ({len(message)} bytes) payload={_preview(message)}")

                ret = {}
                if device == "terminal" and dtype == "info":
                    ret = {"MIN": TERMINAL_MIN, "SN": TERMINAL_SN, "PTU_NO": TERMINAL_PTU_NO}
                if device == "printer" and dtype == "test":
                    ret = await _run_print_job(print_test, data)
                if device == "printer" and dtype == "receipt":
                    ret = await _run_print_job(print_receipt, data)
                if device == "printer" and dtype == "report":
                    ret = await _run_print_job(print_report, data)
                if device == "printer" and dtype == "ejournal":
                    ret = await _run_print_job(print_ejournal, data)
                if device == "display" and dtype == "message":
                    ret = await asyncio.to_thread(display_message, data)
                if device == "display" and dtype == "item":
                    ret = await asyncio.to_thread(display_item, data)
                if device == "display" and dtype == "total":
                    ret = await asyncio.to_thread(display_total, data)
                if device == "display" and dtype == "next":
                    ret = await asyncio.to_thread(display_next, data)

                if(ret == {}):
                    raise Exception(f"Unrecognized device/device_type combination: device={device!r}, device_type={dtype!r}")

                elapsed_ms = int((time.monotonic() - started) * 1000)
                status = "OK" if "error" not in ret else "FAILED"
                print(f"[{get_local_time()}] [RES #{req_id}] {device}/{dtype} {status} {elapsed_ms}ms response={_preview(json.dumps(ret), 1000)}")

                if data.get("request_id") is not None:
                    ret["request_id"] = data["request_id"]
                await websocket.send(json.dumps(ret))
            except json.JSONDecodeError as e:
                print(f"[{get_local_time()}] [ERR #{req_id}] JSON parse error: {e} | raw={_preview(message, 500)}")
                try:
                    await websocket.send(json.dumps({'error': 'Invalid JSON format'}))
                except:
                    pass
            except Exception as e:
                device = data.get("device", "unknown") if isinstance(data, dict) else "unknown"
                dtype = data.get("device_type", "unknown") if isinstance(data, dict) else "unknown"
                error_detail = f"{type(e).__name__}: {e}"
                elapsed_ms = int((time.monotonic() - started) * 1000)
                print(f"[{get_local_time()}] [ERR #{req_id}] {device}/{dtype} raised after {elapsed_ms}ms - {error_detail} | payload={_preview(message)}")
                print(traceback.format_exc())
                try:
                    reply = {'error': error_detail}
                    if isinstance(data, dict) and data.get("request_id") is not None:
                        reply["request_id"] = data["request_id"]
                    await websocket.send(json.dumps(reply))
                except:
                    pass
    except Exception as e:
        print(f"[{get_local_time()}] [DISC] Connection error from {client_address}: {e}")
    finally:
        print(f"[{get_local_time()}] [DISC] Client disconnected from: {client_address}")

def kill_existing_process(port=9999):
    import subprocess
    import platform
    no_window = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    try:
        if platform.system() == "Windows":
            # Find process on port
            result = subprocess.run('netstat -ano | findstr LISTENING', shell=True, capture_output=True, text=True, creationflags=no_window)
            pids_to_kill = []

            if result.stdout:
                for line in result.stdout.split('\n'):
                    parts = line.split()
                    # Local address is column 2; match the port exactly (not :19999 etc.)
                    if len(parts) >= 5 and parts[1].endswith(f':{port}'):
                        pid = parts[-1]
                        if pid.isdigit() and int(pid) != os.getpid():
                            pids_to_kill.append(pid)

            if pids_to_kill:
                for pid in pids_to_kill:
                    try:
                        print(f"[{get_local_time()}] [INFO] Killing existing process on port {port} (PID: {pid})")
                        subprocess.run(f'taskkill /PID {pid} /F', shell=True, capture_output=True, text=True, creationflags=no_window)
                        time.sleep(0.5)
                    except Exception as e:
                        print(f"[{get_local_time()}] [WARN] Failed to kill PID {pid}: {e}")
                time.sleep(1)
                print(f"[{get_local_time()}] [OK] Existing processes cleaned up")
            else:
                print(f"[{get_local_time()}] [INFO] No existing process on port {port}")
        else:
            result = subprocess.run(f'lsof -ti:{port}', shell=True, capture_output=True, text=True)
            if result.stdout:
                pids = result.stdout.strip().split('\n')
                for pid in pids:
                    if pid:
                        subprocess.run(f'kill -9 {pid}', shell=True, capture_output=True)
                time.sleep(1)
                print(f"[{get_local_time()}] [OK] Existing processes cleaned up")
    except Exception as e:
        print(f"[{get_local_time()}] [WARN] Could not kill existing process: {e}")

BACKOFF_SECONDS = (2, 5, 10, 30)   # retry delays; the last one repeats until it works


class HelperServer:
    """The WebSocket server, runnable on a background thread so the tray can own the main thread.

    If the server fails to start or dies (typically the port is busy at login), it retries with
    backoff until it works or stop() is called, and recovers on its own when the fault clears."""

    def __init__(self):
        self.thread = None
        self.loop = None
        self._stop = None
        self._halt = threading.Event()   # set by stop(): give up, do not retry
        self._ran = False                # reached "running" during the current attempt
        self.state = "stopped"           # stopped | starting | running | retrying
        self.error = None
        self.attempt = 0                 # failed attempts since the last time it was healthy
        self.port = None

    def start(self):
        if self.thread and self.thread.is_alive():
            return
        self._halt.clear()
        self.state, self.error, self.attempt = "starting", None, 0
        self.thread = threading.Thread(target=self._run, name="ws-server", daemon=True)
        self.thread.start()

    def _run(self):
        while not self._halt.is_set():
            self._ran = False
            try:
                asyncio.run(self._serve())
                if self._halt.is_set():
                    break
                raise RuntimeError("server exited unexpectedly")
            except Exception as e:
                self.error = f"{type(e).__name__}: {e}"
                print(f"[{get_local_time()}] [ERR] WebSocket server failed: {self.error}")
                if self.attempt == 0 or self._ran:   # full traceback once per outage, not every retry
                    print(traceback.format_exc())
            if self._ran:
                self.attempt = 0         # it was healthy for a while: start the backoff over
            delay = BACKOFF_SECONDS[min(self.attempt, len(BACKOFF_SECONDS) - 1)]
            self.attempt += 1
            self.state = "retrying"
            print(f"[{get_local_time()}] [WARN] Retrying WebSocket server in {delay}s (attempt {self.attempt})")
            if self._halt.wait(delay):
                break
        self.state = "stopped"

    async def _serve(self):
        self.loop = asyncio.get_running_loop()
        self._stop = asyncio.Event()
        try:
            port = CONFIG["ws_port"]
            kill_existing_process(port)
            async with serve(handler, "127.0.0.1", port):
                self.port, self.state, self.error, self._ran = port, "running", None, True
                print(f"[{get_local_time()}] [OK] WebSocket server listening on ws://127.0.0.1:{port}")
                await self._stop.wait()
        finally:
            self.loop = self._stop = None   # never leave a closed loop for stop() to poke

    def stop(self, timeout=5):
        self._halt.set()                     # also wakes a pending retry wait
        loop, stop_event = self.loop, self._stop
        if loop and stop_event:
            try:
                loop.call_soon_threadsafe(stop_event.set)
            except RuntimeError:
                pass                         # loop already closed
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout)

    def restart(self):
        self.stop()
        self.start()


def apply_config(server: "HelperServer"):
    """Reload config.json and restart the server (e.g. the WS port may have changed)."""
    reload_config()
    server.restart()


async def main():
    """Headless mode (--no-tray): run the server on the main thread."""
    port = CONFIG["ws_port"]
    kill_existing_process(port)
    async with serve(handler, "127.0.0.1", port) as server:
        print(f"[{get_local_time()}] [OK] WebSocket server listening on ws://127.0.0.1:{port}")
        await server.serve_forever()


def _set_admin_password_from_file(path: str) -> int:
    """Installer hook: set the provider password from a file, then delete the file.
    A file (not a command-line argument) so the password never shows up in the process list.
    Exit codes: 0 ok, 1 could not read the file, 2 password rejected or not saved."""
    import auth
    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            password = f.read().rstrip("\r\n")
    except OSError as e:
        print(f"[ERR] Could not read the password file: {e}")
        return 1
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
    try:
        auth.set_password(_DATA_DIR, password)
    except Exception as e:
        print(f"[ERR] Provider password not set: {e}")
        return 2
    print(f"[OK] Provider password set ({os.path.join(_DATA_DIR, 'secure', 'admin.json')})")
    return 0


if __name__ == "__main__":
    if "--set-admin-password-file" in sys.argv:
        idx = sys.argv.index("--set-admin-password-file")
        sys.exit(_set_admin_password_from_file(sys.argv[idx + 1]) if idx + 1 < len(sys.argv) else 1)
    print('Printer websocket running...')
    print(f"[{get_local_time()}] [INFO] Ejournal path: {EJOURNAL_PATH}")
    if "--no-tray" in sys.argv:
        asyncio.run(main())
    else:
        try:
            import tray
        except Exception as e:
            print(f"[{get_local_time()}] [WARN] Tray unavailable ({e}); running headless")
            asyncio.run(main())
        else:
            # Pass this module (not `import app`) so the tray shares our globals instead of re-importing.
            tray.run(sys.modules[__name__], HelperServer())
