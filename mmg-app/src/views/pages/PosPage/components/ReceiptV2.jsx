import React from 'react';
import { Divider, Stack, Typography, Box, Grid, Table, TableBody, TableRow, TableCell } from '@mui/material';
import { dvoteDetails } from 'utils/mockData';
import moment from 'moment';
import { startCase, toLower, upperCase } from 'lodash';

export default function ({ transaction }) {
    const computeDiscount = (discount, sale) => {
        if (discount.type == "fixed")
            return discount.value

        return sale * (discount.value / 100)
    }

    const address = transaction.customer.address

    const isCompleted = transaction.status == 'completed'

    const discounts = transaction.discounts.filter(item => !!item.memberType)

    console.log('transaction', discounts)

    return (
        <Box sx={{ p: 3, border: '1px solid #000' }}>
            <Typography variant="h3" align="center" mb={1}>
                MMG ALBAY
            </Typography>
            <Typography fontStyle='italic' align='center'>
                Operated By:
            </Typography>
            <Typography fontWeight='regular' align="center">
                Medical Mission Group Multipurpose Cooperative-Albay
            </Typography>
            <Typography align="center">
                VAT REG TIN {transaction.branch.tin}
            </Typography>
            <Typography align="center" mb={2}>
                {transaction.branch.streetAddress}
                {/* BLDG. 216 ZIGA AVENUE TAYHI (POB.) 4511 CITY OF TABACO ALBAY */}
            </Typography>
            <Typography variant="h3" align="center" color='primary.main' mb={2}>
                {isCompleted ? 'SERVICE INVOICE' : (transaction.status.toUpperCase() + ' TRANSACTION')}
            </Typography>
            <Divider />
            <Box sx={{ paddingY: '16px' }}>
                {isCompleted || !transaction?.serialNumber ? (
                    <Stack direction="row" justifyContent="space-between">
                        <Typography>Invoice Number:</Typography>
                        <Typography>{String(transaction?.invoiceNumber).padStart(6, '0')}</Typography>
                    </Stack>
                ) : (
                    <Stack direction="row" justifyContent="space-between">
                        <Typography>Serial Number:</Typography>
                        <Typography>{String(transaction?.serialNumber).padStart(6, '0')}</Typography>
                    </Stack>
                )}

                {!isCompleted && transaction?.serialNumber && (
                    <Stack direction="row" justifyContent="space-between">
                        <Typography>Reference Number:</Typography>
                        <Typography>{String(transaction?.invoiceNumber).padStart(6, '0')}</Typography>
                    </Stack>
                )}
                <Stack direction="row" justifyContent="space-between">
                    <Typography>MIN:</Typography>
                    <Typography >---</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography>SN:</Typography>
                    <Typography>---</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography>Date:</Typography>
                    <Typography>{moment(transaction?.transactionDate).format('YYYY-MM-DD hh:mmA')}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography>Cashier:</Typography>
                    <Typography >{startCase(toLower(`${transaction.cashier.first_name} ${transaction.cashier.last_name}`))}</Typography>
                </Stack>
            </Box>
            <Divider />
            <Box sx={{ paddingY: '16px' }}>
                <Typography variant="h5" align="center" mb={1}>
                    SOLD TO
                </Typography>
                <Stack direction="row" justifyContent="space-between">
                    <Typography>Name:</Typography>
                    <Typography >{startCase(toLower(`${transaction.customer.first_name} ${transaction.customer.last_name}`))}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography>Address:</Typography>
                    <Typography sx={{ textAlign: 'right' }}>
                        {startCase(toLower(`${address?.street} ${address?.barangay} ${address?.cityMunicipality} ${address?.province}`)).substring(0, 12)}
                    </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography>TIN:</Typography>
                    <Typography>{transaction.customer.tin_number}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography>Age:</Typography>
                    <Typography>{transaction.customer.age}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography>Birthdate:</Typography>
                    <Typography>{moment(transaction.customer.birthDate).format('YYYY-MM-DD')}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography>Requested By:</Typography>
                    <Typography>{transaction?.requestedByName ? transaction?.requestedByName : '---'}</Typography>
                </Stack>
                {/* <Stack direction="row" justifyContent="space-between">
                    <Typography>(SC/PWD/NAAC/SP) ID No.:</Typography>
                    <Typography variant="h6">{combinedData.customer.customerTypeId || '---'}</Typography>
                </Stack> */}
            </Box>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ mb: 1 }}>
                <Grid mb={1} container direction="row" justifyContent="space-between" >
                    <Grid item xs={6}>
                        <Typography variant="h5" fontWeight='regular'>ITEM DESCRIPTION</Typography>
                    </Grid>
                    <Grid item xs={2}>
                        <Typography variant="h5" fontWeight='regular'>QTY</Typography>
                    </Grid>
                    <Grid item xs={2}>
                        <Typography variant="h5" fontWeight='regular'>UNIT PRICE</Typography>
                    </Grid>
                    <Grid item xs={2}>
                        <Typography variant="h5" align='right' fontWeight='regular'>AMOUNT</Typography>
                    </Grid>
                </Grid>
                <Divider sx={{ mb: 2 }} />

                <Grid container>
                    {Object.values(Object.groupBy(transaction?.transactionItems, value => value.package?._id))
                        .map((transactionItems, index, array) => {
                            const pack = transactionItems[0]?.package
                            const discount = transaction.discounts.filter(item => pack?._id ? item.packageId == pack._id : true)?.[0]

                            return (
                                <>
                                    {pack && (
                                        <Grid item xs={12}>
                                            <Typography variant="h5" fontWeight='medium' >
                                                {`> ${pack.name}`}
                                            </Typography>
                                        </Grid>
                                    )}

                                    {transactionItems.map((item) => (
                                        <>
                                            <Grid item xs={6}><Typography ml={pack ? 3 : 0}>{item.name}</Typography></Grid>
                                            <Grid item xs={2}><Typography >({item.quantity})</Typography></Grid>
                                            <Grid item xs={2}>
                                                <Typography>
                                                    {transaction.status != 'completed' && <>- </>}
                                                    {item.price.toFixed(2)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={2}>
                                                <Typography align='right'>
                                                    {transaction.status != 'completed' && <>- </>}
                                                    {item.price.toFixed(2)}
                                                </Typography>
                                            </Grid>
                                        </>
                                    ))}
                                    {
                                        pack && discount && !discount?.memberType && (
                                            <Grid item xs={12} mb={1}>
                                                <Stack direction='row' justifyContent='space-between' alignItems='center'>
                                                    <Typography ml={3} variant="h5" fontWeight='regular' >
                                                        - Less: {discount.name} Discount
                                                    </Typography>
                                                    <Typography variant="h5" fontWeight='regular'>- {computeDiscount(discount, transaction.totalGrossSales).toFixed(2)}</Typography>
                                                </Stack>
                                            </Grid>
                                        )
                                    }
                                </>
                            );
                        })}
                </Grid>
            </Box>
            {/* {
                transaction?.status != 'completed' && (
                    <>
                        <Divider />
                        <Box align="center" sx={{ paddingTop: '16px' }}>
                            <Typography variant='subtitle2' fontWeight='bold'>***{transaction.status.toUpperCase()} TRANSACTION***</Typography>
                        </Box>
                    </>
                )
            } */}
            <Box sx={{ paddingY: '16px' }}>
                <Divider sx={{ mb: 2 }} />
                <Stack direction="row" justifyContent="space-between">
                    <Typography color='black' fontWeight='bold'>Total Sales:</Typography>
                    <Typography color='black' fontWeight='bold'>{transaction.totalSalesWithoutMemberDiscount.toFixed(2)}</Typography>
                </Stack>
                {discounts.length > 0 ? (
                    <>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography>Less Discount: </Typography>
                        </Stack>
                        <Stack sx={{ ml: 3 }} direction="row" justifyContent="space-between">
                            <Typography>- {discounts[0].value}% {startCase(discounts[0].memberType)}: </Typography>
                            <Typography variant="h5">
                                {transaction.totalMemberDiscount.toFixed(2)}
                            </Typography>
                        </Stack>
                    </>
                ) : (
                    <>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography>Less Discount: </Typography>
                            <Typography variant="h5">
                                0.00
                            </Typography>
                        </Stack>
                    </>
                )}
                <Stack direction="row" justifyContent="space-between">
                    <Typography>Net Sales:</Typography>
                    <Typography variant='h5'>{transaction.totalNetSales.toFixed(2)}</Typography>
                </Stack>
                <Divider sx={{ my: 1 }} />

                <Stack direction="row" justifyContent="space-between">
                    <Typography>Vatable Amount:</Typography>
                    <Typography variant="h5">
                        0.00
                    </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography>Vat Exempt Amount</Typography>
                    <Typography variant="h5">
                        {transaction.totalNetSales.toFixed(2)}
                    </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography>12% Vat</Typography>
                    <Typography variant="h5">
                        0.00
                    </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" mb={1}>
                    <Typography color='black' fontWeight='bold'>TOTAL AMOUNT DUE:</Typography>
                    <Typography variant="h5" color='black' fontWeight='bold'>{transaction.totalNetSales.toFixed(2)}</Typography>
                </Stack>

                <Divider sx={{ my: 1 }} />
                <Stack direction="row" justifyContent="space-between">
                    <Typography>Tender Amount:</Typography>
                    <Typography variant="h5">{transaction.tender?.amount?.toFixed(2)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography>Tender Type:</Typography>
                    <Typography variant="h5">{transaction?.tender?.type?.toUpperCase()}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography>Change:</Typography>
                    <Typography variant="h5">{transaction.change?.toFixed()}</Typography>
                </Stack>
                {/* <Stack direction="row" justifyContent="space-between">
                    <Typography>Number of Items:</Typography>
                    <Typography variant="h5">{totalQuantity}</Typography>
                </Stack> */}
                {
                    !isCompleted && (
                        <Stack direction="row" justifyContent="space-between">
                            <Typography>Reason: </Typography>
                            <Typography variant="h5">{transaction?.reason || '---'}</Typography>
                        </Stack>
                    )
                }
            </Box>

            {discounts.length > 0 && (
                <Box border={1} borderColor='grey.300'>
                    <Table

                        sx={{
                            '& .MuiTableCell-root': {
                                fontSize: '14px',
                                px: 1,
                                py: 0.4,
                                color: 'black'
                            },
                            'backgroundColor': 'transparent'
                        }}
                    >
                        <TableBody>
                            <TableRow>
                                <TableCell sx={{ lineHeight: 1 }}>
                                    ID Number:
                                </TableCell>
                                <TableCell width='40%' align='right'>
                                    {transaction.totalMemberDiscount > 0 && transaction.customer.customer_type_id}
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell sx={{ lineHeight: 1 }}>
                                    Signature:
                                </TableCell>
                                <TableCell align='right'>
                                    -
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </Box>
            )}
            {/* <Box align="center" mt={2} sx={{ paddingY: '16px' }}>
                <Typography variant="h5">(SC/PWD/NAAC/SP) Signature:</Typography>
                <Box sx={{ border: '1px solid #000', height: '50px', marginBottom: '10px' }}></Box>
            </Box> */}

            <Box align="center" sx={{ paddingY: '16px' }}>
                <Typography variant="h5"  >SUPPLIER</Typography>
                <Typography variant="h6">Name: {dvoteDetails[0]?.name}</Typography>
                <Typography variant="h6">Address: {dvoteDetails[0]?.address}</Typography>
                <Typography variant="h6">Vat Reg Tin: {dvoteDetails[0]?.tin}</Typography>
                <Typography variant="h6">Accred. No: {dvoteDetails[0]?.accredNo}</Typography>
                <Typography variant="h6">Date Issued: {dvoteDetails[0]?.accredDateIssued}</Typography>
                <Typography variant="h6">Valid Until: ---</Typography>
                <Typography variant="h6">PTU No: {dvoteDetails[0]?.ptuNo}</Typography>
                <Typography variant="h6">Date Issued: {dvoteDetails[0]?.ptuDateIssued}</Typography>
            </Box>

        </Box>
    );
};

