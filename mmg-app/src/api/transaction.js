import { server } from 'api';
import { omit } from 'lodash';

export const TRANSACTION_ENDPOINTS = '';

async function CreateTransaction(model) {
    const { data: { data } } = await server.post('/transaction/create', model)
    // const { data: { data } } = await server.post('/v2/transactions', model)
    return data;
}

async function CreateTransactionV2(model) {
    const items = model.items || []

    let discounts = items
        .filter(s => s.source != 'labTest')
        .filter(s => s.discount != null)
        .map(s => ({
            ...s.discount,
            packageId: s._id,
            packageType: s.packageType,
        }))
        // .filter(s => {
        //     if(model.discountApplied) {
        //        result = s.packageType == "package" && s.discount != null && model.discountApplied

        //        return result
        //     }
        //     return false
        // })
    
        
    if(model.discountApplied) {
        const existing = discounts.find(discount => discount.name == model.discountApplied.name)

        if(!existing) {
            discounts = discounts.filter(discount => discount.packageType != 'package')
            discounts = [
                ...discounts, 
                model.discountApplied
            ]
        }
    }

    const transactionItems = items
        .reduce((prev, curr) => {

            if(curr.source == 'labTest') 
                return [...prev, curr]
            
            return ([
                ...prev,
                ...curr.labTest.map(i => 
                    ({ 
                        ...i, 
                        categoryId: i.category?.id,
                        package: {
                            ...omit(curr, 'labTest'),
                            type: curr.packageType,
                            discount: {
                                ...curr.discount,
                            },
                        } 
                    }))
            ])
        }, [])
    // throw "error"

    const params = {
        branchId: model.branchId,
        discounts,
        transactionItems,
        customerId: model.customerData.id,
        status: model.status.toLowerCase(),
        ptuNumber: model.ptuNumber,
        idempotencyKey: model.idempotencyKey,
        // Present only when paying a transaction restored from a hold (see
        // PosComponent.jsx: handleRestoreTransaction) — tells the backend to convert that hold
        // document in place instead of inserting a second, disconnected completed transaction.
        holdTransactionId: model.holdTransactionId,
        tender: model.paymentDetails ? {
            ...model.paymentDetails,
            amount: model.paymentDetails.tenderAmount,
            type: model.paymentDetails.tenderType.toLowerCase()
        } : null
    }

    const { data: { data } } = await server.post('/v3/transactions', params)
    return data;
}


async function CancelTransaction(model) {
    const {
        data: { data }
    } = await server.post('/v3/transactions/cancel', model);

    return data;
}


async function GetAllTransaction(params) {
    const { data: { data } } = await server.get(TRANSACTION_ENDPOINTS + '/v2/transactions', {
        params
    })
    return data;
}

async function GetActiveTransaction() {
    const { data: { data } } = await server.get(TRANSACTION_ENDPOINTS + '/v2/transaction/active')
    return data;
}

async function UpdateTransaction(model) {
    const {
        data: { data }
    } = await server.post('/transaction/edit', model);

    return data;
}

async function GetTransaction(transactionId) {
    const {
        data: { data }
    } = await server.get(`${TRANSACTION_ENDPOINTS}/transaction?id=${transactionId}`);
    return data;
}

async function GetSales(createdBy, branchId) {
    const {
        data: { data }
    } = await server.get(`${TRANSACTION_ENDPOINTS}/reports/sales?cashierId=${createdBy}&branchId=${branchId}`);
    return data;
}

async function GetTotalSales(createdBy, branchId) {
    const { data } = await server.get(`${TRANSACTION_ENDPOINTS}/reports/sales?cashierId=${createdBy}&branchId=${branchId}`);
    const totalSale = {
        totalSale: data?.total
    };
    return totalSale;
}

export default {
    GetAllTransaction,
    UpdateTransaction,
    CreateTransaction,
    CancelTransaction,
    CreateTransactionV2,
    GetActiveTransaction,
    GetTransaction,
    GetSales,
    GetTotalSales
};
