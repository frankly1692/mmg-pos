import React, { memo, useState, useMemo } from 'react';
import {
    Typography,
    Button,
    Dialog,
    DialogTitle,
    DialogActions,
    DialogContent,
    Stack,
    MenuItem,
    Autocomplete,
    InputAdornment,
    TextField as MuiTextField
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { MdDelete } from 'react-icons/md';
import * as Yup from 'yup';

// component import
import _package from 'api/package';
import { useHotkeys } from 'react-hotkeys-hook';
import { Formik, useField } from 'formik';
import TextField from 'ui-component/TextField';
import { useMutation, useQuery } from 'react-query';
import transaction from 'api/transaction';
import { useAuth } from 'providers/AuthProvider';
import { useCashierReport } from '..';
import { usePrinter } from 'providers/PrinterProvider';

const validationSchema = Yup.object().shape({
    branchId: Yup.string().required(),
    cashierId: Yup.string().required(),
    reason: Yup.string(),
    status: Yup.string().required('Type is required'),
    invoiceNumber: Yup.number().required('Invoice Number is required'),
});

const InvoiceNumberSelector = ({ options }) => {
    const [{ value }, { error, touched }, { setValue }] = useField('invoiceNumber');

    return (
        <Autocomplete
            options={options}
            value={value ?? null}
            onChange={(e, newValue) => setValue(newValue)}
            getOptionLabel={(option) => String(option).padStart(6, '0')}
            isOptionEqualToValue={(option, val) => option === val}
            noOptionsText="No completed transactions to adjust"
            renderInput={(params) => (
                <MuiTextField
                    {...params}
                    label="Invoice Number"
                    required
                    error={Boolean(error && touched)}
                    helperText={touched ? error : undefined}
                    InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchRoundedIcon sx={{ color: 'gray', fontSize: 18 }} />
                            </InputAdornment>
                        )
                    }}
                />
            )}
        />
    );
};

export default memo(function ({ disabled, buttonProps }) {
    const context = useCashierReport()
    const [open, setOpen] = useState(false);
    const { mutateAsync: cancelTransaction } = useMutation(transaction.CancelTransaction)
    const { branch, user } = useAuth()
    const { getTerminalInfo } = usePrinter()
    const cashierId = user?._id || user?.id;

    // Only this cashier's own completed transactions can be cancelled/refunded (the backend
    // enforces the same cashierId + status=completed filter), so the dropdown only ever offers
    // invoice numbers that will actually be found.
    const { data: transactions } = useQuery('transactions', () => transaction.GetAllTransaction(), { enabled: open });
    const cancellableInvoices = useMemo(() => {
        return (transactions || [])
            .filter((t) => t.status === 'completed' && t.invoiceNumber != null && t.cashier?._id === cashierId)
            .map((t) => t.invoiceNumber)
            .sort((a, b) => b - a);
    }, [transactions, cashierId]);

    const onToggle = () => {
        if (disabled) return;
        setOpen((open) => !open);
    };

    useHotkeys('f9', onToggle, { preventDefault: true });

    return (
        <>
            <Button
                variant="contained"
                color="dark"
                fullWidth
                startIcon={<MdDelete />}
                disabled={disabled}
                {...buttonProps}
                sx={{
                    py: 2,
                    height: '100%',
                    textWrap: 'nowrap',
                    overflow: 'hidden',
                    ...buttonProps?.sx
                }}
                onClick={onToggle}
            >
                Cancel Trans (F9)
            </Button>
            {open && (

                <Formik
                    initialValues={{
                        branchId: branch?.id,
                        cashierId: user?._id || user?.id,
                    }}
                    onSubmit={async (values, actions) => {
                        // Cancel/refund serial numbers are sequential per accredited terminal
                        // (BIR PTU rule), same as invoice numbers — the terminal doing the
                        // cancelling issues this document, so its own PTU is what's required here.
                        const terminalInfo = await getTerminalInfo();
                        if (!terminalInfo?.PTU_NO) {
                            actions.setFieldError(
                                'submit',
                                "Cannot process: unable to reach this terminal's printer helper to confirm its accreditation (PTU)."
                            );
                            actions.setSubmitting(false);
                            return;
                        }

                        cancelTransaction({ ...values, ptuNumber: terminalInfo.PTU_NO })
                            .then(context?.refetch)
                            .then(onToggle)
                            .catch((e) => {
                                const errors = e.response.data.error || []
                                errors.forEach((error) => {
                                    actions.setFieldError(error.loc[0], error.msg)
                                })
                            })
                            .finally(() => actions.setSubmitting(false));
                    }}
                    validationSchema={validationSchema}
                >
                    {({ handleSubmit, submitForm, isSubmitting, values, errors }) => (
                        <Dialog open disableRestoreFocus onClose={!isSubmitting ? onToggle : null} maxWidth="xs" fullWidth>
                            <DialogTitle sx={{ py: 3, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="h4">Sales Adjustment</Typography>
                            </DialogTitle>
                            <DialogContent sx={{ paddingTop: '8px !important' }}>
                                <form noValidate onSubmit={handleSubmit}>
                                    <Stack direction='column' spacing={2}>
                                        <TextField required select name="status" label="Type">
                                            <MenuItem value="refunded">Refund</MenuItem>
                                            <MenuItem value="cancelled">Cancel</MenuItem>
                                        </TextField>
                                        <InvoiceNumberSelector options={cancellableInvoices} />
                                        <TextField
                                            name="reason"
                                            label="Reason"
                                            multiline
                                            rows={4}
                                        />
                                        {/* {JSON.stringify(values)} */}
                                        {/* {JSON.stringify(errors)} */}
                                    </Stack>
                                </form>
                            </DialogContent>
                            <DialogActions >
                                <Button disabled={isSubmitting} onClick={onToggle}>
                                    Cancel
                                </Button>
                                <Button onClick={submitForm} disableElevation disabled={isSubmitting} variant="contained">
                                    {isSubmitting ? 'Loading' : 'Submit'}
                                </Button>
                            </DialogActions>
                        </Dialog>
                    )}
                </Formik>
            )}
        </>
    );
});
