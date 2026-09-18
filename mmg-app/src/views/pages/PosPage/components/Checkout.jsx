import React, { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from 'react-query';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Card, Typography, Grid, Button, Stack, Divider, Modal, TextField, InputAdornment, Chip, CircularProgress, Box } from '@mui/material';
import { MdChevronLeft } from 'react-icons/md';
import Receipt from './Receipt';
import { useTheme } from '@emotion/react';
import { FaPesoSign } from 'react-icons/fa6';
import { IoIosCheckmarkCircle } from 'react-icons/io';
// api
import transaction from 'api/transaction';
import FooterWatermark from 'ui-component/FooterWatermark';
import { useCashierReport } from '..';
import ReceiptModal from './ReceiptModal';
import WithPrintMutation from 'views/utilities/Print';
import { useAuth } from 'providers/AuthProvider';
import print from 'api/print';
import { usePrinter } from 'providers/PrinterProvider';

const schema = yup.object().shape({
    chequeNumber: yup
        .string()
        .matches(/^\d{6,}$/, 'Valid cheque number is required (at least 6 digits)')
        .required('Cheque number is required'),
    accountNumber: yup
        .string()
        .matches(/^\d{10,}$/, 'Valid account number is required (at least 10 digits)')
        .required('Account number is required'),
    accountName: yup.string().required('Account name is required'),
    bankName: yup.string().required('Bank name is required'),
    branchName: yup.string().required('Branch name is required'),
});

