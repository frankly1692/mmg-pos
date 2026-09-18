
from datetime import datetime
from enum import Enum
from itertools import groupby
from typing import List, Optional
from pydantic import BaseModel, Field, computed_field, model_validator
from app.new_models.Discount import MemberType, Discount
from app.new_models.Labtest import Labtest
from app.new_models.Package import Package, PackageType
from app.utils.utils import getLocalDateStr, getLocalTimeStr


class TransactionStatus(str, Enum):
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    REFUNDED = "refunded"
    HOLD = "hold"

class TransactionDiscount(Discount):
    packageType: Optional[PackageType] = Field(default=PackageType.PACKAGE)
    packageId: Optional[str] = None

    @model_validator(mode='after')
    def requirePackageIdWhenPromo(self):
        if(self.packageType == PackageType.PROMO and self.packageId is None):
            raise ValueError(f'PackageId should not be none when package type is {PackageType.PROMO}')
        return self
    

class TransactionDiscountQuery(BaseModel):
    memberType: Optional[MemberType] = None
    name: Optional[str] = None
    status: Optional[TransactionStatus] = TransactionStatus.COMPLETED


class TransactionPackage(Package):
    discount: Optional[TransactionDiscount] = None

class TenderType(str, Enum):
    CASH = "cash"
    CHEQUE = "cheque"

class Tender(BaseModel):
    type: TenderType = TenderType.CASH
    amount: float

class ChequeTender(Tender):
    type: TenderType = TenderType.CHEQUE
    chequeNumber: str
    accountNumber: str
    accountName: str
    bankName: str
    branchName: str
    amount: float

class TransactionItem(Labtest):
    package: Optional[Package] = None


