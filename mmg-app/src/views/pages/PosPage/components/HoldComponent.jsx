import React, { memo, useState } from 'react';
import { Typography, Button, Dialog, DialogTitle, IconButton, DialogActions } from '@mui/material';
import { MdFrontHand } from 'react-icons/md';

// component import
import { useHotkeys } from 'react-hotkeys-hook';
import transaction from 'api/transaction';
import { useMutation } from 'react-query';
import { useAuth } from 'providers/AuthProvider';

export default memo(function ({ disabled, onSuccess, transaction: transactionData }) {
    const { mutateAsync, isLoading } = useMutation(transaction.CreateTransactionV2)
    const { mutateAsync: cancelTransaction, isLoading: isCancelling } = useMutation(transaction.CancelTransaction)
    const { branch, user } = useAuth()

    const [open, setOpen] = useState(false);

    const onToggle = () => {
        if (disabled) return;
        setOpen((open) => !open);
    };

    const handleSubmit = () => {
        mutateAsync({ ...transactionData, status: "hold", branchId: branch?.id })
            .then(() => {
                onSuccess()
                onToggle()
            })
    };

    const handleVoid = () => {
        cancelTransaction({
            branchId: branch?.id,
            cashierId: user?._id || user?.id,
            invoiceNumber: transactionData?.invoiceNumber,
            status: 'cancelled',
            reason: 'Voided from hold dialog'
        }).then(() => {
            onSuccess()
            onToggle()
        })
    }

    useHotkeys('f8', onToggle, { preventDefault: true });

    return (
        <>
            <Button
                variant="contained"
                color="dark"
                fullWidth
                startIcon={<MdFrontHand />}
                sx={{ py: 2 }}
                onClick={onToggle}
                disabled={disabled}
            >
                Hold (F8)
            </Button>
            {open && (
                <Dialog open disableRestoreFocus onClose={isLoading ? null : onToggle} maxWidth="xs">
                    <DialogTitle sx={{ py: 3, pb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="h4">Are you sure you want to hold this transaction?</Typography>
                    </DialogTitle>
                    <DialogActions>
                        <Button disabled={isLoading || isCancelling} onClick={onToggle}>
                            Cancel
                        </Button>
                        {transactionData?.id && (
                            <Button disabled={isLoading || isCancelling} color="error" onClick={handleVoid}>
                                {isCancelling ? 'Loading' : 'Void'}
                            </Button>
                        )}
                        <Button disabled={isLoading || isCancelling} variant="contained" color="primary" onClick={handleSubmit}>
                            {isLoading ? 'Loading' : 'Yes'}
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </>
    );
});
