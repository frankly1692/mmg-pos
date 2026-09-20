import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { IoMdPrint } from 'react-icons/io';
import XReadingReport from 'views/pages/cashier-reports/components/XReadingReport';
import { Margin, Resolution, usePDF } from 'react-to-pdf';
import DownloadIcon from '@mui/icons-material/Download';
import { usePrinter } from 'providers/PrinterProvider';
import { dvoteDetails } from 'utils/mockData';
import moment from 'moment';

export default ({ open, report, onClose, disableActions }) => {
    const navigate = useNavigate();
    const { print, printing } = usePrinter();
    const { toPDF, targetRef } = usePDF({filename: 'x-report.pdf'});

    if (!open) return null;

    const reprint = moment().format('YYYY-MM-DD') != report.date

    const handlePrint = () => {
        print('printer', 'report', {
            ...report,
            reprint,
            dvoteDetails,
            type: 'X_REPORT'
        });
    };

    return (
        <Dialog onClose={onClose} maxWidth="xs" fullWidth open={open} >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="h4">X Reading Report</Typography>
                <Box flex={1}></Box>
                <Button
                    startIcon={<IoMdPrint />}
                    sx={{ bgcolor: 'grey.50', mr: 1 }}
                    color="primary"
                    onClick={handlePrint}
                    disabled={printing}
                >
                    {printing ? 'Printing...' : 'Print'}
                </Button>
                <Button
                    startIcon={<DownloadIcon />}
                    sx={{ bgcolor: 'grey.50' }}
                    color="primary"
                    onClick={() =>
                        toPDF({ resolution: Resolution.EXTREME, page: { margin: Margin.LARGE } })}
                >
                    Download
                </Button>
            </DialogTitle>
            <DialogContent ref={targetRef}>
                <Stack mb={3}>
                </Stack>
                <XReadingReport reprint={reprint} report={report}/>
            </DialogContent>
            {disableActions != true && (
                <DialogActions>
                    <Button color="primary" onClick={() => navigate('/dashboard/cashier-reports')}>
                        Go to dashboard
                    </Button>
                </DialogActions>
            )}
        </Dialog>
    );
};
