import { Stack, Card, Typography, Button, Box } from '@mui/material';
import { CashierReportWrapper, useCashierReport } from 'providers/CashierReportProvider';
import { useNavigate } from 'react-router-dom';
import PageLoader from 'ui-component/PageLoader';
import XReading from 'views/pages/cashier-reports/components/XReadingReport';
import { IoMdPrint } from 'react-icons/io';
import print from 'api/print';
import { useMutation, useQuery } from 'react-query';
import { dvoteDetails } from 'utils/mockData';
import cashier_report from 'api/cashier_report';
import moment from 'moment';
import { useAuth } from 'providers/AuthProvider';
import branch_reports from 'api/branch_reports';
import { PrinterWrapper, usePrinter } from 'providers/PrinterProvider';

function XReportPage() {
    const navigate = useNavigate();
    const { branch, user } = useAuth()

    const { data, isLoading: loading } = useQuery({
        queryKey: ['today-cashier-report', branch],
        queryFn: () => cashier_report.GetAllCashierReport({
            date: moment().format('YYYY-MM-DD'),
            branchId: branch.id,
            cashierId: user._id
        }),
        enabled: !!branch
    })
    const report = data?.reports?.[0]

    const { print } = usePrinter()

    // const { mutateAsync: printReport } = useMutation(print.PrintReport)
    const { mutateAsync: generateZReport, isLoading } = useMutation(branch_reports.GenerateBranchReport)

    function onPrint() {
        print("printer", "report", { ...report, dvoteDetails, type: 'X_REPORT' })
    }

    if (loading) return <PageLoader />;

    if (!report) {
        return (
            <Stack p={6} py={8} bgcolor="primary.light" alignItems="center" sx={{ p: 5, minHeight: '100dvh' }}>
                <Stack maxWidth="sm" width='100%'>
                    <Card sx={{ px: 5, py: 4 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="h3" gutterBottom>
                                No sales has been made to generate Z-Reading Report.
                            </Typography>
                        </Stack>
                        <Stack ml={-1} mt={1} direction="row" alignItems="center" justifyContent='space-between' spacing={2}>
                            <Button color="primary" size="large" onClick={() => navigate('/dashboard/cashier-reports')}>
                                Go to dashboard
                            </Button>
                        </Stack>
                    </Card>
                </Stack>
            </Stack>
        )
    }

    return (
        <Stack p={6} py={8} bgcolor="primary.light" alignItems="center" justifyContent="center" sx={{ p: 5, minHeight: '100dvh' }}>
            <Stack maxWidth="sm" width='100%'>
                <Typography variant="h2" mb={4} gutterBottom>
                    Your session for this day has ended.
                </Typography>

                <Card sx={{ px: 5, py: 4 }}>
                    <Stack direction="row" mb={3} justifyContent="space-between" alignItems="center">
                        <Typography variant="h4" gutterBottom>
                            X-Reading Report
                        </Typography>
                        <Button onClick={onPrint} startIcon={<IoMdPrint />} sx={{ bgcolor: 'grey.50' }} color="primary">
                            Print
                        </Button>
                    </Stack>


                    <XReading report={report} />
                    <Stack mt={5} direction="row" alignItems="center" justifyContent="end" spacing={2}>
                        <Button color="primary" disabled={isLoading} size="large" onClick={() => navigate('/dashboard/cashier-reports')}>
                            Go to dashboard
                        </Button>
                        <Button
                            size="large"
                            color="primary"
                            disabled={isLoading}
                            onClick={() => {
                                generateZReport({ branchId: branch.id })
                                    .then(() => navigate('/pos/z-report'))
                            }}
                        >
                            Z-Reading Report
                        </Button>
                    </Stack>
                </Card>
            </Stack>
        </Stack>
    );
};

export default PrinterWrapper(XReportPage)