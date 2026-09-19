import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { MdDashboard, MdTableChart } from 'react-icons/md';
import service from 'api/service';
import category from 'api/category';
import { useQuery } from 'react-query';
import { debounce } from 'lodash';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import { FaPesoSign } from 'react-icons/fa6';

const GRID_ITEMS_PER_PAGE = 12;

const ProductList = ({ mode }) => {
    const navigate = useNavigate();
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [viewMode, setViewMode] = useState('card');
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [userRole, setUserRole] = useState([]);

    const { data: services, isLoading, isError, error } = useQuery('services', () => service.GetAllServices().then(data => data.sort((a, b) => a.name.localeCompare(b.name))));
    const { data: categories } = useQuery('categories', () => category.GetAllCategories().then(data => data.filter(cat => cat.isActive).sort((a, b) => a.name.localeCompare(b.name))));

    // Retrieve user role from session storage
    useEffect(() => {
        const role = JSON.parse(localStorage.getItem('session'));
        setUserRole(role);
    }, []);

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

    const handleCategoryChange = (event) => {
        setSelectedCategory(event.target.value);
        setPage(0);
    };

    const handleNewProduct = () => {
        // Redirect to the service form route when "New Product" button is clicked
        navigate('/dashboard/labtest/new');
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleEditProduct = (id) => {
        const service = services.find((p) => p._id === id);
        if (service) {
            // Extract the category id
            const categoryId = service.category?.id;

            // Create a new object with the category id instead of the entire category object
            const serviceWithCategoryId = {
                ...service,
                categoryId: categoryId
            };

            setSelectedProduct(serviceWithCategoryId);
            const encodedProduct = encodeURIComponent(JSON.stringify(serviceWithCategoryId));
            navigate(`/dashboard/labtest/edit?product=${encodedProduct}`);
        }
    };

    const filteredProducts = useMemo(() => {
        const lowerCaseSearchQuery = searchQuery?.toLowerCase();

        return (
            services?.filter(
                (product) =>
                    product?.name?.toLowerCase()?.includes(lowerCaseSearchQuery) &&
                    (selectedCategory === '' || product?.category?.id === selectedCategory)
            ) || []
        ); // Return an empty array if services is null or undefined
    }, [services, searchQuery, selectedCategory]);

    const uniqueCategories = useMemo(() => {
        // Create a map to keep track of unique categories by name
        const categoryMap = new Map();

        // Iterate over the categories and add them to the map if they are not already present
        categories?.forEach((category) => {
            if (!categoryMap.has(category.name)) {
                categoryMap.set(category.name, { id: category._id, name: category.name });
            }
        });

        // Convert the map values to an array
        return Array.from(categoryMap.values());
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
                        value={selectedCategory}
                        onChange={handleCategoryChange}
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
                        <MenuItem value="">All Categories</MenuItem>
                        {uniqueCategories?.map((category) => (
                            <MenuItem key={category?.id} value={category?.id}>
                                {category.name}
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
                    {userRole?.role?.name === 'admin' && (
                        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleNewProduct}>
                            New Item
                        </Button>
                    )}
                </Stack>
            </Stack>
            {children}
        </div>
    );

    const renderCardView = (children) =>
        renderWrapper(
            children ?? (
                <div>
                    <Grid container spacing={2}>
                        {filteredProducts
                            ?.slice(page * GRID_ITEMS_PER_PAGE, page * GRID_ITEMS_PER_PAGE + GRID_ITEMS_PER_PAGE)
                            ?.map((product) => (
                            <Grid item key={product._id} xs={12} sm={6} md={4} lg={3}>
                                <Card
                                    style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F5F5F7' }}
                                    variant="outlined"
                                >
                                    <CardContent style={{ flex: '1 1 auto' }}>
                                        <Stack direction="column" justifyContent="flex-start" alignItems="flex-start" spacing={1.25}>
                                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                                {product?.category?.name && (
                                                    <Chip label={product.category.name} size="small" variant="outlined" color="primary" />
                                                )}
                                                {product?.sku && (
                                                    <Chip
                                                        icon={<Inventory2OutlinedIcon fontSize="small" />}
                                                        label={product.sku}
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                )}
                                            </Stack>
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
                                                    {product?.name}
                                                </Typography>
                                                {product?.description && (
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
                                                        {product.description}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Divider sx={{ width: '100%' }} />
                                            {product?.no_price ? (
                                                <Chip label="No set price" size="small" variant="outlined" />
                                            ) : (
                                                <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <FaPesoSign style={{ fontSize: '0.75rem', marginRight: 3 }} />
                                                    {new Intl.NumberFormat().format(product?.price || 0)}
                                                </Typography>
                                            )}
                                            {product?.transaction_count > 0 && (
                                                <Stack direction="row" spacing={0.75} alignItems="center">
                                                    <TrendingUpOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        Ordered {product.transaction_count} time{product.transaction_count === 1 ? '' : 's'}
                                                    </Typography>
                                                </Stack>
                                            )}
                                        </Stack>
                                    </CardContent>
                                    {userRole?.role?.name === 'admin' && (
                                        <CardActions style={{ flexShrink: 0 }}>
                                            <Stack direction="row" justifyContent="flex-end" sx={{ width: '100%' }}>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    sx={{ borderColor: 'grey.400', backgroundColor: 'white' }}
                                                    onClick={() => handleEditProduct(product._id)}
                                                    startIcon={<EditIcon />}
                                                >
                                                    Edit
                                                </Button>
                                            </Stack>
                                        </CardActions>
                                    )}
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                    <div style={{ flex: '0 1 auto' }}>
                        <TablePagination
                            component="div"
                            count={filteredProducts?.length}
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
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Category</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Inventory Prerequisite</TableCell>
                                <TableCell>Price</TableCell>
                                {mode != 'view' && <TableCell>Action</TableCell>}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredProducts?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((product) => (
                                <TableRow key={product._id}>
                                    <TableCell>{product.name}</TableCell>
                                    <TableCell>
                                        <Chip label={product?.category?.name} size="small" variant="outlined" color="secondary" />
                                    </TableCell>
                                    <TableCell dangerouslySetInnerHTML={{ __html: product.description }} />
                                    <TableCell>
                                        <ul>
                                            {product.inventoryPrerequisite?.map((prerequisite) => (
                                                <li
                                                    key={prerequisite.id}
                                                >{`SKU: ${prerequisite.id}, Quantity: ${prerequisite.quantity}`}</li>
                                            ))}
                                        </ul>
                                    </TableCell>
                                    <TableCell>
                                        <Stack direction="row" alignItems="center">
                                            <FaPesoSign fontSize={17} />
                                            {new Intl.NumberFormat().format(product?.price)}
                                        </Stack>
                                    </TableCell>
                                    {mode != 'view' && (
                                        <TableCell>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                color="primary"
                                                onClick={() => handleEditProduct(product._id)}
                                                startIcon={<EditIcon />}
                                            >
                                                Edit
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {children}
                </TableContainer>
                <div style={{ flex: '0 1 auto' }}>
                    <TablePagination
                        component="div"
                        count={filteredProducts?.length}
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

    if (!filteredProducts || filteredProducts.length === 0) {
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

export default ProductList;
