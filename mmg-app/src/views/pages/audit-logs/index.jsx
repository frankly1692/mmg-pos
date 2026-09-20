import {
    Stack,
    TextField,
    Typography,
    TableContainer,
    TableHead,
    TableRow,
    TableBody,
    TableCell,
    Table,
    Card,
    CircularProgress,
    Chip,
    Avatar,
    IconButton,
    MenuItem,
    Box,
    Button
} from '@mui/material';
import { useQuery } from 'react-query';
import _, { omit, startCase } from 'lodash';
import auditLog from 'api/audit_logs';
import { useMemo, useCallback, useState } from 'react';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { DateFilterEnum, DateFilterOptions } from 'ui-component/filter/DateFilter';
import generateReportFilename from 'utils/generateReportFilename';
import { CSVLink } from 'react-csv';
import ReportPagination from 'ui-component/ReportPagination';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import moment from 'moment';

// Deterministic pastel avatar color derived from the user's own id, stable across reloads/re-sorts.
const stringToAvatarColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str?.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return { bg: `hsl(${hue}, 70%, 92%)`, color: `hsl(${hue}, 55%, 38%)` };
};

const getInitials = (name) =>
    (name || '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0])
        .join('')
        .toUpperCase();

// Color-codes the action chip by keyword in the action name — a rough, non-authoritative grouping
// (login/create/update/delete/error) purely for visual scanning, not a real classification field.
const getActionStyle = (name) => {
    const lower = (name || '').toLowerCase();
    if (/(delete|remove|cancel|refund|_err)/.test(lower)) return { bg: '#FEE2E2', color: '#B91C1C' };
    if (/(create|register|time_in)/.test(lower)) return { bg: '#DBEAFE', color: '#1D4ED8' };
    if (/(update|edit)/.test(lower)) return { bg: '#FEF3C7', color: '#B45309' };
    if (/(login|logout|time_out)/.test(lower)) return { bg: '#DCFCE7', color: '#15803D' };
    return { bg: '#F1F5F9', color: '#475569' };
};

function AuditLogsPage() {
    const [dateFilter, setDateFilter] = useState(DateFilterEnum.TODAY);
    const [customDate, setCustomDate] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const fileName = generateReportFilename('audit-logs', { dateFilter, customDate }) + '.csv';

    const params = _.pickBy(
        {
            dateFilter: dateFilter,
            customDate: customDate?.date?.format('YYYY-MM-DD'),
            startDate: customDate?.startDate?.format('YYYY-MM-DD'),
            endDate: customDate?.endDate?.format('YYYY-MM-DD')
        },
        (value) => value != null
    );

    const { data: logs, isLoading } = useQuery({
        queryKey: ['audit-logs', dateFilter, customDate],
        queryFn: () => auditLog.GetAllLogs(params)
    });

    const filteredLogs = useMemo(() => {
        const query = searchQuery.toLowerCase();
        if (!query) return logs || [];
        return (logs || []).filter((log) => {
            const userName = `${log.user?.first_name} ${log.user?.last_name}`.toLowerCase();
            return (
                log.action?.name?.toLowerCase().includes(query) ||
                userName.includes(query) ||
                log.ipaddress?.toLowerCase().includes(query)
            );
        });
    }, [logs, searchQuery]);

    const paginated = filteredLogs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const exportToCSV = useCallback(() => {
        let data = filteredLogs.map((item) => ({
            ...omit(item, ['user', 'data', 'error', 'ipaddress']),
            action: item.action.name,
            data: item.data ? Object.entries(item.data).map(([key, value]) => `${key}:${value}`).join('; ') : null,
            user: startCase(`${item.user?.first_name} ${item.user?.last_name}`)
        }));

        const header = Object.keys(data?.[0]).map((item) => startCase(item));
        data = data.map((item) => Object.values(item));

        return [header, ...data];
    }, [filteredLogs]);

    const resetFilters = () => {
        setDateFilter(DateFilterEnum.TODAY);
        setSearchQuery('');
        setPage(0);
    };

    const renderHeader = () => (
        <Card>
            <Box sx={{ px: 3, py: 2.5, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography variant="h2" fontWeight={600}>
                            Audit Logs
                        </Typography>
                        <Chip
                            size="small"
                            label="System Security & Compliance"
                            sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 500 }}
                        />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                        Track, monitor, and review comprehensive administrative activity and security events across all branches.
                    </Typography>
                </Box>
                {!filteredLogs || filteredLogs?.length == 0 || isLoading ? (
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
            </Box>
        </Card>
    );

    const renderFilters = () => (
        <Card>
            <Box sx={{ px: 3, py: 2.5 }}>
                <LocalizationProvider dateAdapter={AdapterMoment}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
                            <TextField
                                select
                                size="small"
                                label="Date"
                                value={dateFilter}
                                onChange={(e) => {
                                    setDateFilter(e?.target?.value);
                                    setCustomDate({});
                                    setPage(0);
                                }}
                                sx={{ minWidth: 160 }}
                            >
                                {DateFilterOptions.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                            {dateFilter == DateFilterEnum.CUSTOM_DATE && (
                                <DatePicker
                                    label="Custom Date"
                                    disableFuture
                                    value={customDate?.date}
                                    onAccept={(value) => setCustomDate((date) => ({ ...date, date: value }))}
                                    views={['year', 'month']}
                                    slotProps={{ textField: { size: 'small' }, actionBar: { actions: ['clear', 'today', 'accept'] } }}
                                />
                            )}
                            {dateFilter == DateFilterEnum.CUSTOM_FILTER && (
                                <>
                                    <DatePicker
                                        disableFuture
                                        value={customDate?.startDate}
                                        onAccept={(value) => setCustomDate((date) => ({ ...date, startDate: value }))}
                                        openTo="year"
                                        views={['year', 'month', 'day']}
                                        slotProps={{ textField: { size: 'small' }, actionBar: { actions: ['clear', 'today', 'accept'] } }}
                                        label="Start Date"
                                    />
                                    <DatePicker
                                        disableFuture
                                        disabled={!customDate?.startDate}
                                        onAccept={(value) => setCustomDate((date) => ({ ...date, endDate: value }))}
                                        openTo="year"
                                        shouldDisableDate={(date) => customDate?.startDate?.isAfter(date, 'date')}
                                        shouldDisableMonth={(month) => customDate.startDate?.isAfter(month, 'month')}
                                        shouldDisableYear={(year) => customDate.startDate?.isAfter(year, 'year')}
                                        views={['year', 'month', 'day']}
                                        slotProps={{ textField: { size: 'small' }, actionBar: { actions: ['clear', 'today', 'accept'] } }}
                                        label="End Date"
                                    />
                                </>
                            )}
                            <Button variant="contained" onClick={resetFilters}>
                                Reset
                            </Button>
                        </Stack>
                        <TextField
                            size="small"
                            placeholder="Search by action, user, or IP..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(0);
                            }}
                            sx={{ minWidth: 280 }}
                            InputProps={{
                                startAdornment: <SearchIcon fontSize="small" color="action" sx={{ mr: 1 }} />,
                                endAdornment: searchQuery ? (
                                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                ) : null
                            }}
                        />
                    </Stack>
                </LocalizationProvider>
            </Box>
        </Card>
    );

    const renderTable = () => (
        <Card sx={{ overflow: 'hidden' }}>
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                            {['Action', 'User', 'Data', 'Message', 'Date & Time'].map((head) => (
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
                        {!isLoading && paginated.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5}>
                                    <Stack alignItems="center" py={6}>
                                        <Typography color="text.secondary" variant="h5">
                                            No data available for this table
                                        </Typography>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoading &&
                            paginated.map((log) => {
                                const userName = startCase(`${log.user?.first_name} ${log.user?.last_name}`);
                                const avatarColor = stringToAvatarColor(log.user?._id || userName);
                                const actionStyle = getActionStyle(log.action?.name);
                                return (
                                    <TableRow key={log._id} hover>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                label={log.action.name}
                                                sx={{ bgcolor: actionStyle.bg, color: actionStyle.color, fontWeight: 500 }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: avatarColor.bg, color: avatarColor.color, fontWeight: 600 }}>
                                                    {getInitials(userName)}
                                                </Avatar>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {userName}
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'none' }}>
                                            <Typography variant="body2" color="text.secondary" noWrap>
                                                {log.data ? JSON.stringify(log.data) : '—'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{log.message}</TableCell>
                                        <TableCell sx={{ textWrap: 'nowrap' }}>{moment(log.datetime).format('YYYY-MM-DD hh:mmA')}</TableCell>
                                    </TableRow>
                                );
                            })}
                    </TableBody>
                </Table>
                {isLoading && (
                    <Stack alignItems="center" py={6}>
                        <CircularProgress size={28} />
                    </Stack>
                )}
            </TableContainer>
            <ReportPagination
                count={filteredLogs?.length || 0}
                page={page}
                onPageChange={setPage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(value) => {
                    setRowsPerPage(value);
                    setPage(0);
                }}
                itemLabel="records"
            />
        </Card>
    );

    return (
        <Stack spacing={2.5}>
            {renderHeader()}
            {renderFilters()}
            {renderTable()}
        </Stack>
    );
}

export default AuditLogsPage;
