import React, { memo, useState } from 'react';
import { Typography, Button, Dialog, DialogTitle, DialogActions, DialogContent, Stack, MenuItem } from '@mui/material';
import { MdDelete } from 'react-icons/md';
import * as Yup from 'yup';

// component import
import _package from 'api/package';
import { useHotkeys } from 'react-hotkeys-hook';
import { Formik } from 'formik';
import TextField from 'ui-component/TextField';
import { useMutation } from 'react-query';
import transaction from 'api/transaction';
import { useAuth } from 'providers/AuthProvider';
import { useCashierReport } from '..';

const validationSchema = Yup.object().shape({
    branchId: Yup.string().required(),
    cashierId: Yup.string().required(),
    reason: Yup.string(),
    status: Yup.string().required(),
    invoiceNumber: Yup.number().required(),
});

export default memo(function ({ disabled }) {
    const context = useCashierReport()
    const [open, setOpen] = useState(false);
    const { mutateAsync: cancelTransaction } = useMutation(transaction.CancelTransaction)
    const { branch, user } = useAuth()

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
                sx={{
                    py: 2,
                    height: '100%',
                    textWrap: 'nowrap',
                    overflow: 'hidden',
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
                    onSubmit={(values, actions) => {
                        cancelTransaction(values)
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
                                        <TextField
                                            type='number'
                                            name="invoiceNumber"
                                            label='Invoice Number'
                                            required
                                        />
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
