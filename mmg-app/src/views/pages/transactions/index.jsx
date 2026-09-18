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
    Paper,
    Card,
    CircularProgress,
    Chip,
    MenuItem,
    Box,
    Button,
    TablePagination
} from '@mui/material';
import { useQuery } from 'react-query';
import _, { omit, pick, startCase, toLower, upperCase } from 'lodash';
import MainCard from 'ui-component/cards/MainCard';
import transaction from 'api/transaction';
import moment from 'moment';
import UpdateTransactionModal from './components/UpdateTransactionModal';
import { StatusOptions } from './components/StatusSelector';
import { useCallback, useEffect, useState } from 'react';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { FaPesoSign } from 'react-icons/fa6';
import { useAuth } from 'providers/AuthProvider';
import Currency from 'ui-component/Currency';
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

    const [branchFilter, setBranchFilter] = useState(
        matchRole(Role.ADMIN) || hasMultipleBranch ? DEFAULT_FILTER : branch?.name
    );

    const filterByUser = matchRole(Role.ADMIN) || hasMultipleBranch

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
        queryFn: () => transaction.GetAllTransaction(params),
    });

    const [searchFilter, setSearchFilter] = useState(null);
    const [transactions, setTransactions] = useState(data);
    const [statusFilter, setStatusFilter] = useState(DEFAULT_FILTER);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    useEffect(() => {
        let transactions = data || [];

        if (statusFilter && statusFilter != DEFAULT_FILTER)
            transactions = transactions?.filter((transaction) => transaction.status == statusFilter);

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

            const invoiceNumber = isCompleted || (item.invoiceNumber && !item.serialNumber)
                ? String(item.invoiceNumber).padStart(6, '0')
                : '';

            const referenceNumber = isRefundedOrCancelled && item.serialNumber
                ? String(item.invoiceNumber).padStart(6, '0')
                : '';

            // Extract discount names
            const discountNames = item.discounts?.map(d => d.name || startCase(d.memberType)).filter(Boolean).join(', ') || '';

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
        setSearchFilter(null);
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

    const renderTable = (children) => (
        <PrinterProvider>
            <MainCard title="Transactions">
                <LocalizationProvider dateAdapter={AdapterMoment}>
                    <Stack mb={1} spacing={1} direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                        <TextField value={searchFilter} onChange={(e) => setSearchFilter(e.target?.value)} size="small" label="Search" />
                        <TextField
                            select
                            size="small"
                            label="Status"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e?.target?.value)}
                            sx={{ minWidth: 150 }}
                        >
                            <MenuItem value={DEFAULT_FILTER}>
                                <em>All</em>
                            </MenuItem>
                            {data &&
                                ['completed', 'hold', 'cancelled', 'refunded']
                                    .map((status) => <MenuItem value={status}>{startCase(status)}</MenuItem>)}
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
                                <MenuItem value={option.value}>{option.label}</MenuItem>
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
                                    actionBar: {
                                        actions: ['clear', 'today', 'accept']
                                    }
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
                                        actionBar: {
                                            actions: ['clear', 'today', 'accept']
                                        }
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
                        {!transactions || transactions?.length == 0 || isLoading ? (
                            <Button variant="outlined" disabled>
                                Export CSV
                            </Button>
                        ) : (
                            <CSVLink data={exportToCSV()} filename={fileName} style={{ textDecoration: 'none' }}>
                                <Button variant="outlined">Export CSV</Button>
                            </CSVLink>
                        )}
                    </Stack>
                    <Typography ml={1} mb={1} fontStyle="italic" color="gray">
                        {transactions?.length} transactions
                    </Typography>
                </LocalizationProvider>

                <Card sx={{ borderRadius: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ textWrap: 'nowrap' }}>#</TableCell>
                                    <TableCell sx={{ textWrap: 'nowrap' }}>Invoice #</TableCell>
                                    {/* <TableCell sx={{ textWrap: 'nowrap' }}>Serial #</TableCell> */}
                                    <TableCell sx={{ textWrap: 'nowrap' }}>Reference #</TableCell>
                                    <TableCell>Status</TableCell>
                                    {/* <TableCell>Requested By</TableCell>
                                <TableCell>Referred By</TableCell> */}

                                    {filterByUser && (
                                        <>
                                            <TableCell sx={{ textWrap: 'nowrap' }}>Branch</TableCell>
                                            <TableCell>Cashier</TableCell>
                                        </>
                                    )}

                                    <TableCell>Customer</TableCell>
                                    <TableCell>Gross Sale</TableCell>
                                    <TableCell>Member Discount</TableCell>
                                    <TableCell>Net Sale</TableCell>
                                    <TableCell>Date</TableCell>
                                    <TableCell sx={{ pl: 0, py: 0 }}>
                                        <Stack alignItems="end">
                                            <CircularProgress sx={{ visibility: isRefetching ? 'visible' : 'hidden' }} size={24} />
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {!isLoading && transactions?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((transaction) => (
                                    <TableRow key={transaction._id} sx={{ '&:last-child td, &:last-child th': { textTransform: 'capitalize', border: 0 } }}>
                                        <TableCell component="th" scope="row">
                                            {transaction.transactionNumber}
                                        </TableCell>
                                        <TableCell component="th" scope="row">
                                            {['completed'].includes(transaction.status) || (transaction.invoiceNumber && !transaction.serialNumber) ? String(transaction.invoiceNumber).padStart(6, '0') : ''}
                                        </TableCell>
                                        {/* <TableCell component="th" scope="row">
                                        {transaction.status == 'completed' || !transaction.serialNumber ? '' : String(transaction.serialNumber).padStart(6, '0')}
                                    </TableCell> */}
                                        <TableCell component="th" scope="row">
                                            {['refunded', 'cancelled'].includes(transaction.status) && transaction.serialNumber ? String(transaction.invoiceNumber).padStart(6, '0') : null}
                                        </TableCell>
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
                                        {filterByUser && (
                                            <>
                                                <TableCell>{transaction.branch.name}</TableCell>
                                                <TableCell>{transaction.cashier.name}</TableCell>
                                            </>
                                        )}
                                        <TableCell>{transaction.customer.name}</TableCell>
                                        <TableCell sx={{ textWrap: 'nowrap' }}>{!['cancelled'].includes(transaction.status) || !transaction.serialNumber ? transaction.totalSalesWithoutMemberDiscount.toFixed(2) : null}</TableCell>
                                        <TableCell sx={{ textWrap: 'nowrap' }}>{!['cancelled'].includes(transaction.status) || !transaction.serialNumber ? transaction.totalMemberDiscount.toFixed(2) : null}</TableCell>
                                        <TableCell sx={{ textWrap: 'nowrap' }}>{transaction.status != 'cancelled' || !transaction.serialNumber ? transaction.totalNetSales.toFixed(2) : null}</TableCell>

                                        <TableCell>{moment(transaction.transactionDate).format('YYYY-MM-DD hh:mmA')}</TableCell>
                                        <TableCell sx={{ pl: 0, py: 0, width: 0 }}>
                                            <TransactionModal transaction={transaction} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {children}
                        {/* <Stack py={1.5} px={2.5} justifyContent='space-between' direction='row'>
                    <Button variant='outlined'>Previous</Button>
                    <Button variant='outlined'>Next</Button>
                    </Stack> */}
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
                </Card>
            </MainCard>
        </PrinterProvider>
    );

    const renderMessage = (children) => (
        <Stack alignItems="center" my={4}>
            {children}
        </Stack>
    );

    if (isLoading) {
        return renderTable(renderMessage(<CircularProgress size={28} />));
    }

    if (!transactions || transactions.length === 0) {
        return renderTable(
            renderMessage(
                <Typography color="lightgray" variant="h5">
                    No data available for this table
                </Typography>
            )
        );
    }

    return renderTable();
}

export default TransactionsPage;
