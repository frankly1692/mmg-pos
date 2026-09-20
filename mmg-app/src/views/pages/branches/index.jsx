import React, { useState, useMemo } from 'react';
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
    Chip,
    Avatar,
    Box,
    IconButton,
    CircularProgress,
    TablePagination,
    MenuItem
} from '@mui/material';
import CreateBranchModal from './components/CreateBranchModal';
import { useQuery } from 'react-query';
import { startCase } from 'lodash';
import branch from 'api/branch';
import UpdateBranchModal from './components/UpdateBranchModal';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

const SORT_OPTIONS = [
    { value: 'name-asc', label: 'Name (A-Z)' },
    { value: 'name-desc', label: 'Name (Z-A)' }
];

// Deterministic pastel avatar color derived from the record's own id, stable across reloads/re-sorts.
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

function BranchesPage() {
    const { data: branches, isLoading, isRefetching } = useQuery('branches', branch.GetAllBranch);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name-asc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const handleSearch = (event) => {
        setSearchQuery(event.target.value);
        setPage(0);
    };

    const handleChangePage = (event, newPage) => setPage(newPage);

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const filteredBranches = useMemo(() => {
        const query = searchQuery.toLowerCase();
        const filtered = (branches || []).filter(
            (b) =>
                b.name.toLowerCase().includes(query) ||
                b.streetAddress?.toLowerCase().includes(query) ||
                b.emailAddress?.toLowerCase().includes(query)
        );

        const [, direction] = sortBy.split('-');
        const sorted = [...filtered].sort((a, b) => {
            const result = a.name.localeCompare(b.name);
            return direction === 'desc' ? -result : result;
        });

        return sorted;
    }, [branches, searchQuery, sortBy]);

    const paginated = filteredBranches.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const renderEmptyState = () => (
        <Stack alignItems="center" py={6}>
            <Typography color="text.secondary" variant="h5">
                No branches to display. Try checking your filters
            </Typography>
        </Stack>
    );

    return (
        <Stack spacing={2.5}>
            <Card>
                <Box sx={{ px: 3, py: 2.5, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Typography variant="h2" fontWeight={600}>
                                Branches
                            </Typography>
                            <Chip
                                size="small"
                                label={`${(branches?.length || 0).toLocaleString()} Branches`}
                                sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 500 }}
                            />
                            {isRefetching && <CircularProgress size={16} />}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" mt={0.5}>
                            Manage diagnostic centers, clinic branches, and satellite facilities.
                        </Typography>
                    </Box>
                    <CreateBranchModal />
                </Box>
            </Card>

            <Card>
                <Box sx={{ px: 3, py: 2.5 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
                        <TextField
                            size="small"
                            placeholder="Search by name, address, or email..."
                            value={searchQuery}
                            onChange={handleSearch}
                            sx={{ flex: 1, minWidth: 300 }}
                            InputProps={{
                                startAdornment: <SearchIcon fontSize="small" color="action" sx={{ mr: 1 }} />,
                                endAdornment: searchQuery ? (
                                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                ) : null
                            }}
                        />
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" color="text.secondary" whiteSpace="nowrap">
                                Sort by:
                            </Typography>
                            <TextField
                                select
                                size="small"
                                variant="standard"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                InputProps={{ disableUnderline: true }}
                                sx={{ minWidth: 140 }}
                            >
                                {SORT_OPTIONS.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                    </Stack>
                </Box>
            </Card>

            <Card sx={{ overflow: 'hidden' }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'grey.50' }}>
                                {['Name', 'Address', 'Email', 'TIN', 'Phone', 'Action'].map((head) => (
                                    <TableCell
                                        key={head}
                                        align={head === 'Action' ? 'right' : 'left'}
                                        sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', letterSpacing: 0.5 }}
                                    >
                                        {head.toUpperCase()}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {!isLoading && paginated.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6}>{renderEmptyState()}</TableCell>
                                </TableRow>
                            )}
                            {!isLoading &&
                                paginated.map((b) => {
                                    const avatarColor = stringToAvatarColor(b._id);
                                    return (
                                        <TableRow key={b._id} hover>
                                            <TableCell sx={{ textWrap: 'nowrap' }}>
                                                <Stack direction="row" spacing={1.5} alignItems="center">
                                                    <Avatar sx={{ bgcolor: avatarColor.bg, color: avatarColor.color, fontWeight: 600, fontSize: '0.8125rem' }}>
                                                        {getInitials(b.name)}
                                                    </Avatar>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {startCase(b.name)}
                                                    </Typography>
                                                </Stack>
                                            </TableCell>
                                            <TableCell>{startCase(b.streetAddress)}</TableCell>
                                            <TableCell sx={{ textTransform: 'none' }}>{b.emailAddress}</TableCell>
                                            <TableCell>{b.tin}</TableCell>
                                            <TableCell>{b.contactNumber}</TableCell>
                                            <TableCell align="right">
                                                <UpdateBranchModal initialValues={b} />
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
                <TablePagination
                    component="div"
                    count={filteredBranches.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    sx={{ borderTop: '1px solid', borderColor: 'divider' }}
                />
            </Card>
        </Stack>
    );
}

export default BranchesPage;
