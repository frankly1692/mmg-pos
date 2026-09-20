import React, { useState, useMemo } from 'react';
import {
    Typography,
    Grid,
    Card,
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
    Box,
    MenuItem,
    CircularProgress,
    TablePagination,
    Divider,
    ToggleButton,
    ToggleButtonGroup
} from '@mui/material';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import CategoryFormModal from './CategoryFormModal';
import category from 'api/category';
import service from 'api/service';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import MedicationOutlinedIcon from '@mui/icons-material/MedicationOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import LocalPharmacyOutlinedIcon from '@mui/icons-material/LocalPharmacyOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import GraphicEqOutlinedIcon from '@mui/icons-material/GraphicEqOutlined';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import BubbleChartOutlinedIcon from '@mui/icons-material/BubbleChartOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import Switch from 'ui-component/switch';
import { CSVLink } from 'react-csv';
import moment from 'moment';

const SORT_OPTIONS = [
    { value: 'name-asc', label: 'Name (A-Z)' },
    { value: 'name-desc', label: 'Name (Z-A)' },
    { value: 'tests-desc', label: 'Lab Tests (Most)' },
    { value: 'tests-asc', label: 'Lab Tests (Fewest)' }
];

// Icon per category, matched by name (case-insensitive) — falls back to a generic category icon
// for anything not in this fixed set (see pos-api/app/seeders/product_categories.py).
const CATEGORY_ICONS = {
    consultation: PersonOutlineIcon,
    diagnostic: ScienceOutlinedIcon,
    medication: MedicationOutlinedIcon,
    supplies: Inventory2OutlinedIcon,
    laboratory: BiotechOutlinedIcon,
    'ecg & spirometry': MonitorHeartOutlinedIcon,
    others: MoreHorizIcon,
    'drug testing': LocalPharmacyOutlinedIcon,
    'professional fee': PaidOutlinedIcon,
    ultrasound: GraphicEqOutlinedIcon,
    'x-ray': CameraAltOutlinedIcon,
    'special chemistry': BubbleChartOutlinedIcon
};

const getCategoryIcon = (name) => CATEGORY_ICONS[name?.toLowerCase()] || CategoryOutlinedIcon;

// Deterministic color per category (by id) — matches the colors used for the same categories'
// chips on the Lab Test list, so a category reads consistently across both pages.
const stringToChipColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str?.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return { bg: `hsl(${hue}, 70%, 92%)`, color: `hsl(${hue}, 55%, 38%)` };
};

