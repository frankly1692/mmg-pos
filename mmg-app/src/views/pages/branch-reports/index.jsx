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
import _, { omit, startCase } from 'lodash';
import moment from 'moment';
import branch_reports from 'api/branch_reports';

import { useAuth } from 'providers/AuthProvider';
import { usePrinter } from 'providers/PrinterProvider';
import { dvoteDetails } from 'utils/mockData';
import BranchFilter, { DEFAULT_BRANCH_FILTER } from 'ui-component/filter/BranchFilter';
import ReportPagination from 'ui-component/ReportPagination';
import { useEffect, useState } from 'react';
import Role from 'utils/Role';
import DateFilter, { DateFilterEnum } from 'ui-component/filter/DateFilter';
import { CSVLink } from 'react-csv';
import generateReportFilename from '../../../utils/generateReportFilename';
import { useCallback } from 'react';
import { CashierReportWrapper, useCashierReport } from 'providers/CashierReportProvider';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ZReportDialog from '../PosPage/components/ZReportDialog';

const clip = (value) => (value ? value.toFixed(2) : (0).toFixed(2));

function ShiftStatusChip() {
    // Reflects whether the logged-in user is currently clocked in today — a real, computed
    // status rather than a decorative badge.
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

function BranchReportsPage() {
    const { user, branch, loading: fetchingUser, matchRole } = useAuth();
    const { isClockedIn } = useCashierReport() || {};
    const { print, printing } = usePrinter();

    const [selected, setSelected] = useState(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const hasOnlyOneBranch = user?.branches?.length == 1;

    const [branchFilter, setBranchFilter] = useState(hasOnlyOneBranch ? branch?.name : DEFAULT_BRANCH_FILTER);
    const [dateFilter, setDateFilter] = useState(DateFilterEnum.THIS_MONTH);
    const [customDate, setCustomDate] = useState({});

    const params = _.pickBy(
        {
            dateFilter: dateFilter,
            customDate: customDate?.date?.format('YYYY-MM-DD'),
            startDate: customDate?.startDate?.format('YYYY-MM-DD'),
            endDate: customDate?.endDate?.format('YYYY-MM-DD'),
            branchIds: user?.branches?.map((branch) => branch.id).join(',')
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
        queryKey: ['branch-reports', dateFilter, customDate, user],
        queryFn: () => branch_reports.GetAllBranchReport(params),
        enabled: !fetchingUser && user != null,
        retry: 1
    });
    const reports = data || [];

    const [filteredReports, setFilteredReports] = useState(reports);

    const today = moment().toISOString().split('T')[0];
    const todaysBranchReport = reports?.find((report) => report.branch.id == branch?.id && report.date == today);

    useEffect(() => {
        setFilteredReports(reports || []);
    }, [reports, user]);

    const fileName = generateReportFilename('branch-reports', { branchFilter, dateFilter, customDate }) + '.csv';

    const exportToCSV = useCallback(() => {
        const reports = filteredReports;

        const header = Object.keys(reports?.[0]).map((item) => startCase(item));
        const data = reports.map((item) =>
            Object.values({
                ...omit(item, 'salesDeposits'),
                branch: item.branch.name,
                cashier: startCase(item.cashier?.name),
                createdAt: moment(item.createdAt).format()
            })
        );
        return [header, ...data];
    }, [filteredReports]);

    // "Print Report" reprints today's own branch Z-Reading — the same report the
    // "Shift Active/Closed" chip reflects — not any arbitrary row in the table below.
    const handlePrintTodayReport = () => {
        print('printer', 'report', {
            ...todaysBranchReport,
            reprint: true,
            dvoteDetails,
            type: 'Z_REPORT'
        });
    };

    const isViewingAllBranches = branchFilter === DEFAULT_BRANCH_FILTER;

    const paginated = filteredReports.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const renderHeader = () => (
        <Card>
            <Box sx={{ px: 3, py: 2.5, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography variant="h2" fontWeight={600}>
                            Branch Reports
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
                        disabled={!isClockedIn || !todaysBranchReport || printing}
                    >
                        {printing ? 'Printing…' : 'Print Report'}
                    </Button>
                    {!filteredReports || filteredReports?.length == 0 ? (
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
                        | Location: {isViewingAllBranches ? 'All branches' : startCase(branchFilter)}
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
                                'Total Opening Fund',
                                'Total Ending Cash Count',
                                'Total Gross Sales',
                                'Total Member Discount',
                                'Total Net Sales',
                                'Date',
                                'Action'
                            ].map((head) => (
                                <TableCell
                                    key={head}
                                    align={head === 'Action' ? 'right' : 'left'}
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
                                            Couldn't load branch reports
                                        </Typography>
                                        <Typography color="text.secondary" variant="body2">
                                            Something went wrong while summarizing this period. Please try again, or narrow the date/branch
                                            filter and retry.
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
                                <TableRow key={report._id} hover>
                                    <TableCell sx={{ textWrap: 'nowrap' }}>
                                        <Chip
                                            size="small"
                                            variant="outlined"
                                            label={
                                                report.invoiceStartNumber
                                                    ? `${String(report.invoiceStartNumber).padStart(6, '0')} - ${String(
                                                          report.invoiceEndNumber
                                                      ).padStart(6, '0')}`
                                                    : '—'
                                            }
                                        />
                                    </TableCell>
                                    {isViewingAllBranches && <TableCell>{startCase(report.branch.name)}</TableCell>}
                                    <TableCell>{clip(report.openingFund?.total || 0)}</TableCell>
                                    <TableCell>{clip(report.endingCashCount?.total || 0)}</TableCell>
                                    <TableCell>{clip(report.totalSalesWithoutMemberDiscount)}</TableCell>
                                    <TableCell>{clip(report.totalMemberDiscount)}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={700}>
                                            {clip(report.totalNetSales)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ textWrap: 'nowrap' }}>{moment(report.date).format('YYYY-MM-DD')}</TableCell>
                                    <TableCell align="right">
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            color="primary"
                                            onClick={() => setSelected(report)}
                                            startIcon={<VisibilityIcon fontSize="small" />}
                                            disabled={report.transactions?.length == 0}
                                        >
                                            View
                                        </Button>
                                    </TableCell>
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
            <ZReportDialog open={selected != null} onClose={() => setSelected(null)} report={selected} />
        </Stack>
    );
}

export default CashierReportWrapper(BranchReportsPage);
