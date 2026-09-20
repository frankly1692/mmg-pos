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
    Box,
    Card,
    Chip,
    Avatar,
    IconButton,
    MenuItem,
    CircularProgress,
    TablePagination
} from '@mui/material';
import CreateCorporateModal from './components/CreateCorporateModal';
import { useQuery } from 'react-query';
import { omit, startCase } from 'lodash';
import UpdateCorporateModal from './components/UpdateCorporateModal';
import corporate from 'api/corporate';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

const SORT_OPTIONS = [
    { value: 'name-asc', label: 'Name (A-Z)' },
    { value: 'name-desc', label: 'Name (Z-A)' }
];

// Deterministic pastel avatar color derived from the corporate's own id, so it stays stable
// across reloads/re-sorts instead of shifting with row position.
const stringToAvatarColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str?.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return { bg: `hsl(${hue}, 70%, 92%)`, color: `hsl(${hue}, 55%, 38%)` };
};

const getInitials = (name) => {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

function CorporatesPage() {
    const { data: corporates, isLoading, isRefetching } = useQuery('corporates', () =>
        corporate.GetAllCorporate().then((data) => data.sort((a, b) => a.name.localeCompare(b.name)))
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name-asc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const handleSearch = (event) => {
        setSearchQuery(event.target.value);
        setPage(0);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const filteredCorporates = useMemo(() => {
        const lowercaseSearchQuery = searchQuery.toLowerCase();
        const filtered = corporates?.filter((corporate) => corporate.name.toLowerCase().includes(lowercaseSearchQuery)) || [];

        const [, sortDirection] = sortBy.split('-');
        const sorted = [...filtered].sort((a, b) => {
            const result = a.name.localeCompare(b.name);
            return sortDirection === 'desc' ? -result : result;
        });

        return sorted;
    }, [corporates, searchQuery, sortBy]);

    const renderTable = (children) => (
        <Stack spacing={2.5}>
            {/* Header */}
            <Card>
                <Box sx={{ px: 3, py: 2.5, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Typography variant="h2" fontWeight={600}>
                                Corporates / HMO
                            </Typography>
                            <Chip
                                size="small"
                                label={`${(corporates?.length || 0).toLocaleString()} Partners`}
                                sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 500 }}
                            />
                            {isRefetching && <CircularProgress size={16} />}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" mt={0.5}>
                            Manage corporate accounts, HMO partners, and billing affiliations.
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1.5}>
                        <CreateCorporateModal />
                    </Stack>
                </Box>
            </Card>

            {/* Filters */}
            <Card>
                <Box sx={{ px: 3, py: 2.5 }}>
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        alignItems={{ xs: 'stretch', md: 'center' }}
                        justifyContent="space-between"
                    >
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flex={1}>
                            <TextField
                                size="small"
                                placeholder="Search by name..."
                                value={searchQuery}
                                onChange={handleSearch}
                                sx={{ flex: 1, minWidth: 260 }}
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

            {/* Table */}
            <Card sx={{ overflow: 'hidden' }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'grey.50' }}>
                                {['Name', 'Address', 'Email', 'Phone', 'Action'].map((head) => (
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
                            {filteredCorporates.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((c) => {
                                const avatarColor = stringToAvatarColor(c._id);
                                return (
                                    <TableRow key={c._id} hover>
                                        <TableCell>
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <Avatar
                                                    sx={{ bgcolor: avatarColor.bg, color: avatarColor.color, fontWeight: 600, fontSize: '0.8125rem' }}
                                                >
                                                    {getInitials(c.name)}
                                                </Avatar>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {startCase(c.name)}
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>{startCase(c.streetAddress)}</TableCell>
                                        <TableCell sx={{ textTransform: 'lowercase' }}>{c.emailAddress}</TableCell>
                                        <TableCell>{c.contactNumber}</TableCell>
                                        <TableCell align="right">
                                            <UpdateCorporateModal
                                                initialValues={{
                                                    ...omit(c, '_id'),
                                                    contactNo: c?.contactNumber,
                                                    id: c._id
                                                }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    {children}
                </TableContainer>
                <TablePagination
                    component="div"
                    count={filteredCorporates.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    sx={{ borderTop: '1px solid', borderColor: 'divider' }}
                />
            </Card>
        </Stack>
    );

    const renderMessage = (children) => (
        <Stack alignItems="center" py={6}>
            {children}
        </Stack>
    );

    if (isLoading) {
        return renderTable(renderMessage(<CircularProgress size={28} />));
    }

    if (!corporates || corporates.length === 0) {
        return renderTable(
            renderMessage(
                <Typography color="text.secondary" variant="h5">
                    No available data to display. Try checking your filters
                </Typography>
            )
        );
    }

    return renderTable();
}

export default CorporatesPage;
