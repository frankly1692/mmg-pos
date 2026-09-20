import {
    Stack,
    Typography,
    TableContainer,
    TableHead,
    TableRow,
    TableBody,
    TableCell,
    Table,
    Card,
    CircularProgress,
    Box,
    Button,
    Chip,
    IconButton
} from '@mui/material';
import { useQuery } from 'react-query';
import _, { startCase, omit } from 'lodash';
import moment from 'moment';

import { useAuth } from 'providers/AuthProvider';
import { usePrinter } from 'providers/PrinterProvider';
import { dvoteDetails } from 'utils/mockData';
import CashierReportProvider, { useCashierReport } from 'providers/CashierReportProvider';
import BranchFilter, { DEFAULT_BRANCH_FILTER } from 'ui-component/filter/BranchFilter';
import ReportPagination from 'ui-component/ReportPagination';
import { useCallback, useState } from 'react';
import Role from 'utils/Role';
import DateFilter, { DateFilterEnum } from 'ui-component/filter/DateFilter';
import cashier_report from 'api/cashier_report';
import generateReportFilename from '../../../utils/generateReportFilename';
import { CSVLink } from 'react-csv';
import SummaryReportDialog from '../PosPage/components/XReportDialog';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';

const clip = (value) => (value ? value.toFixed(2) : (0).toFixed(2));

function ShiftStatusChip() {
    // Reflects whether the logged-in user (cashier or admin) is currently clocked in today —
    // a real, computed status rather than a decorative badge.
    const { isClockedIn, loading } = useCashierReport() || {};
    if (loading) return null;
    return (
        <Chip
            size="small"
            label={isClockedIn ? 'Shift Active' : 'Shift Closed'}
            sx={
                isClockedIn
                    ? { bgcolor: 'success.light', color: 'success.dark', fontWeight: 500 }
                    : { bgcolor: 'grey.100', color: 'text.secondary', fontWeight: 500 }
            }
        />
    );
}

