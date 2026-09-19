import React, { useState } from 'react';
import {
    TextField,
    Button,
    Typography,
    Grid,
    Box,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Card,
    Stack,
    InputAdornment,
    IconButton
} from '@mui/material';
import { MdChevronLeft } from 'react-icons/md';
import HelpIcon from '@mui/icons-material/Help';
import { useTheme } from '@emotion/react';
import { FaPesoSign } from 'react-icons/fa6';
import { useMutation } from 'react-query';
import cashier_report from 'api/cashier_report';
import { useCashierReport } from '..';
import SummaryReportDialog from './XReportDialog';
import { useNavigate } from 'react-router-dom';
import FooterWatermark from 'ui-component/FooterWatermark';
import { useAuth } from 'providers/AuthProvider';

const denominations = [
    { label: 'Php 1,000', value: 1000 },
    { label: 'Php 500', value: 500 },
    { label: 'Php 200', value: 200 },
    { label: 'Php 100', value: 100 },
    { label: 'Php 50', value: 50 },
    { label: 'Php 20', value: 20 },
    { label: 'Php 10', value: 10 },
    { label: 'Php 5', value: 5 },
    { label: 'Php 1', value: 1 },
    { label: 'Php 0.25', value: 0.25 },
    { label: 'Php 0.10', value: 0.10 },
    { label: 'Php 0.05', value: 0.05 },
];

