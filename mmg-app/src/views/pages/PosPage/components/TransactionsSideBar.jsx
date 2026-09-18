import React, { useState, useEffect } from 'react';
import {
    Container,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Stack,
    TextField,
    Paper,
    MenuItem,
    Box,
    Chip,
    IconButton,
    TablePagination,
    CircularProgress
} from '@mui/material';
import { MdUndo, MdRemoveRedEye } from 'react-icons/md';
import moment from 'moment';
import { useQuery } from 'react-query';
import { startCase, toLower, upperCase } from 'lodash';
import transaction from 'api/transaction';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { useAuth } from 'providers/AuthProvider';

const DEFAULT_FILTER = 'all';
const DateFilter = Object.freeze({
    ALL: 0,
    TODAY: 1,
    YESTERDAY: 2,
    THIS_WEEK: 3,
    THIS_MONTH: 4,
    THIS_YEAR: 5,
    LAST_WEEK: 6,
    LAST_MONTH: 7,
    LAST_YEAR: 8,
    CUSTOM_FILTER: 9,
    CUSTOM_DATE: 10
});

const DateFilterOptions = [
    { value: DateFilter.ALL, label: <em>All</em> },
    { value: DateFilter.TODAY, label: 'Today' },
    { value: DateFilter.YESTERDAY, label: 'Yesterday' },
    { value: DateFilter.THIS_WEEK, label: 'This Week' },
    { value: DateFilter.THIS_MONTH, label: 'This Month' },
    { value: DateFilter.THIS_YEAR, label: 'This Year' },
    { value: DateFilter.LAST_WEEK, label: 'Last Week' },
    { value: DateFilter.LAST_MONTH, label: 'Last Month' },
    { value: DateFilter.LAST_YEAR, label: 'Last Year' },
    { value: DateFilter.CUSTOM_DATE, label: 'Custom Date' },
    { value: DateFilter.CUSTOM_FILTER, label: 'Custom Filter' }
];

