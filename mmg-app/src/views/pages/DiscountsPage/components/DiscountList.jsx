import React, { useState, useMemo } from 'react';
import {
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Stack,
    IconButton,
    Chip,
    Avatar,
    Box,
    Card,
    CircularProgress,
    TablePagination,
    MenuItem
} from '@mui/material';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { startCase } from 'lodash';
// api
import discount from 'api/discount';

import DiscountFormModal from './DiscountFormModal';

const SORT_OPTIONS = [
    { value: 'name-asc', label: 'Name (A-Z)' },
    { value: 'name-desc', label: 'Name (Z-A)' },
    { value: 'value-asc', label: 'Value (Low-High)' },
    { value: 'value-desc', label: 'Value (High-Low)' }
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

const formatDiscountValue = (d) => (d.type === 'percentage' ? `${d.value}%` : `₱${new Intl.NumberFormat().format(d.value)}`);

const DiscountList = () => {
    const [openModal, setOpenModal] = useState(false);
    const [editingDiscount, setEditingDiscount] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState('all');
    const [sortBy, setSortBy] = useState('name-asc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const queryClient = useQueryClient();

    const { data: discounts, isLoading } = useQuery('discounts', discount.GetAllDiscounts);

    const createDiscountMutation = useMutation(discount.CreateDiscount, {
        onMutate: async (newDiscount) => {
            await queryClient.cancelQueries('discounts');
            const previousDiscounts = queryClient.getQueryData('discounts');
            const existingDiscount = previousDiscounts?.find((d) => d.name.toLowerCase() === newDiscount.name.toLowerCase());

            if (existingDiscount) {
                throw new Error('A discount with this name already exists.');
            } else {
                if (!previousDiscounts || previousDiscounts.length === 0) {
                    queryClient.setQueryData('discounts', [newDiscount]);
                } else {
                    queryClient.setQueryData('discounts', (old) => [...old, newDiscount]);
                }
                return { previousDiscounts };
            }
        },
        onError: (err) => {
            if (err.message === 'A discount with this name already exists.') {
                toast.error('A discount with this name already exists.');
            } else {
                toast.error('An error occurred while creating the discount.');
            }
        },
        onSuccess: () => {
            toast.success('Discount created successfully.', { autoClose: 1500 });
        },
        onSettled: () => {
            queryClient.invalidateQueries('discounts');
        }
    });

    const editDiscountMutation = useMutation(discount.EditDiscount, {
        onMutate: async (updateDiscount) => {
            await queryClient.cancelQueries('discounts');
            const previousDiscounts = queryClient.getQueryData('discounts');
            queryClient.setQueryData('discounts', (old) => old.map((d) => (d._id === updateDiscount._id ? updateDiscount : d)));
            return { previousDiscounts };
        },
        onError: (err) => {
            if (err.message === 'A discount with this name already exists.') {
                toast.error('A discount with this name already exists.');
            } else {
                toast.error('An error occurred while updating the discount.');
            }
        },
        onSuccess: () => {
            toast.success('Discount updated successfully.', { autoClose: 1500 });
        },
        onSettled: () => {
            queryClient.invalidateQueries('discounts');
        }
    });

    const handleSearch = (event) => {
        setSearchQuery(event.target.value);
        setPage(0);
    };

    const handleTypeChange = (event) => {
        setSelectedType(event.target.value);
        setPage(0);
    };

    const handleNewDiscount = () => {
        setEditingDiscount(null);
        setOpenModal(true);
    };

    const handleEditDiscount = (id) => {
        const found = discounts.find((c) => c._id === id);
        if (found) {
            setEditingDiscount({
                id: found._id,
                name: found.name,
                description: found.description,
                value: found.value,
                type: found.type
            });
            setOpenModal(true);
        }
    };

    const handleCloseModal = () => setOpenModal(false);

    const handleSubmitForm = async (data) => {
        try {
            if (editingDiscount) {
                await editDiscountMutation.mutateAsync(data);
            } else {
                await createDiscountMutation.mutateAsync(data);
            }
            setOpenModal(false);
        } catch (error) {
            console.error('Error submitting form:', error);
        }
    };

    const handleChangePage = (event, newPage) => setPage(newPage);

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const filteredDiscounts = useMemo(() => {
        const query = searchQuery.toLowerCase();
        const filtered = (discounts || []).filter(
            (d) => d.name.toLowerCase().includes(query) && (selectedType === 'all' || d.type === selectedType)
        );

        const [field, direction] = sortBy.split('-');
        const sorted = [...filtered].sort((a, b) => {
            let result = 0;
            if (field === 'name') {
                result = a.name.localeCompare(b.name);
            } else if (field === 'value') {
                result = (a.value || 0) - (b.value || 0);
            }
            return direction === 'desc' ? -result : result;
        });

        return sorted;
    }, [discounts, searchQuery, selectedType, sortBy]);

    const uniqueTypes = useMemo(() => Array.from(new Set((discounts || []).map((d) => d.type).filter(Boolean))), [discounts]);

    const paginated = filteredDiscounts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const renderHeader = () => (
        <Card>
            <Box sx={{ px: 3, py: 2.5, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography variant="h2" fontWeight={600}>
                            Discounts
                        </Typography>
                        <Chip
                            size="small"
                            label={`${(discounts?.length || 0).toLocaleString()} Discounts`}
                            sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 500 }}
                        />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                        Manage promotional rates and eligibility-based discounts for lab tests and services.
                    </Typography>
                </Box>
                <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleNewDiscount}>
                    New Discount
                </Button>
            </Box>
        </Card>
    );

    const renderFilters = () => (
        <Card>
            <Box sx={{ px: 3, py: 2.5 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flex={1}>
                        <TextField
                            size="small"
                            placeholder="Search by discount name..."
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
                        <TextField select size="small" value={selectedType} onChange={handleTypeChange} sx={{ minWidth: 160 }}>
                            <MenuItem value="all">All Types</MenuItem>
                            {uniqueTypes.map((type) => (
                                <MenuItem key={type} value={type}>
                                    {startCase(type)}
                                </MenuItem>
                            ))}
                        </TextField>
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
                            sx={{ minWidth: 150 }}
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
    );

    const renderEmptyState = () => (
        <Stack alignItems="center" py={6}>
            <Typography color="text.secondary" variant="h5">
                No discounts to display. Try checking your filters
            </Typography>
        </Stack>
    );

    if (isLoading) {
        return (
            <Stack spacing={2.5}>
                <ToastContainer />
                {renderHeader()}
                {renderFilters()}
                <Stack alignItems="center" py={6}>
                    <CircularProgress size={28} />
                </Stack>
            </Stack>
        );
    }

    return (
        <Stack spacing={2.5}>
            <ToastContainer />
            {renderHeader()}
            {renderFilters()}
            <Card sx={{ overflow: 'hidden' }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'grey.50' }}>
                                {['Name', 'Description', 'Discount Value', 'Type', 'Action'].map((head) => (
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
                            {paginated.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5}>{renderEmptyState()}</TableCell>
                                </TableRow>
                            )}
                            {paginated.map((d) => {
                                const avatarColor = stringToAvatarColor(d._id);
                                return (
                                    <TableRow key={d._id} hover>
                                        <TableCell>
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <Avatar sx={{ bgcolor: avatarColor.bg, color: avatarColor.color, fontWeight: 600, fontSize: '0.8125rem' }}>
                                                    {getInitials(d.name)}
                                                </Avatar>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {d.name}
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 320 }}>
                                            <Typography variant="body2" color="text.secondary" dangerouslySetInnerHTML={{ __html: d.description || '' }} />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={600}>
                                                {formatDiscountValue(d)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip label={startCase(d.type)} size="small" variant="outlined" />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                color="primary"
                                                onClick={() => handleEditDiscount(d._id)}
                                                startIcon={<EditIcon fontSize="small" />}
                                            >
                                                Edit
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    component="div"
                    count={filteredDiscounts.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    sx={{ borderTop: '1px solid', borderColor: 'divider' }}
                />
            </Card>

            <DiscountFormModal open={openModal} onClose={handleCloseModal} onSubmit={handleSubmitForm} discount={editingDiscount} />
        </Stack>
    );
};

export default DiscountList;
