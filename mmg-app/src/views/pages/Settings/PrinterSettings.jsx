import React, { useState, useEffect } from 'react';
import { Button, Typography, FormControlLabel, Switch, Stack, Grid, Divider, TextField, Alert } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { usePrinter } from 'providers/PrinterProvider';
import MainCard from 'ui-component/cards/MainCard';

const PrinterSettings = () => {
    const [printerIP, setPrinterIP] = useState('192.168.192.168');
    const [printerPort, setPrinterPort] = useState('');
    const [testMessage, setTestMessage] = useState('Test print message');
    const [statusMessage, setStatusMessage] = useState('');
    const [statusType, setStatusType] = useState('');
    const [trialMode, setTrialMode] = useState(false);
    const { print, status, printing } = usePrinter()

    useEffect(() => {
        const savedPrinterIP = localStorage.getItem('printerIP') || '192.168.192.168';
        const savedPrinterPort = localStorage.getItem('printerPort');
        const savedTrialMode = localStorage.getItem('printerTrialMode');

        setPrinterIP(savedPrinterIP);
        if (savedPrinterPort) {
            setPrinterPort(savedPrinterPort);
        }
        if (savedTrialMode !== null) {
            setTrialMode(JSON.parse(savedTrialMode));
        }
    }, []);

    const showResult = (result, fallback) => {
        if (result?.busy) return
        setStatusMessage(result?.error ? `${result.message || 'Print failed'}: ${result.error}` : (result?.message || fallback));
        setStatusType(result?.error ? 'error' : 'success');
        setTimeout(() => setStatusMessage(''), 6000);
    };

    const handlePrintTest = async () => {
        setStatusMessage('Printing...');
        setStatusType('info');
        showResult(await print('printer', 'test', { settings: { url: printerIP || '192.168.192.168' }, message: testMessage }), 'Test print done');
    };

    const handlePrinterIPChange = (e) => {
        const value = e.target.value;
        setPrinterIP(value);
        localStorage.setItem('printerIP', value);
    };

    const handlePrinterPortChange = (e) => {
        const value = e.target.value;
        setPrinterPort(value);
        localStorage.setItem('printerPort', value);
    };

    const handleTrialModeChange = (e) => {
        const enabled = e.target.checked;
        setTrialMode(enabled);
        localStorage.setItem('printerTrialMode', JSON.stringify(enabled));
    };

    const handlePrintEjournal = async () => {
        setStatusMessage('Printing electronic journal...');
        setStatusType('info');
        showResult(await print('printer', 'ejournal', {}), 'Electronic journal printed');
    };

    return (
        <MainCard title="Printer Settings">
            <Stack spacing={3}>
                {/* Network Configuration Section */}
                <Stack spacing={2}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        Network Configuration
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Printer IP Address"
                                value={printerIP}
                                onChange={handlePrinterIPChange}
                                placeholder="192.168.192.168"
                                fullWidth
                                size="small"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Printer Port (Optional)"
                                value={printerPort}
                                onChange={handlePrinterPortChange}
                                placeholder="9100"
                                fullWidth
                                size="small"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Stack spacing={0.5}>
                                <Typography variant="body2" sx={{ fontWeight: '600' }}>
                                    Connection Status
                                </Typography>
                                <Typography variant="body2" color={status === 'OPEN' ? 'success.main' : 'warning.main'} sx={{ fontWeight: 'bold' }}>
                                    {status === 'OPEN' ? '✓ Connected' : `⚠ ${status || 'Disconnected'}`}
                                </Typography>
                            </Stack>
                        </Grid>
                    </Grid>
                </Stack>

                <Divider />

                {/* Test Print Section */}
                <Stack spacing={2}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        Test Print
                    </Typography>
                    <TextField
                        label="Test Message"
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        multiline
                        rows={2}
                        placeholder="Enter your test message"
                        fullWidth
                        size="small"
                    />
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handlePrintTest}
                        disabled={printing}
                        startIcon={<PrintIcon />}
                    >
                        Send Test Print
                    </Button>
                </Stack>

                <Divider />

                {/* Trial Mode Section */}
                <Stack spacing={2}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        Trial Mode
                    </Typography>
                    <FormControlLabel
                        control={<Switch checked={trialMode} onChange={handleTrialModeChange} />}
                        label={
                            <Stack spacing={0.5}>
                                <Typography variant="body2" sx={{ fontWeight: '600' }}>
                                    Paper Saver Mode
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                    When enabled: prints receipt 1 time only. When disabled: prints receipt 3 times (normal operation).
                                </Typography>
                            </Stack>
                        }
                        sx={{ alignItems: 'flex-start', m: 0 }}
                    />
                </Stack>

                <Divider />

                {/* Maintenance Section */}
                <Stack spacing={2}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        Maintenance
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Print the complete electronic journal (audit log) of all transactions.
                    </Typography>
                    <Button
                        variant="outlined"
                        color="primary"
                        onClick={handlePrintEjournal}
                        disabled={printing}
                    >
                        Print Electronic Journal
                    </Button>
                </Stack>

                {/* Status Message */}
                {statusMessage && (
                    <Alert severity={statusType || 'info'}>
                        {statusMessage}
                    </Alert>
                )}
            </Stack>
        </MainCard>
    );
};

export default PrinterSettings;