const Checkout = ({ combinedData, handleBack, handleSuccessTrans, ar }) => {
    const { display: showCustomerDisplay } =  usePrinter()
    // const { mutate: showCustomerDisplay } = useMutation(print.Display)
    const [amountGiven, setAmountGiven] = useState('');
    const [paymentMethod, setPaymentMethod] = useState(ar ? 'charge' : 'cash');
    const [receiptOpen, setReceiptOpen] = useState(false);
    const tenderFieldRef = useRef(null);
    const [isChipClicked, setIsChipClicked] = useState(false);
    const [loading, setLoading] = useState(false);
    const paymentTypes = ['cash', 'cheque'];

    // const paymentTypes = ['cash', 'cheque',  'charge'];
    // const paymentTypes = ['cash', 'cheque',  'charge', 'credit card', 'debit card', 'e-wallet',];

    const { refetch: refetchCashierReport } = useCashierReport()
    const queryClient = useQueryClient();

    const { branch } = useAuth();

    const editTransactionMutation = useMutation(transaction.CreateTransactionV2, {
        onMutate: async (updatedTransaction) => {
            await queryClient.cancelQueries('transactions');
            const previousTransaction = queryClient.getQueryData('transactions');
            queryClient.setQueryData('transactions', (old) =>
                old?.map((cat) => (cat._id === updatedTransaction._id ? updatedTransaction : cat))
            );
            return { previousTransaction };
        },
        onError: (err, updatedService, context) => {
            queryClient.setQueryData('transactions', context.previousTransaction);
            toast.error('Error saving the transaction.');
        },
        onSettled: () => {
            queryClient.invalidateQueries('transactions');
        }
    });

    const theme = useTheme();

    useEffect(() => {
        tenderFieldRef.current?.focus();
    }, [combinedData]);

    useEffect(() => {
        showCustomerDisplay('total', { total: combinedData?.paymentDue })
    }, [])

    // Function to determine if a payment method should be disabled
    const isDisabled = (item) => {
        const lowerCaseItem = item.toLowerCase();
        if (ar) {
            return ['cash', 'credit card', 'debit card', 'cheque', 'e-wallet'].includes(lowerCaseItem);
        } else {
            return ['credit card', 'debit card', 'e-wallet', 'charge'].includes(lowerCaseItem);
        }
    };

    useEffect(() => {
        // Update the payment method if needed
        if (ar && paymentMethod !== 'Charge') {
            setPaymentMethod('Charge');
        } else if (!ar && paymentMethod === 'Charge') {
            setPaymentMethod('Cash'); // or any default value
        }
    }, [ar, paymentMethod]);

    const {
        control,
        formState: { errors, isValid },
        trigger,
        handleSubmit,
    } = useForm();

    useEffect(() => {
        const handleKeyPress = (event) => {
            const key = event.key;
            const activeElement = document.activeElement;

            // Check if the active element is the chequeNumber input
            if (activeElement.name === 'chequeNumber' || activeElement.name === 'accountNumber' || activeElement.name === 'accountName' || activeElement.name === 'branchName' || activeElement.name === 'bankName') {
                return; // Exit the function if focused on chequeNumber
            }

            if (key >= '0' && key <= '9') {
                event.preventDefault();
                handleAmountClick(undefined, Number(key));
            } else if (key === 'Backspace') {
                handleClearClick();
            }
        };

        window.addEventListener('keydown', handleKeyPress);

        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, []);


    const handleAmountClick = ({ add, exact, reset } = { add: false, exact: false, reset: false }, value = 0) => {
        if (reset) {
            setAmountGiven(0);
            return;
        }
        if (exact) {
            setAmountGiven(combinedData?.paymentDue);
            return;
        }
        if (add) {
            setAmountGiven((amount) => Number(amount) + value);
            return;
        }

        setAmountGiven((amount) => Number(amount) * 10 + value);
        setIsChipClicked(true);
    };

    const handleClearClick = () => {
        setAmountGiven('');
    };

    const calculateChange = (amountGiven) => {
        const change = amountGiven - combinedData?.paymentDue;
        return change < 0 ? 0 : change.toFixed(2);
    };

    const getChangeColor = (amountGiven) => {
        const change = amountGiven - combinedData?.paymentDue;
        return change < 0 ? 'error.main' : 'success.dark';
    };

    const buildNewData = (value, amountGiven) => {
        const baseData = {
            ...combinedData,
            id: combinedData?.id,
            customerData: combinedData?.customerData,
            transactionNo: combinedData?.transactionNumber,
            transactionDate: combinedData?.transactionDate,
            services: combinedData?.items,
            discountApplied: combinedData?.discountApplied,
            status: 'Completed'
        };

        const paymentDetails = {
            subTotal: combinedData?.subTotal,
            paymentDue: combinedData?.paymentDue,
            change: calculateChange(amountGiven),
            tenderAmount: amountGiven
        };

        switch (value) {
            case 'cash':
                return {
                    ...baseData,
                    paymentDetails: {
                        ...paymentDetails,
                        tenderType: value
                    }
                };
            case 'cheque':
                return {
                    ...baseData,
                    paymentDetails: {
                        ...paymentDetails,
                        ...control._formValues,
                        tenderType: value
                    }
                };
            case 'charge':
                return {
                    ...baseData,
                    paymentDetails: {
                        ...paymentDetails,
                        tenderType: value
                    }
                };
            default:
                throw new Error('Invalid payment type');
        }
    };

    const handlePayClick = async () => {
        setLoading(true);
        try {
            const newData = buildNewData(paymentMethod, amountGiven);
            await editTransactionMutation.mutateAsync({ ...newData, branchId: branch.id });
            
            showCustomerDisplay('next')

            await refetchCashierReport()
            setReceiptOpen(true);
            handleSuccessTrans('success');
        } catch (error) {
            console.error('Transaction mutation failed', error);
            // Handle the error (e.g., show a specific error message based on error type)
        } finally {
            setLoading(false);
        }
    };

    const renderGridItem = (label, value, highlight = false, sx) => (
        <>
            <Grid item xs={5}>
                <Typography variant="h3" fontWeight="bold" color={theme.palette.grey[500]}>
                    {label}
                </Typography>
            </Grid>
            <Grid item xs={7} sx={{ textWrap: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <Typography variant="h1" sx={[highlight ? { color: 'success.dark' } : {}, sx]} textAlign="end">
                    {value}
                </Typography>
            </Grid>
        </>
    );

    return (
        <Stack
            bgcolor="primary.light"
            direction="row"
            justifyContent="center"
            alignItems='center'
            width="100%"
            sx={{
                minHeight: '100dvh',
                p: 4
            }}
        >
            <Grid
                container
                spacing={2}
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="center"
            >
                <Grid item xs lg={6} xl={4}>
                    <Card sx={{ py: 6, px: 4, height: '100%' }}>
                        <Button
                            size="large"
                            startIcon={<MdChevronLeft />}
                            sx={{ mb: 4, bgcolor: 'grey.50' }}
                            onClick={() => handleBack('back')}
                        >
                            Back
                        </Button>
                        <Typography variant="h1" mb={5} fontSize={28}>
                            Checkout
                        </Typography>
                        {/* <Typography variant="h3" mb={2}> Discounts</Typography>                    */}
                        <Typography variant="h3" mb={2}>
                            {' '}
                            Payment Method
                        </Typography>
                        <Grid container spacing={1} mb={4}>
                            {paymentTypes.map((item, index) => (
                                <Grid key={item} item xs={4} sm={3} md={4} xl={4}>
                                    <Button
                                        startIcon={paymentMethod === item && <IoIosCheckmarkCircle style={{ marginRight: 6 }} />}
                                        sx={{
                                            py: 2,
                                            px: 1,
                                            borderRadius: 3,
                                            textWrap: 'nowrap',
                                            overflow: 'hidden',
                                            fontWeight: 'bold',
                                            color: 'grey.400',
                                            borderColor: 'grey.400',
                                            borderWidth: '2px !important',
                                            ...(isDisabled(item)
                                                ? {
                                                    backgroundColor: 'grey.50',
                                                    borderColor: 'transparent !important'
                                                }
                                                : {}),
                                            ...(paymentMethod === item
                                                ? {
                                                    borderWidth: '3px !important',
                                                    borderColor: 'primary.main',
                                                    color: 'primary.main'
                                                }
                                                : {})
                                        }}
                                        fullWidth
                                        variant="outlined"
                                        onClick={() => setPaymentMethod(item)}
                                        disabled={isDisabled(item)}
                                    >
                                        {item}
                                    </Button>
                                </Grid>
                            ))}
                        </Grid>
                        <Typography variant="h3" mb={2}>
                            {' '}
                            Information
                        </Typography>
                        <Stack mb={4} direction="row" alignItems="center" spacing={1} px={3} py={2} bgcolor="grey.50" borderRadius={3}>
                            <Grid container width="100%" spacing={2}>
                                <Grid item xs={12}>
                                    <Typography variant="h4"> {combinedData?.customerData?.name}</Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="h5"> {combinedData?.customerData?.address}</Typography>
                                </Grid>
                                {combinedData?.customerData?.age && (
                                    <Grid item xs={12}>
                                        <Typography variant="h5"> {combinedData?.customerData?.age}</Typography>
                                    </Grid>
                                )}
                            </Grid>
                        </Stack>
                    </Card>
                </Grid>
                <Grid item xs lg={6} xl={3}>
                    <Card sx={{ py: 6, px: 4, height: '100%', }}>
                        <Grid container mb={2} spacing={2}>
                            {renderGridItem(
                                'Total balance: ',
                                <>
                                    <FaPesoSign
                                        style={{ marginLeft: '3px', marginBottom: -2, marginRight: '2px', fontSize: '1.55rem' }}
                                    />
                                    {new Intl.NumberFormat().format(combinedData?.paymentDue)}
                                </>,
                                false,
                                { color: 'primary.main', fontSize: '1.8rem' }
                            )}
                            <Grid item xs={12} my={1}>
                                <Divider />
                            </Grid>
                            {renderGridItem(
                                'Change: ',
                                <>
                                    <FaPesoSign
                                        style={{ marginLeft: '3px', marginBottom: -2, marginRight: '2px', fontSize: '1.55rem' }}
                                    />
                                    {new Intl.NumberFormat().format(calculateChange(amountGiven))}
                                </>,
                                false,
                                { color: getChangeColor(amountGiven), fontSize: '1.8rem' }
                            )}
                            <Grid item xs={12}></Grid>
                            <Grid item xs={12}>
                                <TextField
                                    ref={tenderFieldRef}
                                    autoFocus
                                    value={new Intl.NumberFormat().format(Number(amountGiven))}
                                    onChange={(e) => {
                                        setAmountGiven(e.target.value.replace(/[^\ .0-9]/g, ''));
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <FaPesoSign
                                                        style={{ marginBottom: 1, fontSize: '1.2rem', color: theme.palette.grey[400] }}
                                                    />
                                                    <Typography variant="h4" fontWeight="bold" color="grey.400">
                                                        Tender Amount
                                                    </Typography>
                                                </Stack>
                                            </InputAdornment>
                                        )
                                    }}
                                    inputProps={{
                                        sx: {
                                            '&::placeholder': {
                                                fontSize: '1.1rem'
                                            }
                                        }
                                    }}
                                    sx={{
                                        '& .MuiInputBase-root': {
                                            fontSize: '1.3rem',
                                            fontWeight: 'bold',
                                            py: 0.5
                                        },
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'primary.main',
                                            borderWidth: 2
                                        },
                                        '& input': {
                                            textAlign: 'right',
                                            mr: 1
                                        }
                                    }}
                                    fullWidth
                                />
                            </Grid>
                        <Grid item xs={12}>
                                    <Stack direction="row" spacing={1}>
                                        {[
                                            { value: 'Exact', exact: true },
                                            { value: 100, peso: true },
                                            { value: 200, peso: true },
                                            { value: 500, peso: true },
                                            { value: 1000, peso: true }
                                        ].map((item) => (
                                            <Chip
                                                icon={item.peso && <FaPesoSign />}
                                                label={item.value}
                                                onClick={() => handleAmountClick({ add: true, exact: item.exact }, item.value)}
                                                size="medium"
                                                sx={[
                                                    {
                                                        flex: 1,
                                                        bgcolor: 'grey.100',
                                                        fontSize: '0.9rem'
                                                    },
                                                    item.exact ? { color: 'primary.dark' } : {}
                                                ]}
                                                disabled={isChipClicked || combinedData?.subTotal > item.value}
                                            />
                                        ))}
                                    </Stack>
                                </Grid>
                            {paymentMethod === 'cash' && (
                                <>
                                
                                    <Grid item xs={12}>
                                        <Grid container>
                                            {[7, 8, 9, 4, 5, 6, 1, 2, 3, '00', 0].map((item) => (
                                                <Grid item xs={4}>
                                                    <Button
                                                        sx={{
                                                            py: 2,
                                                            borderRadius: 3,
                                                            textWrap: 'nowrap',
                                                            overflow: 'hidden',
                                                            fontWeight: 'bold',
                                                            fontSize: '1rem'
                                                        }}
                                                        fullWidth
                                                        variant="outlined"
                                                        onClick={() => handleAmountClick(undefined, item)}
                                                    >
                                                        {item}
                                                    </Button>
                                                </Grid>
                                            ))}
                                            <Grid item xs={4}>
                                                <Button
                                                    sx={{
                                                        py: 2,
                                                        borderRadius: 3,
                                                        textWrap: 'nowrap',
                                                        overflow: 'hidden',
                                                        fontWeight: 'bold',
                                                        fontSize: '1rem'
                                                    }}
                                                    onClick={() => handleAmountClick({ reset: true })}
                                                    fullWidth
                                                    variant="outlined"
                                                >
                                                    Reset
                                                </Button>
                                            </Grid>
                                        </Grid>
                                    </Grid>

                                </>
                            )}
                            {paymentMethod === 'cheque' && (
                                <Grid item xs={12}>
                                    <Stack direction='column' spacing={1.5} width='100%'>
                                        <Controller
                                                name="chequeNumber"
                                                control={control}
                                                defaultValue=""
                                                rules={{
                                                    required: 'Cheque Number is required',
                                                    pattern: { value: /^[0-9]+$/, message: 'Invalid Cheque Number' }
                                                }}
                                                render={({ field }) => (
                                                    <TextField
                                                        {...field}
                                                        label="Cheque Number"
                                                        fullWidth
                                                        onBlur={() => trigger('chequeNumber')}
                                                        error={!!errors.chequeNumber}
                                                        helperText={errors.chequeNumber ? errors.chequeNumber.message : ''}

                                                    />
                                                )}
                                            />
                                            <Controller
                                                name="accountNumber"
                                                control={control}
                                                defaultValue=""
                                                rules={{ required: 'Account Number is required' }}
                                                onFocus={() => {
                                                    trigger('accountNumber');
                                                }}
                                                render={({ field }) => (
                                                    <TextField
                                                        {...field}
                                                        label="Account Number"
                                                        fullWidth
                                                        onBlur={() => trigger('accountNumber')}
                                                        error={!!errors.accountName}
                                                    />
                                                )}
                                            />
                                            <Controller
                                                name="accountName"
                                                control={control}
                                                defaultValue=""
                                                rules={{ required: 'Account Name is required' }}
                                                onFocus={() => {
                                                    trigger('accountName');
                                                }}
                                                render={({ field }) => (
                                                    <TextField
                                                        {...field}
                                                        label="Account Name"
                                                        fullWidth
                                                        onBlur={() => trigger('accountName')}
                                                        error={!!errors.accountName}
                                                        helperText={errors.accountName ? errors.accountName.message : ''}

                                                    />
                                                )}
                                            />
                                            <Controller
                                                name="bankName"
                                                control={control}
                                                defaultValue=""
                                                rules={{ required: 'Bank Name is required' }}
                                                onFocus={() => {
                                                    trigger('bankName');
                                                }}
                                                render={({ field }) => (
                                                    <TextField
                                                        {...field}
                                                        label="Bank Name"
                                                        fullWidth
                                                        onBlur={() => trigger('bankName')}
                                                        error={!!errors.bankName}
                                                    />
                                                )}
                                            />
                                            <Controller
                                                name="branchName"
                                                control={control}
                                                defaultValue=""
                                                rules={{ required: 'Branch Name is required' }}
                                                onFocus={() => {
                                                    trigger('branchName');
                                                }}
                                                render={({ field }) => (
                                                    <TextField
                                                        {...field}
                                                        label="Branch Name"
                                                        fullWidth
                                                        onBlur={() => trigger('branchName')}
                                                        error={!!errors.branchName}
                                                    />
                                                )}
                                            />
                                    </Stack>
                                </Grid>
                            )}
                        
                        </Grid>
                        <Button
                            sx={{ py: 1.5 }}
                            fullWidth
                            variant="contained"
                            size="large"
                            onClick={handleSubmit(handlePayClick)}
                            disabled={amountGiven < combinedData?.paymentDue || loading}
                        >
                            {loading ? 'LOADING' : 'PAY'}
                        </Button>
                    </Card>
                    
                </Grid>
            </Grid>
            {
                receiptOpen && (
                    <WithPrintMutation>
                        {(props) => (
                            <ReceiptModal
                                {...props}
                                forceShow
                                open
                                onClose={() => handleBack('success')}
                                transaction={editTransactionMutation?.data} 
                            />
                        )}
                    </WithPrintMutation>
                )
            }
            {/* {
                receiptOpen && (
                    <Modal
                        open
                        onClose={() => setReceiptOpen(false)}
                        aria-labelledby="receipt-modal-title"
                        aria-describedby="receipt-modal-description"
                    >
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}>
                                <Receipt
                                    combinedData={{ ...combinedData, invoiceNumber: editTransactionMutation?.data?.invoiceNumber, ...editTransactionMutation?.data }}
                                    amountGiven={parseFloat(amountGiven)}
                                    change={parseFloat(calculateChange(amountGiven))}
                                    tenderType={paymentMethod}
                                    data={editTransactionMutation?.data}
                                    handleBack={handleBack}
                                    setReceiptOpen={setReceiptOpen}
                                />
                            </div>
                        </div>
                    </Modal>
                )
            }
             */}

            <FooterWatermark />
        </Stack>
    );
};

export default Checkout;
