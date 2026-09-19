import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Typography,
    Grid,
    Card,
    CardContent,
    CardActions,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    TextField,
    Stack,
    IconButton,
    Chip,
    Select,
    OutlinedInput,
    InputAdornment,
    MenuItem,
    CircularProgress,
    TablePagination,
    Divider,
    Box
} from '@mui/material';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { MdDashboard, MdTableChart } from 'react-icons/md';
import CategoryFormModal from './CategoryFormModal';
import category from 'api/category';
import service from 'api/service';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { debounce } from 'lodash';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import Switch from 'ui-component/switch';

const GRID_ITEMS_PER_PAGE = 12;

const ServiceCategoryList = () => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState('card');
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [openModal, setOpenModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const queryClient = useQueryClient();

    const { data: categories, isLoading, isError, error } = useQuery('categories', category.GetAllCategories);
    const { data: services } = useQuery('services', service.GetAllServices);

    const labTestCountByCategory = useMemo(() => {
        const counts = {};
        services?.forEach((item) => {
            const categoryId = item?.category?.id;
            if (categoryId) {
                counts[categoryId] = (counts[categoryId] || 0) + 1;
            }
        });
        return counts;
    }, [services]);

    const createCategoryMutation = useMutation(category.CreateCategory, {
        onMutate: async (newCategory) => {
            await queryClient.cancelQueries('categories');
            const previousCategories = queryClient.getQueryData('categories');

            // Check if a package with the same name already exists
            const existingCategories = previousCategories?.find(
                (pkg) => pkg.name.toLowerCase() === newCategory.name.toLowerCase()
            );
    
            if (existingCategories) {
                // If a package with the same name exists, throw an error
                throw new Error('A category with this name already exists.');
            } else {
                // If no duplicate found, proceed with creating the new package
                if (!previousCategories || previousCategories.length === 0) {
                    // If empty, proceed with creating the new service
                    queryClient.setQueryData('categories', [newCategory]);
                } else {
                    // If not empty, append the new service to the existing list
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

            queryClient.setQueryData('categories', (old) => old.map((cat) => (cat._id === updatedCategory._id ? updatedCategory : cat)));
            return { previousCategories };
        },
        onError: (err) => {
            toast.error('An error occurred while updating the category.');
        },
        onSuccess: () => {
            toast.success('Category updated successfully.', { autoClose: 1500 });
        },
        onSettled: () => {
            queryClient.invalidateQueries('categories');
        }
    });

    const handleSwitchView = (mode) => {
        setViewMode(mode);
        setPage(0);
    };

    const debouncedSetSearchQuery = useRef(debounce((value) => setSearchQuery(value), 300)).current;

    const handleSearch = (event) => {
        setSearchInput(event.target.value);
        setPage(0);
        debouncedSetSearchQuery(event.target.value);
    };

    const handleClearSearch = () => {
        setSearchInput('');
        setSearchQuery('');
        setPage(0);
        debouncedSetSearchQuery.cancel();
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
        const category = categories.find((c) => c._id === id);
        if (category) {
            setEditingCategory({
                id: category._id,
                name: category.name,
                description: category.description,
                isActive: category.isActive
            });
            setOpenModal(true); // Open the modal for editing
        }
    };

    const handleCloseModal = () => {
        setOpenModal(false);
    };

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

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const filteredCategory = useMemo(() => {
        return categories?.filter(
            (category) =>
                category.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                (selectedStatus === '' || category.isActive === selectedStatus)
        );
    }, [categories, searchQuery, selectedStatus]);

    const uniqueStatus = useMemo(() => {
        return [...new Set(categories?.map((category) => category?.isActive))];
    }, [categories]);

    const renderWrapper = (children) => (
        <div>
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
                spacing={2}
                mb={3}
            >
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    spacing={1.5}
                    sx={{
                        p: 1,
                        borderRadius: 2,
                        bgcolor: 'grey.50',
                        border: '1px solid',
                        borderColor: 'grey.200'
                    }}
                >
                    <TextField
                        placeholder="Search by name"
                        variant="outlined"
                        value={searchInput}
                        onChange={handleSearch}
                        size="small"
                        sx={{ minWidth: { sm: 240 }, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'background.paper' } }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" color="action" />
                                </InputAdornment>
                            ),
                            endAdornment: searchInput && (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={handleClearSearch} edge="end" aria-label="Clear search">
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            )
                        }}
                    />
                    <Select
                        value={selectedStatus}
                        onChange={handleStatusChange}
                        displayEmpty
                        size="small"
                        sx={{ minWidth: { sm: 190 }, borderRadius: 2, bgcolor: 'background.paper' }}
                        input={
                            <OutlinedInput
                                startAdornment={
                                    <InputAdornment position="start">
                                        <FilterAltIcon fontSize="small" color="action" />
                                    </InputAdornment>
                                }
                            />
                        }
                    >
                        <MenuItem value="">All Status</MenuItem>
                        {uniqueStatus.map((status) => (
                            <MenuItem key={status} value={status}>
                                {status ? 'Active' : 'In-active'}
                            </MenuItem>
                        ))}
                    </Select>
                </Stack>
                <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1}>
                    {viewMode === 'table' ? (
                        <Button
                            variant="outlined"
                            onClick={() => handleSwitchView('card')}
                            startIcon={<MdDashboard style={{ marginRight: '3px' }} />}
                        >
                            View in Grid
                        </Button>
                    ) : (
                        <Button
                            variant="outlined"
                            onClick={() => handleSwitchView('table')}
                            startIcon={<MdTableChart style={{ marginRight: '3px' }} />}
                        >
                            View in List
                        </Button>
                    )}
                    <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleNewCategory}>
                        New Category
                    </Button>
                </Stack>
            </Stack>
            {children}

            <CategoryFormModal open={openModal} onClose={handleCloseModal} onSubmit={handleSubmitForm} category={editingCategory} />
        </div>
    );

    const renderCardView = (children) =>
        renderWrapper(
            children ?? (
                <div>
                    <ToastContainer />
                    <Grid container spacing={2}>
                        {filteredCategory
                            ?.slice(page * GRID_ITEMS_PER_PAGE, page * GRID_ITEMS_PER_PAGE + GRID_ITEMS_PER_PAGE)
                            .map((category) => (
                            <Grid item key={category._id} xs={12} sm={6} md={4} lg={3}>
                                <Card
                                    style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F5F5F7' }}
                                    variant="outlined"
                                >
                                    <CardContent style={{ flex: '1 1 auto' }}>
                                        <Stack direction="column" justifyContent="flex-start" alignItems="flex-start" spacing={1.25}>
                                            <Chip
                                                label={category.isActive ? 'Active' : 'In-active'}
                                                size="small"
                                                variant="outlined"
                                                color={category.isActive ? 'primary' : 'error'}
                                            />
                                            <Box>
                                                <Typography
                                                    variant="h3"
                                                    component="div"
                                                    sx={{
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden'
                                                    }}
                                                >
                                                    {category.name}
                                                </Typography>
                                                {category.description && (
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
                                                        {category.description}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Divider sx={{ width: '100%' }} />
                                            <Stack direction="row" spacing={0.75} alignItems="center">
                                                <ScienceOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                                <Typography variant="body2" color="text.secondary">
                                                    {labTestCountByCategory[category._id] || 0} lab test
                                                    {labTestCountByCategory[category._id] === 1 ? '' : 's'}
                                                </Typography>
                                            </Stack>
                                        </Stack>
                                    </CardContent>
                                    <CardActions style={{ flexShrink: 0 }}>
                                        <Stack
                                            direction="row"
                                            justifyContent="space-between"
                                            alignItems="center"
                                            spacing={2}
                                            sx={{ width: '100%' }}
                                        >
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                sx={{ borderColor: 'grey.400', backgroundColor: 'white' }}
                                                onClick={() => handleEditCategory(category._id)}
                                                startIcon={<EditIcon />}
                                            >
                                                Edit
                                            </Button>
                                        </Stack>
                                    </CardActions>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                    <div style={{ flex: '0 1 auto' }}>
                        <TablePagination
                            component="div"
                            count={filteredCategory?.length}
                            page={page}
                            onPageChange={handleChangePage}
                            rowsPerPage={GRID_ITEMS_PER_PAGE}
                            rowsPerPageOptions={[GRID_ITEMS_PER_PAGE]}
                        />
                    </div>
                </div>
            )
        );

    const renderTableView = (children) =>
        renderWrapper(
            <div>
                <ToastContainer />
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Active</TableCell>
                                <TableCell>Action</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredCategory?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((category) => (
                                <TableRow key={category._id}>
                                    <TableCell>{category.name}</TableCell>
                                    <TableCell dangerouslySetInnerHTML={{ __html: category.description }} />
                                    <TableCell>
                                        <Switch readOnly checked={category.isActive} />
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            color="primary"
                                            onClick={() => handleEditCategory(category._id)}
                                            startIcon={<EditIcon />}
                                        >
                                            Edit
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {children}
                </TableContainer>
                <div style={{ flex: '0 1 auto' }}>
                    <TablePagination
                        component="div"
                        count={filteredCategory?.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                    />
                </div>
            </div>
        );

    const renderMessage = (children) => (
        <Stack alignItems="center" my={4}>
            {children}
        </Stack>
    );

    const renderView = viewMode === 'card' ? renderCardView : renderTableView;

    if (isLoading) {
        return renderView(renderMessage(<CircularProgress size={28} />));
    }

    if (!filteredCategory || filteredCategory.length === 0) {
        return renderView(
            renderMessage(
                <Typography color="lightgray" variant="h5">
                    No available data to display. Try checking your filters
                </Typography>
            )
        );
    }

    return renderView();
};

export default ServiceCategoryList;
