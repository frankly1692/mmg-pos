import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import AddIcon from '@mui/icons-material/Add';

import Grid from '@mui/material/Grid';
import { Box, Divider, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Formik } from 'formik';
import * as Yup from 'yup';
import TextField from 'ui-component/TextField';

export const CreateSalesDepositSchema = Yup.object().shape({
    amount: Yup.number().min(1, 'Amount must be at least 1'),
    referenceNumber: Yup.string(),
    bankAccount: Yup.string().required('Bank account is required'),
    bankName: Yup.string().required('Bank name is required'),
    bankCode: Yup.string(),
    bankAddress: Yup.string()
});

export default function ({ onSubmit }) {
    const [open, setOpen] = React.useState(false);


    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const renderButton = () => (
        <IconButton size='small' onClick={handleOpen} sx={{ bgcolor: 'white' }}>
            <AddIcon />
        </IconButton>
    );

    if (!open) return renderButton();

    return (
        <React.Fragment>
            {renderButton()}
            <Dialog open={open} maxWidth="xs" fullWidth onClose={handleClose}>
                <Formik
                    initialValues={{
                        amount: '',
                        bankAccount: '',
                        referenceNumber: '',
                        bankName: '',
                        bankCode: '',
                        bankAddress: ''
                    }}
                    onSubmit={(values, actions) => {
                        onSubmit({ ...values })
                            .then(() => handleClose())
                            .catch((e) => actions.setFieldError('submit', e))
                            .finally(() => actions.setSubmitting(false));
                    }}
                    validationSchema={CreateSalesDepositSchema}
                >
                    {({ handleSubmit, submitForm, isSubmitting, errors }) => (
                        <form noValidate onSubmit={handleSubmit}>
                            <DialogTitle sx={{ fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                New Bank Deposit
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
                                            <TextField name="referenceNumber" placeholder="Reference Number" />
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
                                        </Stack>
                                    </Grid>
                                </Grid>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={handleClose}>Cancel</Button>
                                <Box flex={1}></Box>
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