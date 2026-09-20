import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Box,
    Card,
    Stack,
    Chip,
    Avatar,
    IconButton,
    TextField,
    MenuItem,
    CircularProgress,
    TablePagination
} from '@mui/material';
import customer from 'api/customer';
import { useQuery } from 'react-query';
import { startCase } from 'lodash';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import moment from 'moment';

const SORT_OPTIONS = [
    { value: 'name-asc', label: 'Name (A-Z)' },
    { value: 'name-desc', label: 'Name (Z-A)' },
    { value: 'age-asc', label: 'Age (Low-High)' },
    { value: 'age-desc', label: 'Age (High-Low)' }
];

// Color chip per customer classification — falls back to a neutral gray for anything unmapped.
const CUSTOMER_TYPE_STYLES = {
    member: { bg: '#EDE9FE', color: '#6D28D9' },
    'non-member': { bg: '#F1F5F9', color: '#475569' },
    seniorcitizenpwd: { bg: '#DCFCE7', color: '#15803D' },
    'officer-bod': { bg: '#DBEAFE', color: '#1D4ED8' },
    'officer-gm': { bg: '#DBEAFE', color: '#1D4ED8' },
    'officer-treasurer': { bg: '#DBEAFE', color: '#1D4ED8' },
    'officer-committer-officers': { bg: '#DBEAFE', color: '#1D4ED8' },
    'associate-member': { bg: '#CFFAFE', color: '#0E7490' },
    'solo-parent': { bg: '#FCE7F3', color: '#BE185D' }
};

const getCustomerTypeStyle = (type) => CUSTOMER_TYPE_STYLES[type] || { bg: '#F1F5F9', color: '#475569' };

// Deterministic pastel avatar color derived from the customer's own id, so it stays stable
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

// Cosmetic display id — this app has no sequential customer-facing id, so this derives a
// stable-looking one from the record's own Mongo _id rather than inventing a backend field.
const getDisplayId = (id) => `#CUST-${(id || '').slice(-6).toUpperCase()}`;

const CustomerList = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [sortBy, setSortBy] = useState('name-asc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const { data: customers, isLoading } = useQuery('customers', () => customer.GetAllCustomers());

    const handleSearch = (event) => {
        setSearchQuery(event.target.value);
        setPage(0);
    };

    const handleCategoryChange = (event) => {
        setSelectedCategory(event.target.value);
        setPage(0);
    };

    const handleNewCustomer = () => {
        navigate('/dashboard/customers/new');
    };

    const handleEditCustomer = (id) => {
        const found = filteredCustomers.find((p) => p._id === id);
        const newData = {
            ...found,
            birthDate: moment(found?.birthDate).format('L')
        };

        if (found) {
            const encodedCustomer = encodeURIComponent(JSON.stringify(newData));
            navigate(`/dashboard/customers/edit?customer=${encodedCustomer}`);
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const filteredCustomers = useMemo(() => {
        const filtered = (customers || []).filter((c) => {
            const fullName = `${c.firstName} ${c.middleName ? c.middleName + ' ' : ''}${c.lastName}`.toLowerCase();
            const query = searchQuery.toLowerCase();

            return (
                (fullName.includes(query) ||
                    c.customerType?.toLowerCase().includes(query) ||
                    getDisplayId(c._id).toLowerCase().includes(query)) &&
                (selectedCategory === 'all' || c.customerType === selectedCategory)
            );
        });

        const [sortField, sortDirection] = sortBy.split('-');
        const sorted = [...filtered].sort((a, b) => {
            let result = 0;
            if (sortField === 'name') {
                const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
                const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
                result = nameA.localeCompare(nameB);
            } else if (sortField === 'age') {
                result = (Number(a.age) || 0) - (Number(b.age) || 0);
            }
            return sortDirection === 'desc' ? -result : result;
        });

        return sorted;
    }, [customers, searchQuery, selectedCategory, sortBy]);

    const renderTableView = (children) => (
        <Stack spacing={2.5}>
            {/* Header */}
            <Card>
                <Box sx={{ px: 3, py: 2.5, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Typography variant="h2" fontWeight={600}>
                                Customers
                            </Typography>
                            <Chip
                                size="small"
                                label={`${(customers?.length || 0).toLocaleString()} Records`}
                                sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 500 }}
                            />
                        </Stack>
                        <Typography variant="body2" color="text.secondary" mt={0.5}>
                            Manage member records, customer classifications, and profile details
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1.5}>
                        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleNewCustomer}>
                            New Customer
                        </Button>
                    </Stack>
                </Box>
            </Card>

            {/* Filters */}
            <Card>
                <Box sx={{ px: 3, py: 2.5 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flex={1}>
                            <TextField
                                select
                                size="small"
                                label="Member Type"
                                value={selectedCategory}
                                onChange={handleCategoryChange}
                                sx={{ minWidth: 180 }}
                            >
                                <MenuItem value="all">All</MenuItem>
                                {customers &&
                                    Object.keys(Object.groupBy(customers, ({ customerType }) => customerType))
                                        .filter((key) => key && key !== 'undefined')
                                        .map((type) => (
                                            <MenuItem key={type} value={type}>
                                                {startCase(type)}
                                            </MenuItem>
                                        ))}
                            </TextField>
                            <TextField
                                size="small"
                                placeholder="Search by name, customer type, or ID..."
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
                                {['Name', 'Customer Type', 'Gender', 'Age', 'Action'].map((head, i) => (
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
                            {filteredCustomers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((c) => {
                                const avatarColor = stringToAvatarColor(c._id);
                                const typeStyle = getCustomerTypeStyle(c.customerType);
                                return (
                                    <TableRow key={c._id} hover>
                                        <TableCell>
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <Avatar sx={{ bgcolor: avatarColor.bg, color: avatarColor.color, fontWeight: 600, fontSize: '0.8125rem' }}>
                                                    {getInitials(c.firstName, c.lastName)}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {startCase(`${c.firstName} ${c.middleName ? c.middleName + ' ' : ''}${c.lastName}`)}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {getDisplayId(c._id)}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={startCase(c.customerType)}
                                                size="small"
                                                sx={{ bgcolor: typeStyle.bg, color: typeStyle.color, fontWeight: 500 }}
                                            />
                                        </TableCell>
                                        <TableCell>{startCase(c.gender)}</TableCell>
                                        <TableCell>{c.age}</TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                <Button
                                                    onClick={() => handleEditCustomer(c._id)}
                                                    startIcon={<EditIcon fontSize="small" />}
                                                    variant="outlined"
                                                    size="small"
                                                >
                                                    Edit
                                                </Button>
                                                <IconButton size="small">
                                                    <MoreVertIcon fontSize="small" />
                                                </IconButton>
                                            </Stack>
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
                    count={filteredCustomers.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    sx={{ borderTop: '1px solid', borderColor: 'divider' }}
                />
            </Card>
        </Stack>
    );

    const renderMessage = (message) => (
        <Stack alignItems="center" py={6}>
            {message}
        </Stack>
    );

    if (isLoading) {
        return renderTableView(renderMessage(<CircularProgress size={28} />));
    }

    if (!filteredCustomers || filteredCustomers.length === 0) {
        return renderTableView(
            renderMessage(
                <Typography color="text.secondary" variant="h5">
                    No available data to display. Try checking your filters
                </Typography>
            )
        );
    }

    return renderTableView();
};

export default CustomerList;
