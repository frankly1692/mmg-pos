import { Stack, Typography, TableContainer, TableHead, TableRow, TableBody, TableCell, Table, Card, CircularProgress } from '@mui/material';
import { useQuery } from 'react-query';
import _, { upperCase } from 'lodash';
import moment from 'moment';
import { useState } from 'react';
import discount_report from 'api/discount_report';
import ReportPagination from 'ui-component/ReportPagination';

const TABLE_HEADS = [
    'Invoice Range #',
    'Customer',
    'Member ID',
    'Member Type',
    'Gross Sales',
    'Member Discount',
    'Total Discount',
    'Net Sales',
    'Date'
];

const getMemberDiscount = (discounts) => {
    const memberDiscounts = discounts?.filter((v) => !!v.memberType);
    return memberDiscounts && memberDiscounts?.length > 0 ? memberDiscounts[0] : null;
};

function DiscountReports({ generated, ...initialParams }) {
    const params = _.pickBy(
        {
            ...initialParams,
            status: 'completed'
        },
        (value) => value != null
    );

    const { data: discounts, isLoading } = useQuery({
        queryKey: ['discount', generated],
        queryFn: () => discount_report.GetAllDiscountReport(params),
        enabled: generated > 0,
        refetchOnWindowFocus: false
    });

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const filteredDiscounts = discounts?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <Card sx={{ overflow: 'hidden' }}>
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                            {TABLE_HEADS.map((head) => (
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
                        {!isLoading && (!filteredDiscounts || filteredDiscounts.length === 0) && (
                            <TableRow>
                                <TableCell colSpan={TABLE_HEADS.length}>
                                    <Stack alignItems="center" py={6}>
                                        <Typography color="text.secondary" variant="h5">
                                            No data available for this table
                                        </Typography>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoading &&
                            filteredDiscounts?.map((transaction) => {
                                const memberDiscount = getMemberDiscount(transaction.discounts);

                                return (
                                    <TableRow key={transaction._id} hover sx={{ textTransform: 'capitalize' }}>
                                        <TableCell component="th" scope="row">
                                            {String(transaction.transaction.invoiceNumber).padStart(6, '0')}
                                        </TableCell>
                                        <TableCell>{transaction.customer.name}</TableCell>
                                        <TableCell>{transaction.customer?.customer_type_id}</TableCell>
                                        <TableCell>{upperCase(transaction.memberType)}</TableCell>
                                        <TableCell>{transaction.transaction.totalGrossSales.toFixed(2)}</TableCell>
                                        <TableCell>
                                            {transaction.value}
                                            {transaction.type == 'percentage' ? '%' : ''}
                                        </TableCell>
                                        <TableCell>{transaction.transaction.totalDiscount.toFixed(2)}</TableCell>
                                        <TableCell>{transaction.transaction.totalNetSales.toFixed(2)}</TableCell>
                                        <TableCell sx={{ textWrap: 'nowrap' }}>
                                            {moment(transaction.transaction.transactionDate).format('YYYY-MM-DD hh:mmA')}
                                        </TableCell>
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
                count={discounts?.length || 0}
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
}

export default DiscountReports;
