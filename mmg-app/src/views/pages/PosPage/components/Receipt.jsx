import React, { useRef, forwardRef } from 'react';
import { Divider, Stack, Typography, Button, Box, Grid, Table, TableBody, TableRow, TableCell } from '@mui/material';
import axios from 'axios';
import { dvoteDetails } from 'utils/mockData';
import PropTypes from 'prop-types'; // Import PropTypes
import { useMutation } from 'react-query';
import print from 'api/print';
import moment from 'moment';
import { startCase, toLower, toUpper } from 'lodash';
import SplitButton from 'ui-component/buttons/SplitButton';

const ReceiptContent = ({ combinedData, amountGiven, change, tenderType, showAddress, }) => {

    const computeDiscount = (discount, sale) => {
        if(discount.type == "fixed")
            return discount.value

        return sale * (discount.value / 100)
    }

    return (
        <Box sx={{ p: 3, border: '1px solid #000' }}>
            <Typography variant="h3" align="center" mb={1}>
                MMG ALBAY
            </Typography>
            <Typography variant="subtitle2" fontStyle='italic' align='center'>
                Operated By:
            </Typography>
            <Typography variant="h5" align="center">
                Medical Mission Group Multipurpose Cooperative-Albay
            </Typography>
            <Typography variant="subtitle2" align="center">
                VAT REG TIN {combinedData?.branchTIN}
            </Typography>
            <Typography variant="subtitle2" align="center" mb={2}>
                {combinedData?.branchAddress}
                {/* BLDG. 216 ZIGA AVENUE TAYHI (POB.) 4511 CITY OF TABACO ALBAY */}
            </Typography>
            <Typography variant="h3" align="center" color='primary.main' mb={2}>
                INVOICE
            </Typography>
            <Divider />
            <Box sx={{ paddingY: '16px' }}>
                <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2" color='primary.main'>Invoice No.:</Typography>
                    <Typography variant="h5" color='primary.main'>{String(combinedData?.invoiceNumber).padStart(6, '0')}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2">MIN:</Typography>
                    <Typography variant="h5">---</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2">SN:</Typography>
                    <Typography variant="h5">---</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2">Date & Time:</Typography>
                    <Typography variant="h5">{moment(combinedData?.transactionDate).format('MM-DD-YYYY hh:mmA')}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2">Cashier:</Typography>
                    <Typography variant="h5">{combinedData?.cashierName}</Typography>
                </Stack>
            </Box>
            <Divider />
            <Box sx={{ paddingY: '16px' }}>
                <Typography variant="h5" align="center" mb={1}>
                    SOLD TO
                </Typography>
                <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2">Name:</Typography>
                    <Typography variant="h6">{startCase(toLower(combinedData?.customerData?.name))}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2">Address:</Typography>
                    <Typography variant="h6" sx={{ textAlign: 'right' }}>
                        {startCase(toLower(combinedData?.customerData?.address))}
                    </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2">TIN:</Typography>
                    <Typography variant="h6">{combinedData?.customerData?.tin}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2">Age:</Typography>
                    <Typography variant="h6">{combinedData?.customerData?.age}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2">Birthdate:</Typography>
                    <Typography variant="h6">{combinedData?.customerData?.birthDate}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2">Requested By:</Typography>
                    <Typography variant="h6">{combinedData?.requestedByName ? combinedData?.requestedByName : '---'}</Typography>
                </Stack>
   
            </Box>
            <Divider sx={{ mb: 1 }}/>
            <Box sx={{ mb: 1 }}>
                <Grid mb={1} container direction="row" justifyContent="space-between" >
                    <Grid item xs={6}>
                        <Typography variant="h5">ITEM DESCRIPTION / <br /> NATURE OF SERVICE</Typography>
                    </Grid>
                    <Grid item xs={2}>
                        <Typography variant="h5" >QTY</Typography>
                    </Grid>
                    <Grid item xs={2}>
                        <Typography variant="h5" >UNIT PRICE</Typography>
                    </Grid>
                    <Grid item xs={2}>
                        <Typography variant="h5" align='right'>AMOUNT</Typography>
                    </Grid>
                </Grid>
                <Divider sx={{ mb: 2 }} />

                <Grid container>
                    {combinedData?.items.map((service, index) => {
                        const isLabTest = service.source === 'labTest';

                        return (
                            <>
                                <Grid item xs={12}>
                                    {!isLabTest && (
                                        <Typography variant="h5" fontWeight='medium' >
                                            {`> ${service.name}`} 
                                        </Typography>
                                    )}
                                </Grid>
                                {!isLabTest ? service.labTest.map((pkgItem) => (
                                    <>
                                        <Grid item xs={6}><Typography ml={3}>{pkgItem.name}</Typography></Grid>
                                        <Grid item xs={2}><Typography >({pkgItem.qty})</Typography></Grid>
                                        <Grid item xs={2}>
                                            <Typography align='right'>
                                                {combinedData.status != 'Completed' && <>- </>}
                                                {pkgItem.amount.toFixed(2)}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={2}>
                                            <Typography align='right'>
                                                {combinedData.status != 'Completed' && <>- </>}
                                                {pkgItem.amount.toFixed(2)}
                                            </Typography>
                                        </Grid>
                                    </>
                                )) : (
                                    <>
                                        <Grid item xs={6}><Typography>{service.name}</Typography></Grid>
                                        <Grid item xs={2}><Typography >({service.qty})</Typography></Grid>
                                        <Grid item xs={2}>
                                            <Typography align='right'>
                                                {combinedData.status != 'Completed' && <>- </>}
                                                {service.amount.toFixed(2)}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={2}>
                                            <Typography align='right'>
                                                {combinedData.status != 'Completed' && <>- </>}
                                                {service.amount.toFixed(2)}
                                            </Typography>
                                        </Grid>
                                    </>
                                )}
                                {
                                    combinedData.status === 'Completed' && service.discount && service.packageForMemberType != "seniorcitizenpwd" && (
                                        <Grid item xs={12} mb={1}>
                                            <Stack direction='row' justifyContent='space-between' alignItems='center'>
                                                <Typography ml={3} variant="h5" fontWeight='regular' >
                                                    - Less: {service.discount.name} Discount
                                                </Typography>
                                                <Typography variant="h5" fontWeight='regular'>- {computeDiscount(service.discount, combinedData?.paymentDetails?.subTotal).toFixed(2)}</Typography>
                                            </Stack>
                                        </Grid>
                                    )
                                }
                            </>
                        );
                    })}
                </Grid>
            </Box>
            {
                combinedData?.status != 'Completed' && (
                    <>
                        <Divider />
                        <Box align="center" sx={{ paddingY: '16px' }}>
                            <Typography variant='subtitle2' fontWeight='bold'>***{combinedData?.status.toUpperCase()} TRANSACTION***</Typography>
                        </Box>
                    </>
                )
            }
            <Box sx={{ paddingY: '16px' }}>
                {
                    combinedData?.status == 'Completed' && (
                        <>
                            <Divider sx={{ mb: 2 }} />
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="subtitle2" color='black' fontWeight='bold'>Total Sales:</Typography>
                                <Typography variant="subtitle2" color='black' fontWeight='bold'>{combinedData?.subTotal?.toFixed(2) || '---'}</Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="subtitle2">Less: Discount (SC/PWD/NAAC/SP)</Typography>
                                <Typography variant="h5">
                                    {combinedData?.paymentDetails ? `(${combinedData?.totalMemberDiscount ? combinedData?.totalMemberDiscount.toFixed(2) : 0})` : '---'}
                                </Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="subtitle2">Less: Withholding Tax</Typography>
                                <Typography variant="h5">(0)</Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between" mb={1}>
                                <Typography variant="subtitle2" color='black' fontWeight='bold'>TOTAL AMOUNT DUE:</Typography>
                                <Typography variant="h5" color='black' fontWeight='bold'>{combinedData?.paymentDue?.toFixed(2) || '---'}</Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="subtitle2">Tender Amount:</Typography>
                                <Typography variant="h5">{amountGiven?.toFixed(2) || '---'}</Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="subtitle2">Tender Type:</Typography>
                                <Typography variant="h5">{tenderType?.toUpperCase()}</Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="subtitle2">Change:</Typography>
                                <Typography variant="h5">{change?.toFixed(2)|| '---'}</Typography>
                            </Stack>
                            {/* <Stack direction="row" justifyContent="space-between">
                                <Typography variant="subtitle2">Number of Items:</Typography>
                                <Typography variant="h5">{totalQuantity}</Typography>
                            </Stack> */}
                        </>
                    )
                }
                {
                    combinedData?.status != 'Completed' && (
                            <>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="subtitle2">Total Amount: </Typography>
                                <Typography variant="h5">{combinedData?.subTotal.toFixed(2) || '---'}</Typography>
                            </Stack>
                            {
                                combinedData?.status == 'Refunded' && (
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="subtitle2">Previous Invoice Number: </Typography>
                                
                                        <Typography variant="h5">{combinedData?.previousInvoiceNumber || '---'}</Typography>
                                    </Stack>

                                )
                            }
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="subtitle2">Reason: </Typography>
                                <Typography variant="h5">"{combinedData?.reason || combinedData.refundedReason || '---'}"</Typography>
                            </Stack>
                        </>
                    )
                }
            </Box>
            <Box mb={2} align="center" sx={{ py: 2 }}>
                <Typography variant='subtitle2' color='black' fontWeight='bold'>*THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX*</Typography>
            </Box>
            <Box border={1} borderColor='grey.400'>
                <Table 
                    border={1} 
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
                                ID No. : <br />
                                <Typography variant="caption" fontStyle='italic' >
                                    (SC/PWD/NAAC/SP)
                                </Typography>
                            </TableCell>
                            <TableCell width='40%' align='right'>
                                {combinedData?.customerData?.customerTypeId}
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{ lineHeight: 1 }}>
                                Signature: <br />
                                <Typography variant="caption" fontStyle='italic' >
                                    (SC/PWD/NAAC/SP)
                                </Typography>
                            </TableCell>
                            <TableCell align='right'></TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </Box>
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
            </Box>
           
        </Box>
    );
};

