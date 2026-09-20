import { Stack, Typography, Button, TextField, MenuItem } from '@mui/material';

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

// Numbered pagination ("Previous 1 2 3 Next") used by the shift/branch report tables, as opposed
// to MUI's default TablePagination (prev/next arrows only) used elsewhere in the app.
export default function ReportPagination({ page, rowsPerPage, count, onPageChange, onRowsPerPageChange, itemLabel = 'items' }) {
    const totalPages = Math.max(1, Math.ceil(count / rowsPerPage));
    const from = count === 0 ? 0 : page * rowsPerPage + 1;
    const to = Math.min(count, (page + 1) * rowsPerPage);

    // Up to 3 page buttons centered on the current page, plus the last page with an ellipsis
    // when there's a gap (e.g. "1 2 3 ... 13") — matches the report tables' pagination design.
    const windowSize = Math.min(3, totalPages);
    let start = Math.max(0, page - Math.floor(windowSize / 2));
    let end = start + windowSize;
    if (end > totalPages) {
        end = totalPages;
        start = Math.max(0, end - windowSize);
    }
    const pageNumbers = Array.from({ length: end - start }, (_, i) => start + i);
    const showEllipsis = end < totalPages - 1;
    const showLastPage = end < totalPages;

    return (
        <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={1.5}
            sx={{ px: 3, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
        >
            <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary" whiteSpace="nowrap">
                    Rows per page:
                </Typography>
                <TextField
                    select
                    size="small"
                    variant="standard"
                    value={rowsPerPage}
                    onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
                    InputProps={{ disableUnderline: true }}
                    sx={{ width: 56 }}
                >
                    {ROWS_PER_PAGE_OPTIONS.map((n) => (
                        <MenuItem key={n} value={n}>
                            {n}
                        </MenuItem>
                    ))}
                </TextField>
                <Typography variant="body2" color="text.secondary" whiteSpace="nowrap">
                    Showing {from}-{to} of {count} {itemLabel}
                </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
                <Button size="small" color="inherit" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
                    Previous
                </Button>
                {pageNumbers.map((n) => (
                    <Button
                        key={n}
                        size="small"
                        variant={n === page ? 'contained' : 'text'}
                        color={n === page ? 'primary' : 'inherit'}
                        onClick={() => onPageChange(n)}
                        sx={{ minWidth: 32, px: 0 }}
                    >
                        {n + 1}
                    </Button>
                ))}
                {showEllipsis && (
                    <Typography variant="body2" color="text.secondary" px={0.5}>
                        …
                    </Typography>
                )}
                {showLastPage && (
                    <Button size="small" color="inherit" onClick={() => onPageChange(totalPages - 1)} sx={{ minWidth: 32, px: 0 }}>
                        {totalPages}
                    </Button>
                )}
                <Button size="small" color="inherit" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
                    Next
                </Button>
            </Stack>
        </Stack>
    );
}