class BaseTransaction(BaseModel):
    transactionNumber: Optional[str] = None
    status: TransactionStatus = TransactionStatus.COMPLETED
    date: str = Field(default_factory=getLocalDateStr)
    transactionDate: str = Field(default_factory=getLocalTimeStr)
    transactionItems: List[TransactionItem] = Field(min_length=1)
    discounts: List[TransactionDiscount] = None
    invoiceNumber: int = None

    @model_validator(mode='after')
    def shouldZeroOrOnePackageDiscount(self):
        discounts = self._filterDiscounts(lambda i: i.packageType == PackageType.PACKAGE)
        discountsCount = len(discounts)
        if(discountsCount > 1):
            raise ValueError(f'Package Discount should be only 0 or one. (PackageDiscountCount={discountsCount})')
        return self

    @computed_field
    @property
    def totalGrossSales(self) -> float:
        return self._sum(self._getItemPrices(self.transactionItems))

    @computed_field
    @property
    def totalNetSales(self) -> float:
        packageNetSales = self._computeTotalPackageNetSales()
        promoNetSales = self._computeTotalPromoNetSales()
        return packageNetSales + promoNetSales
    
    @computed_field
    @property
    def totalSalesWithoutMemberDiscount(self) -> float:
        packageSales = self._computeTotalPackageNetSalesWithoutMemberDiscount()
        promoNetSales = self._computeTotalPromoNetSales()
        return packageSales + promoNetSales

    @computed_field
    @property
    def totalDiscount(self) -> float:
        return self.totalGrossSales - self.totalNetSales

    @computed_field
    @property
    def totalMemberDiscount(self) -> float:
        packageSales = self._computeTotalPackageGrossSales()
        totalDiscount = self._computeTotalMemberDiscount(packageSales)
        return totalDiscount
    
    
    @property
    def transactionDateObject(self) -> datetime:
        return datetime.fromisoformat(self.transactionDate)
    
    def _computeTotalMemberDiscount(self, totalSales) -> float:
        discounts = self._filterDiscounts(lambda i: i.memberType is not None)
        totalDiscount = self._sumTotalDiscount(discounts, totalSales)
        return totalDiscount
    
    def _computeTotalPackageNotMemberDiscount(self, totalSales) -> float:
        return self._computeTotalDiscount(lambda i: i.packageType == PackageType.PACKAGE and i.memberType is None, totalSales)
    
    def _computeTotalPackageDiscount(self, totalSales) -> float:
        return self._computeTotalDiscount(lambda i: i.packageType == PackageType.PACKAGE, totalSales)

    def _computeTotalPackageNetSales(self) -> float:
        packageSales = self._computeTotalPackageGrossSales()
        totalDiscount = self._computeTotalPackageDiscount(packageSales)
        return packageSales - totalDiscount
    
    def _computeTotalPackageNetSalesWithoutMemberDiscount(self) -> float:
        packageSales = self._computeTotalPackageGrossSales()
        totalDiscount = self._computeTotalPackageNotMemberDiscount(packageSales)
        return packageSales - totalDiscount

    def _computeTotalPackageGrossSales(self) -> float:
        items = self._filterItemsByNotType(PackageType.PROMO)
        totalPrice = self._sum(self._getItemPrices(items))

        return totalPrice
    
    def _computeTotalPromoNetSales(self) -> float:
        totalPromoPrice: float = 0.0

        items = self._filterItems(lambda i: i.package is not None and i.package.type == PackageType.PROMO)
        items = groupby(items, lambda i: i.package.id)
    
        for _, groupItems in items:
            groupItems = list(groupItems)
            discounts = self._filterDiscounts(lambda i: i.packageId == groupItems[0].package.id)

            prices = self._getItemPrices(groupItems)
            totalPrice = self._sum(prices)

            if(len(discounts) > 0):
                discount = discounts[0]
                totalPrice -= discount.calculateTotalDiscount(totalPrice)

            totalPromoPrice += totalPrice
            
        return totalPromoPrice
    
    def _computeTotalDiscount(self, func, totalSales) -> float:
        discounts = self._filterDiscounts(func)
        totalDiscount = self._sumTotalDiscount(discounts, totalSales)
        return totalDiscount
   
    def _filterItems(self, func) -> List[TransactionItem]:
        return list(filter(func, self.transactionItems))

    def _filterItemsByNotType(self, type: PackageType) -> List[TransactionItem]:
        #Filter all items that exactly unmatch with type even if item package is none
        return self._filterItems(lambda i: i.package is None or i.package.type != type)
    
    def _filterItemsByPackage(self, packageId: str, type: PackageType) -> List[TransactionItem]:
        #Short circuit - filter all items that package is not none and match with id and type
        return self._filterItems(lambda i: i.package is not None and (i.package.id == packageId and i.package.type == type))

    def _filterDiscounts(self, func) -> List[TransactionDiscount]:
        if(self.discounts == None):
            return []
        return list(filter(func, self.discounts))
    
    def _getItemPrices(self, items: List[TransactionItem]):
        return list(map(lambda i: i.price, items))
    
    def _getDiscountValues(self, discounts: List[TransactionDiscount], sales: float):
        values: List[float] = []
        for discount in discounts:
            values.append(discount.calculateTotalDiscount(sales))
        return values
    
    def _sumTotalDiscount(self, discounts: List[TransactionDiscount], sales: float):
        discounts = self._getDiscountValues(discounts, sales)
        return self._sum(discounts)
    
    def _sum(self, items):
        sum: float = 0
        for item in items:
            sum += item
        return sum

class Transaction(BaseTransaction):
    branch: object
    customer: object
    cashier: object
    referredBy: Optional[object] = None
    requestedBy: Optional[object] = None

class CreateTransaction(BaseTransaction):
    branchId: str
    customerId: str
    cashierId: str
    referredById: Optional[str] = None
    requestedById: Optional[str] = None

class CreateChequeTransaction(CreateTransaction):
    tender: Optional[ChequeTender] = None

    @computed_field
    @property
    def change(self) -> Optional[float]:
        if(self.tender is None):
            return None
        return self.tender.amount - self.totalNetSales

class CreateCashTransaction(CreateTransaction):
    tender: Optional[Tender] = None

    @computed_field
    @property
    def change(self) -> Optional[float]:
        if(self.tender is None):
            return None
        return self.tender.amount - self.totalNetSales

class ContinueTransaction(BaseModel):
    branchId: str
    invoiceNumber: int
    cashierId: str
    
class CreateCancelledTransaction(BaseModel):
    reason: Optional[str] = None
    branchId: str
    invoiceNumber: int
    transactionNumber: Optional[int] = None
    status: TransactionStatus

class CreateRefundTransaction(CreateTransaction):
    reason: Optional[str] = None
    refundedInvoiceNumber: int
