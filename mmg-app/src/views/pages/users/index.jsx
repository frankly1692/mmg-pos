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
import CreateUserModal from './components/CreateUserModal';
import { useQuery } from 'react-query';
import user from 'api/user';
import { startCase } from 'lodash';
import UserSwitch from './components/UserSwitch';
import UpdateUserModal from './components/UpdateUserModal';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

const SORT_OPTIONS = [
    { value: 'name-asc', label: 'Name (A-Z)' },
    { value: 'name-desc', label: 'Name (Z-A)' }
];

// Deterministic pastel avatar color derived from the user's own id, so it stays stable
// across reloads/re-sorts instead of shifting with row position.
const stringToAvatarColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str?.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return { bg: `hsl(${hue}, 70%, 92%)`, color: `hsl(${hue}, 55%, 38%)` };
};

const getInitials = (firstName, lastName) => `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();

function UsersPage() {
    const { data: users, isLoading, isRefetching } = useQuery('users', user.GetAllUser);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name-asc');

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleSearch = (event) => {
        setSearchQuery(event.target.value);
        setPage(0);
    };

    const filteredusers = useMemo(() => {
        const lowercaseSearchQuery = searchQuery.toLowerCase();
        const filtered =
            users?.filter(
                (user) =>
                    user.firstName.toLowerCase().includes(lowercaseSearchQuery) || user.lastName.toLowerCase().includes(lowercaseSearchQuery)
            ) || [];

        const [, sortDirection] = sortBy.split('-');
        const sorted = [...filtered].sort((a, b) => {
            const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
            const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
            const result = nameA.localeCompare(nameB);
            return sortDirection === 'desc' ? -result : result;
        });

        return sorted;
    }, [users, searchQuery, sortBy]);

    const renderTable = (children) => (
        <Stack spacing={2.5}>
            {/* Header */}
            <Card>
                <Box sx={{ px: 3, py: 2.5, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Typography variant="h2" fontWeight={600}>
                                User Accounts
                            </Typography>
                            <Chip
                                size="small"
                                label={`${(users?.length || 0).toLocaleString()} Users`}
                                sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 500 }}
                            />
                            {isRefetching && <CircularProgress size={16} />}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" mt={0.5}>
                            Manage staff logins, branch assignments, and role permissions.
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1.5}>
                        <CreateUserModal />
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
                                {['Name', 'Branch', 'Role', 'Active', 'Action'].map((head) => (
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
                            {filteredusers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((u) => {
                                const avatarColor = stringToAvatarColor(u._id);
                                return (
                                    <TableRow key={u._id} hover>
                                        <TableCell>
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <Avatar
                                                    sx={{ bgcolor: avatarColor.bg, color: avatarColor.color, fontWeight: 600, fontSize: '0.8125rem' }}
                                                >
                                                    {getInitials(u.firstName, u.lastName)}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {startCase(`${u.firstName} ${u.lastName}`)}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {u.username}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </TableCell>
                                        <TableCell sx={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                            {u?.branches?.map((branch) => startCase(branch.name)).join(', ')}
                                        </TableCell>
                                        <TableCell>{startCase(u?.role?.name)}</TableCell>
                                        <TableCell>
                                            <UserSwitch value={u.isActive} id={u._id} />
                                        </TableCell>
                                        <TableCell align="right">
                                            <UpdateUserModal
                                                initialValues={{
                                                    ...u,
                                                    id: u._id
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
                    count={filteredusers.length}
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

    if (!users || users.length === 0) {
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

export default UsersPage;
