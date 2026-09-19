import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import AddIcon from '@mui/icons-material/Add';

import Grid from '@mui/material/Grid';
import { Box, Divider, Stack, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { useMutation, useQueryClient } from 'react-query';
import TextField from 'ui-component/TextField';
import sales_deposits from 'api/sales_deposits';
import { CashierReportWrapper, useCashierReport } from 'providers/CashierReportProvider';
import { useAuth } from 'providers/AuthProvider';

const validationSchema = Yup.object().shape({
    branch: Yup.object().required('Branch is required'),
    amount: Yup.string().required('Amount is required'),
    referenceNumber: Yup.string(),
    bankAccount: Yup.string().required('Bank account is required'),
    bankName: Yup.string().required('Bank name is required'),
    bankCode: Yup.string(),
    bankAddress: Yup.string()
});

const CreateDepositModal = () => CashierReportWrapper(function ({ disabled }) {
    const [open, setOpen] = React.useState(false);

    const { branch } = useAuth()
    const { hasNoReportToday, loading: fetchingReports } = useCashierReport()

    const queryClient = useQueryClient();
    const { mutateAsync } = useMutation(sales_deposits.CreateSalesDeposit);

    const handleClickOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const renderButton = () => (
        <Button disabled={disabled || fetchingReports || hasNoReportToday} startIcon={<AddIcon />} onClick={handleClickOpen} variant="contained" color="primary">
            New deposit
        </Button>
    );

    if (!open) return renderButton();

    return (
        <React.Fragment>
            {renderButton()}
            <Dialog open={open} maxWidth="xs" fullWidth onClose={handleClose}>
                <Formik
                    initialValues={{
                        branch: branch,
                        amount: '',
                        referenceNumber: '',
                        bankAccount: '',
                        bankName: '',
                        bankCode: '',
                        bankAddress: ''
                    }}
                    onSubmit={(values, actions) => {
                        mutateAsync({ ...values, branchId: values.branch.id })
                            .then(() => {
                                queryClient.invalidateQueries('sales-deposits');
                                handleClose();
                            })
                            .catch((e) => actions.setFieldError('submit', e))
                            .finally(() => actions.setSubmitting(false));
                    }}
                    validationSchema={validationSchema}
                >
                    {({ handleSubmit, submitForm, isSubmitting, errors }) => (
                        <form noValidate onSubmit={handleSubmit}>
                            <DialogTitle sx={{ fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                New Sales Deposit
                                <IconButton onClick={handleClose} size="small" aria-label="Close">
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </DialogTitle>
                            <DialogContent>
                                <Grid container spacing={2}>
                                    <Grid item xs={3}>
                                        <Typography className="required" variant="caption">
                                            Information
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={9}>
                                        <Stack spacing={2}>
                                            {/* <TextField disabled name="branch.name" placeholder="Branch Name" /> */}
                                            <TextField name="amount" placeholder="Amount Deposited" />
                                        </Stack>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Divider />
                                    </Grid>
                                    <Grid item xs={3}>
                                        <Typography className="required" variant="caption">
                                            Bank Details
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={9}>
                                        <Stack spacing={2}>
                                            <TextField name="bankAccount" placeholder="Bank Account" />
                                            <Stack spacing={1} direction="row">
                                                <TextField name="bankName" placeholder="Bank Name" />
                                                <TextField name="bankCode" placeholder="Bank Code" />
                                            </Stack>
                                            <TextField name="bankAddress" placeholder="Bank Address" />
                                            <TextField name="referenceNumber" placeholder="Reference Number" />
                                        </Stack>
                                    </Grid>
                                </Grid>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={handleClose}>Cancel</Button>
                                <Box flex={1}></Box>
                                {/* <Button 
                                    disableElevation 
                                    disabled={isSubmitting} 
                                    variant="contained" 
                                    type="submit" 
                                    onClick={async () => {
                                       await submitForm()
                                       setOpen(true)
                                    }}
                                >
                                    Save & add Again
                                </Button> */}
                                <Button disableElevation disabled={isSubmitting} variant="contained" type="submit" onClick={submitForm}>
                                    {isSubmitting ? 'Saving...' : 'Save'}
                                </Button>
                            </DialogActions>
                        </form>
                    )}
                </Formik>
            </Dialog>
        </React.Fragment>
    );
}
)

export default CreateDepositModal