const ServiceCategoryList = () => {
    const [viewMode, setViewMode] = useState('card');
    const [searchQuery, setSearchQuery] = useState('');
    const [openModal, setOpenModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [sortBy, setSortBy] = useState('name-asc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const queryClient = useQueryClient();

    const { data: categories, isLoading } = useQuery('categories', category.GetAllCategories);
    const { data: services } = useQuery('services', service.GetAllServices);

    const labTestCountByCategory = useMemo(() => {
        const counts = {};
        services?.forEach((item) => {
            const categoryId = item?.category?.id;
            if (categoryId) counts[categoryId] = (counts[categoryId] || 0) + 1;
        });
        return counts;
    }, [services]);

    const createCategoryMutation = useMutation(category.CreateCategory, {
        onMutate: async (newCategory) => {
            await queryClient.cancelQueries('categories');
            const previousCategories = queryClient.getQueryData('categories');
            const existingCategories = previousCategories?.find((c) => c.name.toLowerCase() === newCategory.name.toLowerCase());

            if (existingCategories) {
                throw new Error('A category with this name already exists.');
            } else {
                if (!previousCategories || previousCategories.length === 0) {
                    queryClient.setQueryData('categories', [newCategory]);
                } else {
                    queryClient.setQueryData('categories', (old) => [...old, newCategory]);
                }
                return { previousCategories };
            }
        },
        onError: (err) => {
            if (err.message === 'A category with this name already exists.') {
                toast.error('A category with this name already exists.');
            } else {
                toast.error('An error occurred while creating the category.');
            }
        },
        onSuccess: () => {
            toast.success('Category created successfully.', { autoClose: 1500 });
        },
        onSettled: () => {
            queryClient.invalidateQueries('categories');
        }
    });

    const editCategoryMutation = useMutation(category.EditCategory, {
        onMutate: async (updatedCategory) => {
            await queryClient.cancelQueries('categories');
            const previousCategories = queryClient.getQueryData('categories');
            queryClient.setQueryData('categories', (old) =>
                old.map((c) => (c._id === updatedCategory._id ? { ...c, ...updatedCategory } : c))
            );
            return { previousCategories };
        },
        onError: () => {
            toast.error('An error occurred while updating the category.');
        },
        onSuccess: () => {
            toast.success('Category updated successfully.', { autoClose: 1500 });
        },
        onSettled: () => {
            queryClient.invalidateQueries('categories');
        }
    });

    const handleSearch = (event) => {
        setSearchQuery(event.target.value);
        setPage(0);
    };

    const handleStatusChange = (event) => {
        setSelectedStatus(event.target.value);
        setPage(0);
    };

    const handleNewCategory = () => {
        setEditingCategory(null);
        setOpenModal(true);
    };

    const handleEditCategory = (id) => {
        const found = categories.find((c) => c._id === id);
        if (found) {
            setEditingCategory({ id: found._id, name: found.name, description: found.description, isActive: found.isActive });
            setOpenModal(true);
        }
    };

    // The list/table view's Active switch flips status inline without opening the full modal —
    // reuses the same edit mutation and payload shape as the modal's full edit.
    const handleToggleActive = (cat, nextValue) => {
        editCategoryMutation.mutate({ id: cat._id, name: cat.name, description: cat.description, isActive: nextValue });
    };

    const handleCloseModal = () => setOpenModal(false);

    const handleSubmitForm = async (data) => {
        try {
            if (editingCategory) {
                await editCategoryMutation.mutateAsync(data);
            } else {
                await createCategoryMutation.mutateAsync(data);
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

    const filteredCategories = useMemo(() => {
        const query = searchQuery.toLowerCase();
        const filtered = (categories || []).filter(
            (cat) =>
                (cat.name.toLowerCase().includes(query) || cat.description?.toLowerCase().includes(query)) &&
                (selectedStatus === 'all' || cat.isActive === (selectedStatus === 'active'))
        );

        const [field, direction] = sortBy.split('-');
        const sorted = [...filtered].sort((a, b) => {
            let result = 0;
            if (field === 'name') {
                result = a.name.localeCompare(b.name);
            } else if (field === 'tests') {
                result = (labTestCountByCategory[a._id] || 0) - (labTestCountByCategory[b._id] || 0);
            }
            return direction === 'desc' ? -result : result;
        });

        return sorted;
    }, [categories, searchQuery, selectedStatus, sortBy, labTestCountByCategory]);

    const csvData = useMemo(
        () =>
            filteredCategories.map((cat) => ({
                Name: cat.name,
                Description: cat.description,
                'Lab Tests': labTestCountByCategory[cat._id] || 0,
                Active: cat.isActive ? 'Active' : 'Inactive'
            })),
        [filteredCategories, labTestCountByCategory]
    );

    const paginated = filteredCategories.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const renderHeader = () => (
        <Card>
            <Box sx={{ px: 3, py: 2.5, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography variant="h2" fontWeight={600}>
                            Diagnostics Categories
                        </Typography>
                        <Chip
                            size="small"
                            label={`${(categories?.length || 0).toLocaleString()} Categories`}
                            sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 500 }}
                        />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                        Manage laboratory departments, diagnostic groupings, and service categories.
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1.5}>
                    <CSVLink data={csvData} filename={`lab-test-categories-${moment().format('YYYY-MM-DD')}.csv`} style={{ textDecoration: 'none' }}>
                        <Button variant="outlined" color="inherit" startIcon={<DescriptionOutlinedIcon />}>
                            Export CSV
                        </Button>
                    </CSVLink>
                    <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleNewCategory}>
                        New Category
                    </Button>
                </Stack>
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
                            placeholder="Search category name or description..."
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
                        <TextField select size="small" value={selectedStatus} onChange={handleStatusChange} sx={{ minWidth: 150 }}>
                            <MenuItem value="all">All Status</MenuItem>
                            <MenuItem value="active">Active</MenuItem>
                            <MenuItem value="inactive">Inactive</MenuItem>
                        </TextField>
                    </Stack>
                    <Stack direction="row" spacing={2} alignItems="center">
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
                                sx={{ minWidth: 170 }}
                            >
                                {SORT_OPTIONS.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={viewMode}
                            onChange={(e, value) => {
                                if (value) {
                                    setViewMode(value);
                                    setPage(0);
                                }
                            }}
                        >
                            <ToggleButton value="card">
                                <GridViewOutlinedIcon fontSize="small" sx={{ mr: 0.75 }} />
                                Grid View
                            </ToggleButton>
                            <ToggleButton value="table">
                                <TableRowsOutlinedIcon fontSize="small" sx={{ mr: 0.75 }} />
                                List View
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Stack>
                </Stack>
            </Box>
        </Card>
    );

    const renderPagination = () => (
        <TablePagination
            component="div"
            count={filteredCategories.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{ borderTop: '1px solid', borderColor: 'divider' }}
        />
    );

    const renderEmptyState = () => (
        <Stack alignItems="center" py={6}>
            <Typography color="text.secondary" variant="h5">
                No categories to display. Try checking your filters
            </Typography>
        </Stack>
    );

    const renderCardView = () => (
        <Card sx={{ overflow: 'hidden' }}>
            <Box sx={{ p: 3 }}>
                {paginated.length === 0 ? (
                    renderEmptyState()
                ) : (
                    <Grid container spacing={2.5}>
                        {paginated.map((cat) => {
                            const Icon = getCategoryIcon(cat.name);
                            const style = stringToChipColor(cat._id);
                            const testCount = labTestCountByCategory[cat._id] || 0;
                            return (
                                <Grid item key={cat._id} xs={12} sm={6} md={4} lg={3}>
                                    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                        <Box sx={{ p: 2.5, flex: 1 }}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                                                <Chip
                                                    label={cat.isActive ? 'Active' : 'Inactive'}
                                                    size="small"
                                                    color={cat.isActive ? 'success' : 'default'}
                                                    variant={cat.isActive ? 'filled' : 'outlined'}
                                                />
                                                <Box
                                                    sx={{
                                                        width: 36,
                                                        height: 36,
                                                        borderRadius: '50%',
                                                        bgcolor: style.bg,
                                                        color: style.color,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    <Icon fontSize="small" />
                                                </Box>
                                            </Stack>
                                            <Typography variant="subtitle1" fontWeight={700}>
                                                {cat.name}
                                            </Typography>
                                            {cat.description && (
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{
                                                        mt: 0.5,
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden'
                                                    }}
                                                >
                                                    {cat.description}
                                                </Typography>
                                            )}
                                            <Divider sx={{ my: 1.5 }} />
                                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                <Stack direction="row" spacing={0.75} alignItems="center">
                                                    <ScienceOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        {testCount} lab test{testCount === 1 ? '' : 's'}
                                                    </Typography>
                                                </Stack>
                                                <Button size="small" startIcon={<EditIcon fontSize="small" />} onClick={() => handleEditCategory(cat._id)}>
                                                    Edit
                                                </Button>
                                            </Stack>
                                        </Box>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
                )}
            </Box>
            {renderPagination()}
        </Card>
    );

    const renderTableView = () => (
        <Card sx={{ overflow: 'hidden' }}>
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                            {['Name', 'Description', 'Lab Tests Count', 'Active', 'Action'].map((head) => (
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
                        {paginated.map((cat) => {
                            const Icon = getCategoryIcon(cat.name);
                            const style = stringToChipColor(cat._id);
                            const testCount = labTestCountByCategory[cat._id] || 0;
                            return (
                                <TableRow key={cat._id} hover>
                                    <TableCell>
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            <Box
                                                sx={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: '50%',
                                                    bgcolor: style.bg,
                                                    color: style.color,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                }}
                                            >
                                                <Icon fontSize="small" />
                                            </Box>
                                            <Typography variant="body2" fontWeight={600}>
                                                {cat.name}
                                            </Typography>
                                        </Stack>
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 320 }}>
                                        <Typography variant="body2" color="text.secondary" dangerouslySetInnerHTML={{ __html: cat.description || '' }} />
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={`${testCount} Lab Test${testCount === 1 ? '' : 's'}`} size="small" variant="outlined" />
                                    </TableCell>
                                    <TableCell>
                                        <Switch checked={cat.isActive} onChange={(e) => handleToggleActive(cat, e.target.checked)} />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            color="primary"
                                            onClick={() => handleEditCategory(cat._id)}
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
            {renderPagination()}
        </Card>
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
            {viewMode === 'card' ? renderCardView() : renderTableView()}
            <CategoryFormModal open={openModal} onClose={handleCloseModal} onSubmit={handleSubmitForm} category={editingCategory} />
        </Stack>
    );
};

export default ServiceCategoryList;