const TransactionsSlideBar = ({ cashierId, role, onRestoreTransaction }) => {
    console.log('branch: ', role);
    const { branch } = useAuth()

    const { data, isLoading, isError, error } = useQuery(
        'transactions',
        () => transaction.GetAllTransaction(),
    );

    const [searchFilter, setSearchFilter] = useState(null);
    const [transactions, setTransactions] = useState(data);
    const [statusFilter, setStatusFilter] = useState(DEFAULT_FILTER);
    const [branchFilter, setBranchFilter] = useState(branch?.name);
    const [dateFilter, setDateFilter] = useState(DateFilter.TODAY);
    const [customDateFilter, setCustomDateFilter] = useState({});
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [selectedTransactionId, setSelectedTransactionId] = React.useState(null);

    const { data: indiTrans, isLoading: loadingTrans } = useQuery(
        ['transaction', selectedTransactionId],
        () => transaction.GetTransaction(selectedTransactionId),
        {
            enabled: !!selectedTransactionId // Only run the query if a transaction ID is set
        }
    );


    useEffect(() => {
        let transactions = data || [];

        if (statusFilter && statusFilter != DEFAULT_FILTER)
            transactions = transactions?.filter((transaction) => transaction.status == statusFilter);

        if (branchFilter && branchFilter != DEFAULT_FILTER)
            transactions = transactions?.filter((transaction) => transaction.branch.name == branchFilter);

        if (dateFilter && dateFilter != DateFilter.ALL) {
            transactions = transactions?.filter((transaction) => {
                const date = moment(transaction?.transactionDate);
                const today = moment();

                switch (dateFilter) {
                    case DateFilter.TODAY:
                        return date.isSame(today, 'date');
                    case DateFilter.YESTERDAY:
                        return date.isSame(today.subtract(1, 'day'), 'date');
                    case DateFilter.THIS_WEEK:
                        return date.isSame(today, 'week');
                    case DateFilter.THIS_MONTH:
                        return date.isSame(today, 'month');
                    case DateFilter.THIS_YEAR:
                        return date.isSame(today, 'year');
                    case DateFilter.LAST_WEEK:
                        return date.isSame(today.subtract(1, 'week'), 'week');
                    case DateFilter.LAST_MONTH:
                        return date.isSame(today.subtract(1, 'month'), 'month');
                    case DateFilter.LAST_YEAR:
                        return date.isSame(today.subtract(1, 'year'), 'year');
                    case DateFilter.CUSTOM_DATE:
                        if (!customDateFilter.date) return true;
                        return date.isSame(customDateFilter.date, 'month');
                    case DateFilter.CUSTOM_FILTER:
                        if (!customDateFilter.startDate || !customDateFilter.endDate) return true;
                        return (
                            date?.isSameOrAfter(customDateFilter.startDate, 'date') &&
                            date?.isSameOrBefore(customDateFilter.startDate, 'date')
                        );
                    default:
                        return true;
                }
            });
        }
        if (searchFilter) {
            transactions = transactions?.filter(
                (transaction) =>
                    transaction?.transactionNo?.startsWith(searchFilter) ||
                    transaction?.invoiceNumber?.toString().startsWith(searchFilter) || // Changed to invoiceNumber
                    toLower(transaction?.customer?.firstName)?.startsWith(toLower(searchFilter)) ||
                    toLower(transaction?.customer?.lastName)?.startsWith(toLower(searchFilter))
            );
        }

        console.log('filter edited');
        setTransactions(transactions);
    }, [data, dateFilter, branchFilter, statusFilter, searchFilter]);

    useEffect(() => {
        if (selectedTransactionId) {
            console.log('dataXXX', indiTrans);
            onRestoreTransaction(indiTrans); // Trigger restoration if needed
        }
    }, [indiTrans, selectedTransactionId]);

    const handleApply = (transactionId) => {
        setSelectedTransactionId(transactionId);
        onRestoreTransaction(transactionId); // Trigger restoration
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const resetFilters = () => {
        setSearchFilter(null);
        setStatusFilter(DEFAULT_FILTER);
        setBranchFilter(branch?.name);
        setDateFilter(DateFilter.TODAY);
    };

    const renderTableView = () => (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <TableContainer component={Paper} style={{ flex: '1 1 auto', overflow: 'auto', maxHeight: 'calc(100vh - 254px)' }}>
                <Table stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell>Action</TableCell>
                            <TableCell sx={{ textWrap: 'nowrap' }}>Invoice #</TableCell>
                            <TableCell sx={{ textWrap: 'nowrap' }}>Serial #</TableCell>
                            <TableCell sx={{ textWrap: 'nowrap' }}>Adjustment Reference #</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Cashier</TableCell>
                            <TableCell>Customer</TableCell>
                            <TableCell>Gross Sale</TableCell>
                            <TableCell>Member Discount</TableCell>
                            <TableCell>Net Sale</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {transactions?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((transaction) => (
                            <TableRow key={transaction?._id}>
                                <TableCell>
                                    <Stack direction="row" justifyContent="flex-start" alignItems="center" spacing={2}>
                                        <IconButton onClick={() => handleApply(transaction?.id)} disabled={transaction?.status !== 'hold'}>
                                            <MdUndo />
                                        </IconButton>
                                        {/* <IconButton>
                                            <MdRemoveRedEye />
                                        </IconButton> */}
                                    </Stack>
                                </TableCell>
                                <TableCell>
                                    {transaction.status == 'completed' || !transaction.serialNumber ? String(transaction.invoiceNumber).padStart(6, '0') : ''}
                                </TableCell>
                                <TableCell component="th" scope="row">
                                    {transaction.status == 'completed' || !transaction.serialNumber ? '' : String(transaction.serialNumber).padStart(6, '0')}
                                </TableCell>
                                <TableCell component="th" scope="row">
                                    {['cancelled', 'refunded'].includes(transaction.status) && transaction.serialNumber ? String(transaction.invoiceNumber).padStart(6, '0') : null}
                                </TableCell>
                                <TableCell sx={{ textWrap: 'nowrap' }}>{moment(transaction.transactionDate).format('YYYY-MM-DD hh:mmA')}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={upperCase(transaction.status)}
                                        size="small"
                                        variant="outlined"
                                        color={
                                            transaction.status === 'completed'
                                                ? 'success'
                                                : transaction.status === 'hold'
                                                    ? 'info' : 'error'
                                        }
                                    />
                                </TableCell>
                                <TableCell>{transaction.cashier?.name}</TableCell>
                                <TableCell>{transaction.customer?.name}</TableCell>
                                <TableCell sx={{ textWrap: 'nowrap' }}>{!['cancelled', 'refunded'].includes(transaction.status) || !transaction.serialNumber ? transaction.totalSalesWithoutMemberDiscount.toFixed(2) : null}</TableCell>
                                <TableCell sx={{ textWrap: 'nowrap' }}>{!['cancelled', 'refunded'].includes(transaction.status) || !transaction.serialNumber ? transaction.totalMemberDiscount.toFixed(2) : null}</TableCell>
                                <TableCell sx={{ textWrap: 'nowrap' }}>{transaction.status != 'cancelled' || !transaction.serialNumber ? transaction.totalNetSales.toFixed(2) : null}</TableCell>


                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <div style={{ flex: '0 1 auto' }}>
                <TablePagination
                    component="div"
                    count={transactions?.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <Stack direction="column" justifyContent="center" alignItems="center" spacing={2}>
                <CircularProgress />
            </Stack>
        );
    }

    if (isError) {
        return <Typography color="error">{error.message}</Typography>;
    }

    return (
        <Container maxWidth="xl" sx={{ padding: '16px' }}>
            <Typography variant="h3" mb={2}>
                Transactions
            </Typography>
            <LocalizationProvider dateAdapter={AdapterMoment}>
                <Stack mb={1} spacing={1} direction={{ xs: 'column', sm: 'row' }}>
                    {/* <TextField
                        select
                        size="small"
                        label="Branch"
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e?.target?.value)}
                        sx={{ minWidth: 120 }}
                        disabled={role === 'cashier'}
                    >
                        <MenuItem value={DEFAULT_FILTER}>
                            <em>All</em>
                        </MenuItem>
                        {data &&
                            Object.keys(Object.groupBy(data, ({ branch }) => branch?.name))
                                .filter((key) => !key || key != 'undefined')
                                .map((branch) => <MenuItem value={branch}>{startCase(branch)}</MenuItem>)}
                    </TextField> */}
                    <TextField
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target?.value)}
                        size="small"
                        label="Search by invoice no. or customer name"
                    />
                    <TextField
                        select
                        size="small"
                        label="Status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e?.target?.value)}
                        sx={{ minWidth: 120 }}
                    >
                        <MenuItem value={DEFAULT_FILTER}>
                            <em>All</em>
                        </MenuItem>
                        {data &&
                            Object.keys(Object.groupBy(data, ({ status }) => status))
                                .filter((key) => !key || key != 'undefined')
                                .map((status) => <MenuItem value={status}>{startCase(status)}</MenuItem>)}
                    </TextField>
                    <TextField
                        select
                        size="small"
                        label="Date"
                        value={dateFilter}
                        onChange={(e) => {
                            setDateFilter(e?.target?.value);
                            setCustomDateFilter({});
                        }}
                        sx={{ minWidth: 200 }}
                    >
                        {DateFilterOptions.map((option) => (
                            <MenuItem value={option.value}>{option.label}</MenuItem>
                        ))}
                    </TextField>
                    {dateFilter == DateFilter.CUSTOM_DATE && (
                        <DatePicker
                            label="Custom Date"
                            disableFuture
                            value={customDateFilter?.date}
                            onAccept={(value) => setCustomDateFilter((date) => ({ ...date, date: value }))}
                            views={['year', 'month']}
                            slotProps={{
                                textField: { size: 'small' },
                                actionBar: {
                                    actions: ['clear', 'today', 'accept']
                                }
                            }}
                        />
                    )}
                    {dateFilter == DateFilter.CUSTOM_FILTER && (
                        <>
                            <DatePicker
                                disableFuture
                                value={customDateFilter?.startDate}
                                onAccept={(value) => setCustomDateFilter((date) => ({ ...date, startDate: value }))}
                                openTo="year"
                                views={['year', 'month', 'day']}
                                slotProps={{
                                    textField: { size: 'small' },
                                    actionBar: {
                                        actions: ['clear', 'today', 'accept']
                                    }
                                }}
                                label="Start Date"
                            />
                            <DatePicker
                                disableFuture
                                disabled={!customDateFilter?.startDate}
                                onAccept={(value) => setCustomDateFilter((date) => ({ ...date, endDate: value }))}
                                openTo="year"
                                shouldDisableDate={(date) => customDateFilter?.startDate?.isAfter(date, 'date')}
                                shouldDisableMonth={(month) => customDateFilter.startDate?.isAfter(month, 'month')}
                                shouldDisableYear={(year) => customDateFilter.startDate?.isAfter(year, 'year')}
                                views={['year', 'month', 'day']}
                                slotProps={{
                                    textField: { size: 'small' },
                                    actionBar: {
                                        actions: ['clear', 'today', 'accept']
                                    }
                                }}
                                label="End Date"
                            />
                        </>
                    )}
                    <Button variant="contained" onClick={resetFilters}>
                        Reset
                    </Button>
                    <Box flex={1} />
                </Stack>
                <Typography ml={1} mb={1} fontStyle="italic" color="gray">
                    {transactions?.length} transactions
                </Typography>
            </LocalizationProvider>
            {!isLoading && transactions && renderTableView()}
        </Container>
    );
};

export default TransactionsSlideBar;