const CashRegister = ({ initialValues, isEndingBalanceFlag, handleBack }) => {
    const navigate = useNavigate();
    const { branch } = useAuth()
    const [entries, setEntries] = useState(initialValues ?? {});
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [isEndingBalance] = useState(isEndingBalanceFlag);
    const cashierReportContext = useCashierReport();
    const report = cashierReportContext?.report;
    const { refetch } = cashierReportContext || {};

    const [submitting, setSubmitting] = useState(false)
    const [withdraw, setWithdraw] = useState(null)
    const { mutateAsync: timeOut, isLoading: timeOutLoading } = useMutation(cashier_report.TimeOutCashierReport);
    const { mutateAsync: timeIn, isLoading: timeInLoading } = useMutation(cashier_report.TimeInCashierReport);
    
    const loading = timeOutLoading || timeInLoading || submitting

    const total = Object.entries(entries).reduce((sum, [cash, count]) => sum + parseFloat(cash) * parseFloat(count), 0);

    const theme = useTheme();

    const handleChange = (label, value) => {
        const number = Number(value);
        if (number < 0) {
            return;
        }

        const newEntries = { ...entries };
        if (number > 0) {
            newEntries[label] = number;
        } else {
            delete newEntries[label];
        }
        setEntries(newEntries);
    };

    const hasValues = () => {
        return Object.values(entries).some((entry) => entry > 0);
    };

    const handleConfirm = () => {
        setConfirmOpen(false);

        if (!isEndingBalanceFlag) {
            setSubmitting(true)
            timeIn({ openingFund: { count: entries }, branchId: branch.id })
                .then(refetch)
                .finally(() => setSubmitting(false));

            return;
        }

        timeOut({ endingCashCount: { count: entries }, withdraw, branchId: branch.id, id: report._id })
            .then(() => navigate('x-report'));
    };

    return (
        <Stack bgcolor={theme.palette?.primary.light} alignItems="center" justifyContent="center" sx={{ p: 5, height: '100vh' }}>
            <Card sx={{ p: 6,  width: { lg: '80%', xl: '60%' }, maxWidth: 'xl' }}>
                <Grid container spacing={10}>
                    <Grid item xs={7} space={2}>
                        <Stack direction="column" height='100%'>
                            <Box>
                                {isEndingBalance && (
                                    
                                    <Button
                                    size="large"
                                    startIcon={<MdChevronLeft />}
                                    sx={{ mb: 4, bgcolor: 'grey.50', alignSelf: 'start' }}
                                    onClick={handleBack}
                                >
                                    Back
                                </Button>
                            )}
                                <Typography variant="h1" fontSize={28} gutterBottom>
                                    {!isEndingBalance ? 'Openning Fund' : 'Ending Balance Entry'}
                                </Typography>
                                <Stack mt={3} direction="row" mb={1.5} spacing={0.5} alignItems="center">
                                    <Typography variant="h3">Help </Typography>
                                    <HelpIcon />
                                </Stack>
                                <Typography color="gray" variant="h3" fontWeight="regular">
                                    Enter the number of each denomination in the provided fields. The system will automatically calculate
                                    the total value of each denomination and the overall balance. Review and confirm the information before
                                    saving. If you need further assistance, contact support.
                                </Typography>
                            </Box>
                            <Box flex={1}></Box>
                            <Box>
                                <Stack  direction="row" alignItems="center" spacing={0.5}>
                                    <Typography pr={2} variant="h3">
                                        Total Entry:{' '}
                                    </Typography>
                                    <TextField 
                                        type='number'
                                        size='small'
                                        placeholder='0.00'
                                        value={total.toFixed(2)}
                                        InputProps={{ readOnly: true }}
                                    />
                                </Stack>
                                {isEndingBalanceFlag && (
                                    <Stack mt={1.5} direction="row" alignItems="center" spacing={0.5}>
                                        <Typography pr={2} variant="h3">
                                            Withdraw:
                                        </Typography>
                                        <TextField 
                                            type='number'
                                            size='small'
                                            placeholder='0.00'
                                            defaultValue={withdraw?.toFixed(2)}
                                            onChange={(e) => setWithdraw(parseFloat(e.target?.value))}
                                        />
                                    </Stack>
                                )}
                                <Button
                                    disabled={loading}
                                    sx={{ mt: 3, px: 3, fontSize: 16 }}
                                    variant="contained"
                                    color="primary"
                                    onClick={() => setConfirmOpen(true)}
                                >
                                    {loading ? 'Loading...' : 'Confirm Entries'}
                                </Button>
                            </Box>
                        </Stack>
                    </Grid>
                    <Grid item xs>
                        <Stack spacing={1} alignItems="end">
                            {denominations.map((denom, index) => (
                                <TextField
                                    key={index}
                                    type="number"
                                    id={`denom-elem-${denom?.value}`}
                                    variant="outlined"
                                    value={entries[denom?.value.toString()] ?? ''}
                                    onChange={(e) => handleChange(denom?.value.toString(), e.target?.value)}
                                    fullWidth
                                    inputProps={{
                                        min: 0,
                                        style: { textAlign: 'end', paddingRight: '20px' },
                                        onKeyDown:  (event) => {
                                                  const { key } = event;

                                                  if (key === 'ArrowUp') {
                                                        const prevIndex = (index - 1) % denominations.length;
                                                        const prevElement = document.getElementById(
                                                            `denom-elem-${denominations[prevIndex]?.value}`
                                                        );
                                                        prevElement.focus();
                                                        event.preventDefault()
                                                        return
                                                    }

                                                  
                                                  if (key === 'Enter' || key == 'ArrowDown') {
                                                    const nextIndex = (index + 1) % denominations.length;
                                                    const nextElement = document.getElementById(
                                                        `denom-elem-${denominations[nextIndex]?.value}`
                                                    );
                                                    event.preventDefault()
                                                      nextElement.focus();
                                                  }
                                              }
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Stack direction="row" alignItems="center">
                                                    <FaPesoSign color={theme.palette.grey[400]} />
                                                    <Typography sx={{ mt: '3px' }} color={theme.palette.grey[400]} variant="h5">
                                                        {denom.value}
                                                    </Typography>
                                                </Stack>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            ))}
                        </Stack>
                    </Grid>
                </Grid>

                {/* Confirm Dialog */}
                <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
                    <DialogTitle sx={{ pt: 3 }}>
                        <Typography variant="h2">Confirm Entries</Typography>
                    </DialogTitle>
                    <DialogContent>
                        <Typography color="gray" variant="h4" mb={2} fontWeight="regular">
                            Please review the entered denominations and their totals before confirming.
                        </Typography>
                        <Grid container>
                            {Object.keys(entries).filter((cash) => entries[cash] > 0).map((cash) => (
                                <>
                                    <Grid key={cash} item xs={1.5}>
                                        <Stack direction="row" alignItems="center">
                                            <FaPesoSign />
                                            <Typography key={cash} variant="h3" fontWeight="regular">
                                                {cash}
                                            </Typography>
                                        </Stack>
                                    </Grid>
                                    <Grid item xs={1}>
                                        <Typography key={cash} variant="h3" fontWeight="regular">
                                            x {entries[cash]} =
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={9.5}>
                                        <Stack direction="row" alignItems="center">
                                            <FaPesoSign />
                                            <Typography key={cash} variant="h3" fontWeight="regular">
                                                {cash * entries[cash]}
                                            </Typography>
                                        </Stack>
                                    </Grid>
                                </>
                            ))}
                        </Grid>
                        <Stack mt={5} direction="row" alignItems="center" spacing={0.5}>
                            <Typography pr={2} variant="h3">
                                Total:{' '}
                            </Typography>
                            <FaPesoSign fontSize={18} />
                            <Typography variant="h3" sx={{ textDecoration: 'underline' }}>
                                {new Intl.NumberFormat().format(total)}
                            </Typography>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setConfirmOpen(false)} color="primary">
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={handleConfirm} color="primary">
                            Confirm
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* {isEndingBalance && data && <SummaryReportDialog report={data} open={summaryOpen} />} */}
            </Card>
            <FooterWatermark />
        </Stack>
    );
};

export default CashRegister;