const Receipt = ({ data, combinedData, amountGiven, change, tenderType, setReceiptOpen, handleBack, ...others }) => {
    const componentRef1 = useRef();
    // const componentRef2 = useRef();
    // const componentRef3 = useRef();

    const { mutateAsync: printAsync } = useMutation(print.Print)
    const totalQuantity = combinedData?.items.reduce((acc, itemGroup) => {
        // Check if the itemGroup is from a package or not
        if (itemGroup.source === 'package') {
            // Sum the quantities of all items within the package
            const packageQuantity = itemGroup.labTest.reduce((packageAcc, item) => packageAcc + item.qty, 0);
            return acc + packageQuantity;
        } else if (itemGroup.source === 'promo') {
            const promoQuantity = itemGroup.labTest.reduce((packageAcc, item) => packageAcc + item.qty, 0);
            return acc + promoQuantity;
        } else {
            // Sum the quantity of the non-package item
            return acc + itemGroup.qty;
        }
    }, 0);

    const GetDiscounts = () => {
        const discounts = []
        const generalDiscount = combinedData?.discountApplied

        if(generalDiscount) {
            discounts.push(generalDiscount)
        }
        
        for(const item of combinedData?.items) {
            if(item.discount && generalDiscount?.name != item.discount.name){
                discounts.push(item.discount)
            }
        }

        return discounts
    }

    const ComputeTotalDiscount = () => {
        const discounts = GetDiscounts()
        let sum = 0

        for(const discount of discounts) {
            let value = discount.type == 'percentage' ? discount?.totalDiscount : discount.value
            value = value || 0

            sum += value
        }

        return sum
    }


    const handlePrint = async (receiptIndex) => {

        // Define data for each receipt
        const firstReceiptData = {
            combinedData: {
                ...combinedData,
                discounts: GetDiscounts(),
                totalDiscount: ComputeTotalDiscount(),
            },
            amountGiven,
            change,
            tenderType,
            totalQuantity,
            dvoteDetails,
            ...others,
        };

        const secondReceiptData = {
            combinedData: {
                ...combinedData,
                discounts: GetDiscounts(),
                totalDiscount: ComputeTotalDiscount(),
            },
            amountGiven,
            change,
            tenderType,
            totalQuantity,
            companyCopy: true,
            dvoteDetails,
            ...others
        };

        const thirdReceiptData = {
            combinedData,
            amountGiven,
            change,
            tenderType,
            companyCopy: true,
            totalQuantity,
            dvoteDetails,
            ...others
        };

        try {
            const receiptData = [firstReceiptData, secondReceiptData]
            await printAsync(receiptData[receiptIndex])
            // handleBack('success');
        } catch (error) {
            console.error('Error printing:', error);
            // Handle error (e.g., show a notification to the user)
        }
    };

    return (
        <>
            <Box sx={{ height: '70vh', overflowY: 'scroll' }}>
                <ReceiptContent
                    ref={componentRef1}
                    combinedData={combinedData}
                    amountGiven={amountGiven}
                    change={change}
                    tenderType={tenderType}
                    showAddress={false}
                    showDiscount={false}
                    discounts={GetDiscounts()}
                    totalDiscount={ComputeTotalDiscount()}
                />
                {/* <ReceiptContent
          ref={componentRef2}
          combinedData={combinedData}
          amountGiven={amountGiven}
          change={change}
          tenderType={tenderType}
          showAddress={true}
          showDiscount={true}
        />
        <ReceiptContent
          ref={componentRef3}
          combinedData={combinedData}
          amountGiven={amountGiven}
          change={change}
          tenderType={tenderType}
          showAddress={true}
          showDiscount={true}
        /> */}
            </Box>
            <Stack direction="row" justifyContent="flex-end" spacing={1} mt={2}>
                <Button variant="outlined" color="primary" onClick={() => handleBack('success')}>
                    Close
                </Button>
                <SplitButton 
                    onClick={async (index) => await handlePrint(index)} 
                    options={['Print Customer\'s', 'Print Company\'s']}
                />
            </Stack>
        </>
    );
};

export default ReceiptContent;
