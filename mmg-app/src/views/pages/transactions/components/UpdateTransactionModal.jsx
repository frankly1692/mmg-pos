import * as React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Grid, Typography, Button, Paper, Divider, Stack, IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { useMutation, useQueryClient } from 'react-query';
import moment from 'moment';
import StatusSelector from './StatusSelector';
import transaction from 'api/transaction';
import { pick, startCase } from 'lodash';
import Receipt from 'views/pages/PosPage/components/Receipt';
import ReceiptModal from 'views/pages/PosPage/components/ReceiptModal';
import WithPrintMutation from 'views/utilities/Print';

const validationSchema = Yup.object().shape({
    status: Yup.object().required('Status is required')
});

export default function ({ initialValues: receipt }) {
    const [open, setOpen] = React.useState(false);
    const [receiptOpen, setReceiptOpen] = React.useState(false); // State for the receipt modal

    const { services, ...rest } = receipt;

    const newData = {
        items: services,
        subTotal: receipt?.paymentDetails?.subTotal,
        discountApplied: receipt?.paymentDetails?.discountApplied,
        paymentDue: receipt?.paymentDetails?.paymentDue,
        branchName: receipt?.branch?.name,
        branchTIN: receipt?.branch?.tin,
        branchAddress: `${receipt?.branch?.streetAddress} ${receipt?.branch?.state}`,
        cashierName: `${receipt?.cashier?.first_name} ${receipt?.cashier?.last_name}`,
        ...rest
    };


    const queryClient = useQueryClient();
    const { mutateAsync } = useMutation(transaction.UpdateTransaction);

    const handleClickOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    const handleReceiptClose = () => setReceiptOpen(false); // Close receipt modal

    const renderButton = () => (
        <Button onClick={handleClickOpen} startIcon={<EditIcon fontSize="small" />} variant="outlined" size="small">
            Show
        </Button>
    );

    const renderGridItem = ({ label, value }, size) => (
        <>
            <Grid item xs={size?.left || 4}>
                <Typography variant="caption">{label}</Typography>
            </Grid>
            <Grid item xs={size?.right || 8}>
                <Typography color={value ? 'black' : 'lightgray'} variant="h5">
                    {value || 'N/A'}
                </Typography>
            </Grid>
        </>
    );

    const renderGridData = ({ label, value }, size) => (
        <>
            <Grid item xs={size?.left || 4}>
                <Typography variant="caption">{label}</Typography>
            </Grid>
            <Grid item xs={12}>
                {value?.map((item, index) => (

                        <>
                            {item.source != 'labTest' ? (
                            <>
                                <Typography color='black' variant="h5">
                                - {item.name}
                                </Typography>
                                {item?.labTest?.map((item, index) => (
                                    <Stack ml={3} direction='row' justifyContent='space-between' width='50%'>
                                        <Typography color='black' variant="h5">
                                            {item.name}
                                        </Typography>
                                        <Typography variant="body1">
                                            ({item.qty})
                                        </Typography>
                                        <Typography  variant="body1">
                                            {item.price}
                                        </Typography>
                                    </Stack>
                                ))}
                            </>
                        ) : (
                            <Stack direction='row' justifyContent='space-between' width='75%'>
                                <Typography color='black' variant="h5">
                                    {item.name}
                                </Typography>
                                <Typography variant="body1">
                                    ({item.qty})
                                </Typography>
                                <Typography  variant="body1">
                                    {item.price}
                                </Typography>
                            </Stack>
                        )}
                        </>
                ))}

            </Grid>
        </>
    );

    const renderDivider = () => (
        <Grid item xs={12}>
            <Divider />
        </Grid>
    );

    if (!open) return renderButton();

    return (
        <React.Fragment>
            {renderButton()}
            <Dialog open={open} maxWidth="xs" fullWidth onClose={handleClose}>
                <Formik
                    initialValues={pick(receipt, ['id', 'status'])}
                    onSubmit={(values, actions) => {
                        mutateAsync({ ...values, status: values?.status?.name })
                            .then(() => {
                                queryClient.invalidateQueries('transactions');
                                handleClose();
                            })
                            .catch((e) => actions.setFieldError('submit', e))
                            .finally(() => actions.setSubmitting(false));
                    }}
                    validationSchema={validationSchema}
                >
                    {(
                        { handleSubmit, submitForm, isSubmitting, values } // Access values
                    ) => (
                        <form noValidate onSubmit={handleSubmit}>
                            <DialogTitle sx={{ fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                Edit Transaction
                                <IconButton onClick={handleClose} size="small" aria-label="Close">
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </DialogTitle>
                            <DialogContent>
                                <Paper sx={{ height: '600px', overflowY: 'auto' }}>
                                    {' '}
                                    {/* Adjust height as needed */}
                                    <Grid container rowSpacing={1.5} columnSpacing={2}>
                                        {/* {renderGridItem({ label: 'Invoice No.', value: initialValues?.invoiceNo })} */}
                                        {renderGridItem({ label: 'Invoice No.', value: receipt?.invoiceNumber.toString().padStart(6, '0') })}
                                        {renderGridItem({ label: 'Branch', value: startCase(receipt?.branch?.name) })}
                                        {renderGridItem({ label: 'Date', value: moment(receipt?.transactionDate).calendar() })}
                                        {renderDivider()}
                                        {renderGridItem({ label: 'Customer', value: receipt?.customerData?.name })}
                                        {renderGridItem({ label: 'Age', value: receipt?.customerData?.age })}
                                        {renderGridItem({ label: 'Type', value: startCase(receipt?.customerData?.customerType) })}
                                        {renderGridItem({
                                            label: 'Requested By',
                                            value: `${receipt?.requestedBy?.firstName || ''} ${receipt?.requestedBy?.lastName || ''}`
                                        })}
                                        {renderGridItem({
                                            label: 'Referred By',
                                            value: `${receipt?.referredBy?.firstName || ''} ${receipt?.referredBy?.lastName || ''}`
                                        })}
                                        {renderDivider()}
                                        {renderGridItem({ label: 'SubTotal', value: receipt?.paymentDetails?.subTotal })}
                                        {renderGridItem({ label: 'Payment Due', value: receipt?.paymentDetails?.paymentDue })}
                                        {renderGridItem({ label: 'Tender Amount', value: receipt?.paymentDetails?.tenderAmount })}
                                        {renderGridItem({
                                            label: 'Change',
                                            value: receipt?.paymentDetails?.change ? receipt?.paymentDetails?.change : '0.00'
                                        })}
                                        {renderDivider()}
                                        {renderGridData({ label: 'Items.', value: receipt?.services })}
                                        {renderDivider()}
                                        <Grid item xs={4}>
                                            <Typography className="required" variant="caption">
                                                Status
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={8}>
                                            <StatusSelector />
                                        </Grid>
                                    </Grid>
                                </Paper>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={handleClose}>Cancel</Button>
                                <Button onClick={() => setReceiptOpen(true)}>Reprint</Button> {/* Open receipt modal */}
                                <Button
                                    disableElevation
                                    disabled={isSubmitting || values.status?.name === 'Completed'} // Disable if status is Completed
                                    onClick={submitForm}
                                    size="small"
                                    variant="contained"
                                >
                                    {isSubmitting ? 'Saving...' : 'Submit'}
                                </Button>
                            </DialogActions>
                        </form>
                    )}
                </Formik>
            </Dialog>
            <WithPrintMutation>
                {(props) => (
                    <ReceiptModal 
                        {...props}
                        open={receiptOpen} 
                        onClose={() => setReceiptOpen(false)} 
                        receipt={{
                            combinedData: newData, // Pass the transaction data to the Receipt component
                            amountGiven: receipt?.paymentDetails?.tenderAmount, // Pass the tender amount
                            change: parseFloat(receipt?.paymentDetails?.change), // Pass the change
                            tenderType: receipt?.paymentDetails?.tenderType, // Pass the tender type
                            setReceiptOpen: setReceiptOpen, // Pass the function to close the receipt modal
                            handleBack: handleReceiptClose
                        }}  
                    />
                )}
            </WithPrintMutation>
        </React.Fragment>
    );
}
