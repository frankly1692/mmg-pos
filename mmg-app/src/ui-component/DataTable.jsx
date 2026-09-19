import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Card, Collapse, Stack, CircularProgress, Typography, TablePagination } from '@mui/material';

/**
 * columns: [{
 *   key: string,               // unique key for the column
 *   header: node,               // header cell content
 *   render: (row) => node,      // cell content for a row
 *   width, align, nowrap,       // passed through to TableCell
 *   stopPropagation: bool       // stop the cell's click from reaching onRowClick (e.g. action buttons)
 * }]
 */
export default function DataTable({
    columns,
    rows,
    rowKey = '_id',
    isLoading = false,
    isRefetching = false,
    emptyMessage = 'No data available for this table',
    onRowClick,
    renderExpanded,
    isRowExpanded,
    page,
    rowsPerPage,
    onPageChange,
    onRowsPerPageChange,
    count,
    dense = false
}) {
    const getRowKey = (row) => (typeof rowKey === 'function' ? rowKey(row) : row[rowKey]);

    const visibleRows = page != null && rowsPerPage != null ? rows?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) : rows;

    const cellSx = (col) => ({ ...(dense && { py: 0.5 }), ...(col.nowrap && { textWrap: 'nowrap' }) });

    return (
        <Card sx={{ borderRadius: 2 }}>
            <TableContainer component={Paper}>
                <Table size={dense ? 'small' : 'medium'} sx={{ minWidth: 650, borderBottom: 1, borderColor: 'grey.100' }}>
                    <TableHead>
                        <TableRow>
                            {columns.map((col) => (
                                <TableCell key={col.key} width={col.width} align={col.align} sx={cellSx(col)}>
                                    {typeof col.header === 'function' ? col.header({ isRefetching }) : col.header}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Stack alignItems="center" my={4}>
                                        <CircularProgress size={28} />
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoading && (!rows || rows.length === 0) && (
                            <TableRow>
                                <TableCell colSpan={columns.length}>
                                    <Stack alignItems="center" my={4}>
                                        <Typography color="lightgray" variant="h5">
                                            {emptyMessage}
                                        </Typography>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoading &&
                            visibleRows?.map((row) => {
                                const key = getRowKey(row);

                                return (
                                    <React.Fragment key={key}>
                                        <TableRow
                                            sx={{ '&:last-child td, &:last-child th': { border: 0 }, cursor: onRowClick ? 'pointer' : undefined }}
                                            onClick={onRowClick ? () => onRowClick(row) : undefined}
                                        >
                                            {columns.map((col) => (
                                                <TableCell
                                                    key={col.key}
                                                    width={col.width}
                                                    align={col.align}
                                                    sx={cellSx(col)}
                                                    onClick={col.stopPropagation ? (e) => e.stopPropagation() : undefined}
                                                >
                                                    {col.render ? col.render(row) : row[col.key]}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                        {renderExpanded && (
                                            <TableRow>
                                                <TableCell colSpan={columns.length} sx={{ paddingBottom: 0, paddingTop: 0 }}>
                                                    <Collapse in={Boolean(isRowExpanded?.(row))}>{renderExpanded(row)}</Collapse>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                    </TableBody>
                </Table>
            </TableContainer>
            {page != null && rowsPerPage != null && (
                <div style={{ flex: '0 1 auto' }}>
                    <TablePagination
                        component="div"
                        count={count ?? rows?.length ?? 0}
                        page={page}
                        onPageChange={onPageChange}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={onRowsPerPageChange}
                    />
                </div>
            )}
        </Card>
    );
}
