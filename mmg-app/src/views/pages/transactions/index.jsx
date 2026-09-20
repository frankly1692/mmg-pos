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
    MenuItem,
    Box,
    Button,
    TablePagination,
    IconButton
} from '@mui/material';
import { useQuery } from 'react-query';
import _, { omit, pick, startCase, toLower, upperCase } from 'lodash';
import transaction from 'api/transaction';
import moment from 'moment';
import UpdateTransactionModal from './components/UpdateTransactionModal';
import { StatusOptions } from './components/StatusSelector';
import { useCallback, useEffect, useState } from 'react';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { useAuth } from 'providers/AuthProvider';
import BranchFilter from 'ui-component/filter/BranchFilter';
import Role from 'utils/Role';
import { DateFilterEnum, DateFilterOptions } from 'ui-component/filter/DateFilter';
import generateReportFilename from 'utils/generateReportFilename';
import { CSVLink } from 'react-csv';
import TransactionModal from './components/TransactionModal';
import PrinterProvider from 'providers/PrinterProvider';

const DEFAULT_FILTER = 'all';

function TransactionsPage() {
    const { branch, user, matchRole } = useAuth();
    const [dateFilter, setDateFilter] = useState(DateFilterEnum.TODAY);
    const [customDate, setCustomDate] = useState({});

    const hasOnlyOneBranch = user?.branches?.length == 1;
    const hasMultipleBranch = user?.branches?.length > 1;

    const [branchFilter, setBranchFilter] = useState(matchRole(Role.ADMIN) || hasMultipleBranch ? DEFAULT_FILTER : branch?.name);

    const filterByUser = matchRole(Role.ADMIN) || hasMultipleBranch;

    const fileName = generateReportFilename('transactions', { branchFilter, dateFilter, customDate }) + '.csv';

    const params = _.pickBy(
        {
            dateFilter: dateFilter,
            customDate: customDate?.date?.format('YYYY-MM-DD'),
            startDate: customDate?.startDate?.format('YYYY-MM-DD'),
            endDate: customDate?.endDate?.format('YYYY-MM-DD')
        },
        (value) => value != null
    );

    const { data, isLoading, isRefetching } = useQuery({
        queryKey: ['transactions', dateFilter, customDate],
        queryFn: () => transaction.GetAllTransaction(params)
    });

    const [searchFilter, setSearchFilter] = useState('');
    const [transactions, setTransactions] = useState(data);
    const [statusFilter, setStatusFilter] = useState(DEFAULT_FILTER);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    useEffect(() => {
        let transactions = data || [];

        if (statusFilter && statusFilter != DEFAULT_FILTER) transactions = transactions?.filter((transaction) => transaction.status == statusFilter);

        if (searchFilter) {
            transactions = transactions?.filter(
                (transaction) =>
                    transaction.transactionNo?.startsWith(searchFilter) ||
                    toLower(transaction.customer?.firstName)?.startsWith(toLower(searchFilter)) ||
                    toLower(transaction.customer?.lastName)?.startsWith(toLower(searchFilter))
            );
        }

        setTransactions(transactions);
    }, [data, statusFilter, searchFilter]);

    const exportToCSV = useCallback(() => {
        const headers = [
            'Transaction Number',
            'Invoice Number',
            'Reference Number',
            'Status',
            'Branch',
            'Cashier',
            'Customer',
            'Discount Name',
            'Gross Sale',
            'Member Discount',
            'VAT Amount',
            'VAT-Exempt Sales',
            'Net Sale',
            'Tender Type',
            'Tender Amount',
            'Reason',
            'Date'
        ];

        const data = transactions.map((item) => {
            const isCompleted = ['completed'].includes(item.status);
            const isRefundedOrCancelled = ['refunded', 'cancelled'].includes(item.status);

            const invoiceNumber =
                isCompleted || (item.invoiceNumber && !item.serialNumber) ? String(item.invoiceNumber).padStart(6, '0') : '';

            const referenceNumber = isRefundedOrCancelled && item.serialNumber ? String(item.invoiceNumber).padStart(6, '0') : '';

            // Extract discount names
            const discountNames = item.discounts?.map((d) => d.name || startCase(d.memberType)).filter(Boolean).join(', ') || '';

            // Values
            const grossSale = !['cancelled'].includes(item.status) || !item.serialNumber ? item.totalSalesWithoutMemberDiscount?.toFixed(2) : '0.00';
            const memberDiscount = !['cancelled'].includes(item.status) || !item.serialNumber ? item.totalMemberDiscount?.toFixed(2) : '0.00';
            const netSale = item.status != 'cancelled' || !item.serialNumber ? item.totalNetSales?.toFixed(2) : '0.00';

            return [
                item.transactionNumber,
                invoiceNumber,
                referenceNumber,
                startCase(item.status),
                item.branch?.name,
                item.cashier?.name,
                item.customer?.name,
                discountNames,
                grossSale,
                memberDiscount,
                '0.00', // VAT Amount
                netSale, // VAT-Exempt Sales matches Net Sale
                netSale,
                item.tender?.type,
                item.tender?.amount,
                item.reason,
                moment(item.transactionDate).format('YYYY-MM-DD hh:mmA')
            ];
        });

        return [headers, ...data];
    }, [transactions]);

    const resetFilters = () => {
        setSearchFilter('');
        setStatusFilter(DEFAULT_FILTER);
        setBranchFilter(DEFAULT_FILTER);
        setDateFilter(DateFilterEnum.TODAY);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const renderHeader = () => (
        <Card>
            <Box sx={{ px: 3, py: 2.5, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography variant="h2" fontWeight={600}>
                            Transactions
                        </Typography>
                        <Chip
                            size="small"
                            label={`${(transactions?.length || 0).toLocaleString()} Transactions`}
                            sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 500 }}
                        />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                        Review sales, cancellations, refunds, and held transactions across the register.
                    </Typography>
                </Box>
                {!transactions || transactions?.length == 0 || isLoading ? (
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
                    <Stack spacing={1.5} direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} flexWrap="wrap" useFlexGap>
                        <TextField
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target?.value)}
                            size="small"
                            placeholder="Search by transaction # or customer..."
                            sx={{ minWidth: 260 }}
                            InputProps={{
                                startAdornment: <SearchIcon fontSize="small" color="action" sx={{ mr: 1 }} />,
                                endAdornment: searchFilter ? (
                                    <IconButton size="small" onClick={() => setSearchFilter('')}>
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                ) : null
                            }}
                        />
                        <TextField
                            select
                            size="small"
                            label="Status"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e?.target?.value)}
                            sx={{ minWidth: 150 }}
                        >
                            <MenuItem value={DEFAULT_FILTER}>All</MenuItem>
                            {data && ['completed', 'hold', 'cancelled', 'refunded'].map((status) => <MenuItem key={status} value={status}>{startCase(status)}</MenuItem>)}
                        </TextField>
                        <BranchFilter
                            filter={branchFilter}
                            onChange={(value) => setBranchFilter(value)}
                            values={data}
                            setValues={setTransactions}
                            {...(matchRole(Role.CASHIER)
                                ? {
                                      options: user?.branches?.map((branch) => branch.name),
                                      disabled: hasOnlyOneBranch
                                  }
                                : {})}
                        />
                        <TextField
                            select
                            size="small"
                            label="Date"
                            value={dateFilter}
                            onChange={(e) => {
                                setDateFilter(e?.target?.value);
                                setCustomDate({});
                            }}
                            sx={{ minWidth: 200 }}
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
                                slotProps={{
                                    textField: { size: 'small' },
                                    actionBar: { actions: ['clear', 'today', 'accept'] }
                                }}
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
                                    slotProps={{
                                        textField: { size: 'small' },
                                        actionBar: { actions: ['clear', 'today', 'accept'] }
                                    }}
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
                                    slotProps={{
                                        textField: { size: 'small' },
                                        actionBar: { actions: ['clear', 'today', 'accept'] }
                                    }}
                                    label="End Date"
                                />
                            </>
                        )}
                        <Button variant="outlined" color="inherit" onClick={resetFilters}>
                            Reset
                        </Button>
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
                            {[
                                '#',
                                'Invoice #',
                                'Reference #',
                                'Status',
                                ...(filterByUser ? ['Branch', 'Cashier'] : []),
                                'Customer',
                                'Gross Sale',
                                'Member Discount',
                                'Net Sale',
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
                        {!isLoading &&
                            transactions?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((transaction) => (
                                <TableRow key={transaction._id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                    <TableCell>{transaction.transactionNumber}</TableCell>
                                    <TableCell>
                                        {['completed'].includes(transaction.status) || (transaction.invoiceNumber && !transaction.serialNumber)
                                            ? String(transaction.invoiceNumber).padStart(6, '0')
                                            : ''}
                                    </TableCell>
                                    <TableCell>
                                        {['refunded', 'cancelled'].includes(transaction.status) && transaction.serialNumber
                                            ? String(transaction.invoiceNumber).padStart(6, '0')
                                            : null}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={upperCase(transaction.status)}
                                            size="small"
                                            variant="outlined"
                                            color={
                                                transaction.status === 'completed' ? 'success' : transaction.status === 'hold' ? 'info' : 'error'
                                            }
                                        />
                                    </TableCell>
                                    {filterByUser && (
                                        <>
                                            <TableCell>{transaction.branch.name}</TableCell>
                                            <TableCell>{transaction.cashier.name}</TableCell>
                                        </>
                                    )}
                                    <TableCell>{transaction.customer.name}</TableCell>
                                    <TableCell sx={{ textWrap: 'nowrap' }}>
                                        {!['cancelled'].includes(transaction.status) || !transaction.serialNumber
                                            ? transaction.totalSalesWithoutMemberDiscount.toFixed(2)
                                            : null}
                                    </TableCell>
                                    <TableCell sx={{ textWrap: 'nowrap' }}>
                                        {!['cancelled'].includes(transaction.status) || !transaction.serialNumber
                                            ? transaction.totalMemberDiscount.toFixed(2)
                                            : null}
                                    </TableCell>
                                    <TableCell sx={{ textWrap: 'nowrap' }}>
                                        {transaction.status != 'cancelled' || !transaction.serialNumber ? transaction.totalNetSales.toFixed(2) : null}
                                    </TableCell>
                                    <TableCell sx={{ textWrap: 'nowrap' }}>{moment(transaction.transactionDate).format('YYYY-MM-DD hh:mmA')}</TableCell>
                                    <TableCell align="right">
                                        <TransactionModal transaction={transaction} />
                                    </TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
                {isLoading && (
                    <Stack alignItems="center" py={6}>
                        <CircularProgress size={28} />
                    </Stack>
                )}
                {!isLoading && (!transactions || transactions.length === 0) && (
                    <Stack alignItems="center" py={6}>
                        <Typography color="text.secondary" variant="h5">
                            No data available for this table
                        </Typography>
                    </Stack>
                )}
            </TableContainer>
            <TablePagination
                component="div"
                count={transactions?.length || 0}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                sx={{ borderTop: '1px solid', borderColor: 'divider' }}
            />
        </Card>
    );

    return (
        <PrinterProvider>
            <Stack spacing={2.5}>
                {renderHeader()}
                {renderFilters()}
                {renderTable()}
            </Stack>
        </PrinterProvider>
    );
}

export default TransactionsPage;