function CashierReportsPage() {
    const { user, branch, loading: fetchingUser, matchRole } = useAuth();
    const { reportForToday, isClockedIn } = useCashierReport() || {};
    const { print, printing } = usePrinter();

    const [selected, setSelected] = useState(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const hasOnlyOneBranch = user?.branches?.length == 1;
    const hasMultipleBranch = user?.branches?.length > 1;

    const [branchFilter, setBranchFilter] = useState(hasOnlyOneBranch ? branch?.name : DEFAULT_BRANCH_FILTER);
    const [dateFilter, setDateFilter] = useState(DateFilterEnum.THIS_MONTH);
    const [customDate, setCustomDate] = useState({});

    const params = _.pickBy(
        {
            dateFilter: dateFilter,
            customDate: customDate?.date?.format('YYYY-MM-DD'),
            startDate: customDate?.startDate?.format('YYYY-MM-DD'),
            endDate: customDate?.endDate?.format('YYYY-MM-DD'),
            cashierId: matchRole(Role.CASHIER) ? user?._id : null
        },
        (value) => value != null
    );

    const {
        data,
        isLoading: fetchingReports,
        isError,
        isRefetching,
        dataUpdatedAt,
        refetch
    } = useQuery({
        queryKey: ['cashier-reports', dateFilter, customDate],
        queryFn: () => cashier_report.GetAllCashierReport(params),
        retry: 1
    });
    const reports = data?.reports;
    const [filteredReports, setFilteredReports] = useState(reports);

    const fileName = generateReportFilename('cashier-reports', { branchFilter, dateFilter, customDate }) + '.csv';

    const exportToCSV = useCallback(() => {
        const reports = filteredReports.map((item) => ({
            ...omit(item, ['invoiceNumberStr']),
            branch: item.branch.name,
            cashier: startCase(item.cashier.name),
            beginningCashOnHand: item.beginningCashOnHand?.total || 0,
            endingCashOnHand: item.endingCashOnHand?.total || 'N/A',
            timeIn: moment(item.timeIn, 'hh:mm:ss').format('hh:mm:ss A'),
            timeOut: item.timeOut ? moment(item.timeOut, 'hh:mm:ss').format('hh:mm:ss A') : 'N/A'
        }));

        const header = Object.keys(reports?.[0]).map((item) => startCase(item));
        const data = reports.map((item) => Object.values(item));

        return [header, ...data];
    }, [filteredReports]);

    // "Print Report" reprints the logged-in user's own X-Reading for today — the same report the
    // "Shift Active/Closed" chip reflects — not any arbitrary row in the table below.
    const handlePrintTodayReport = () => {
        print('printer', 'report', {
            ...reportForToday,
            reprint: true,
            dvoteDetails,
            type: 'X_REPORT'
        });
    };

    const isViewingAllBranches = branchFilter === DEFAULT_BRANCH_FILTER;
    const showCashierColumn = matchRole(Role.ADMIN);

    const paginated = (filteredReports || []).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const renderHeader = () => (
        <Card>
            <Box sx={{ px: 3, py: 2.5, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography variant="h2" fontWeight={600}>
                            Cashier Reports
                        </Typography>
                        <ShiftStatusChip />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                        View end-of-day sales, collections, and settlement summaries across branches.
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1.5}>
                    <Button
                        variant="outlined"
                        color="inherit"
                        startIcon={<PrintOutlinedIcon />}
                        onClick={handlePrintTodayReport}
                        disabled={!isClockedIn || !reportForToday || printing}
                    >
                        {printing ? 'Printing…' : 'Print Report'}
                    </Button>
                    {!filteredReports || filteredReports?.length == 0 || fetchingReports ? (
                        <Button variant="outlined" color="inherit" startIcon={<DescriptionOutlinedIcon />} disabled>
                            Export CSV
                        </Button>
                    ) : (
                        <CSVLink data={exportToCSV()} filename={fileName} style={{ textDecoration: 'none' }}>
                            <Button variant="outlined" color="inherit" startIcon={<DescriptionOutlinedIcon />}>
                                Export CSV
                            </Button>
                        </CSVLink>
                    )}
                </Stack>
            </Box>
        </Card>
    );

    const renderFilters = () => (
        <Card>
            <Box sx={{ px: 3, py: 2.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <BranchFilter
                        filter={branchFilter}
                        onChange={(value) => setBranchFilter(value)}
                        values={reports}
                        setValues={setFilteredReports}
                        {...(matchRole(Role.CASHIER)
                            ? {
                                  options: user?.branches?.map((branch) => branch.name),
                                  disabled: hasOnlyOneBranch
                              }
                            : {})}
                    />
                    <DateFilter filter={dateFilter} onChange={(value) => setDateFilter(value)} customDate={customDate} onChangeCustomDate={setCustomDate} />
                </Stack>
            </Box>
        </Card>
    );

    const renderTable = () => (
        <Card sx={{ overflow: 'hidden' }}>
            <Box
                sx={{
                    px: 3,
                    py: 1.75,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: 'grey.50',
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                }}
            >
                <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
                    <Typography variant="subtitle1" fontWeight={600}>
                        Shift Reconciliation Log
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        (Showing {isViewingAllBranches ? 'all branches' : startCase(branchFilter)})
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                        {isRefetching ? 'Syncing…' : `Auto-sync: ${dataUpdatedAt ? moment(dataUpdatedAt).fromNow() : '—'}`}
                    </Typography>
                    <IconButton size="small" onClick={() => refetch()} disabled={isRefetching}>
                        <RefreshIcon fontSize="inherit" />
                    </IconButton>
                </Stack>
            </Box>

            <TableContainer sx={{ overflowX: 'auto' }}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                            {[
                                'Invoice Range #',
                                ...(isViewingAllBranches ? ['Branch'] : []),
                                ...(showCashierColumn ? ['Cashier'] : []),
                                'Total Opening Fund',
                                'Total Ending Cash Count',
                                'Total Gross Sales',
                                'Total Member Discount',
                                'Total Net Sales',
                                'Date'
                            ].map((head) => (
                                <TableCell
                                    key={head}
                                    sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', letterSpacing: 0.5, textWrap: 'nowrap' }}
                                >
                                    {head.toUpperCase()}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isError && (
                            <TableRow>
                                <TableCell colSpan={7}>
                                    <Stack alignItems="center" py={6} spacing={1}>
                                        <Typography color="error" variant="h5">
                                            Couldn't load shift reports
                                        </Typography>
                                        <Typography color="text.secondary" variant="body2">
                                            Something went wrong while summarizing shifts for this period. Please try again, or narrow the
                                            date/branch filter and retry.
                                        </Typography>
                                        <Button variant="outlined" size="small" onClick={() => refetch()}>
                                            Retry
                                        </Button>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        )}
                        {!fetchingReports && !isError && paginated.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7}>
                                    <Stack alignItems="center" py={6}>
                                        <Typography color="text.secondary" variant="h5">
                                            No data available for this table. Try changing your search filters
                                        </Typography>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        )}
                        {!fetchingReports &&
                            !isError &&
                            paginated.map((report) => (
                                <TableRow key={report._id} hover onClick={() => setSelected(report)} sx={{ cursor: 'pointer' }}>
                                    <TableCell sx={{ textWrap: 'nowrap' }}>
                                        <Chip
                                            size="small"
                                            variant="outlined"
                                            label={
                                                report.sales?.invoiceStartNumber
                                                    ? `${String(report.sales.invoiceStartNumber).padStart(6, '0')} - ${String(
                                                          report.sales.invoiceEndNumber
                                                      ).padStart(6, '0')}`
                                                    : '—'
                                            }
                                        />
                                    </TableCell>
                                    {isViewingAllBranches && <TableCell>{startCase(report.branch.name)}</TableCell>}
                                    {showCashierColumn && <TableCell>{report.cashier.name}</TableCell>}
                                    <TableCell>{clip(report?.openingFund?.total)}</TableCell>
                                    <TableCell>{clip(report?.endingCashCount?.total)}</TableCell>
                                    <TableCell>{clip(report.sales?.totalSalesWithoutMemberDiscount)}</TableCell>
                                    <TableCell>{clip(report.sales?.totalMemberDiscount)}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={700}>
                                            {clip(report.sales?.totalNetSales)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ textWrap: 'nowrap' }}>{moment(report.date).format('YYYY-MM-DD')}</TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
                {fetchingReports && (
                    <Stack alignItems="center" py={6}>
                        <CircularProgress size={28} />
                    </Stack>
                )}
            </TableContainer>
            <ReportPagination
                count={filteredReports?.length || 0}
                page={page}
                onPageChange={setPage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(value) => {
                    setRowsPerPage(value);
                    setPage(0);
                }}
                itemLabel="shifts"
            />
        </Card>
    );

    if (fetchingUser) {
        return (
            <Stack spacing={2.5}>
                {renderHeader()}
                {renderFilters()}
                <Stack alignItems="center" py={6}>
                    <CircularProgress size={28} />
                </Stack>
            </Stack>
        );
    }

    return (
        <Stack spacing={2.5}>
            {renderHeader()}
            {renderFilters()}
            {renderTable()}
            <SummaryReportDialog disableActions open={selected != null} onClose={() => setSelected(null)} report={selected} />
        </Stack>
    );
}

export default function () {
    return (
        <CashierReportProvider>
            <CashierReportsPage />
        </CashierReportProvider>
    );
}
