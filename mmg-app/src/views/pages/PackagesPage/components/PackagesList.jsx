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
import { MdDashboard, MdTableChart } from 'react-icons/md';
import { FaPesoSign } from 'react-icons/fa6';
import packageapi from 'api/package';
import { useQuery } from 'react-query';
import { debounce, startCase } from 'lodash';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';

// Mock data
import { packageTypes } from 'utils/mockData';

const GRID_ITEMS_PER_PAGE = 12;

const PackageList = () => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState('card');
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const { data: packages, isLoading, isError, error } = useQuery('packages', () => packageapi.GetAllPackages().then(data => data.sort((a, b) => a.name.localeCompare(b.name))));

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
        navigate('/dashboard/packages/new');
    };

    const handleEditProduct = (id) => {
        const service = packages.find((p) => p._id === id);
        if (service) {
            const encodedProduct = encodeURIComponent(JSON.stringify(service));
            console.log('servicexxx', encodedProduct)
            navigate(`/dashboard/packages/edit?product=${encodedProduct}`);
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const filteredProducts = useMemo(() => {
        return packages?.filter(
            (product) =>
                (product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    product.packageType.toLowerCase().includes(searchQuery.toLowerCase())) &&
                (selectedCategory === '' || product.packageType === selectedCategory)
        );
    }, [packages, searchQuery, selectedCategory]);

    const uniqueCategories = useMemo(() => {
        const categories = packageTypes?.map((category) => ({ id: category.id, type: category.type })) || [];
        const uniqueCategoriesMap = new Map();

        categories.forEach((category) => {
            if (!uniqueCategoriesMap.has(category.type)) {
                uniqueCategoriesMap.set(category.type, category);
            }
        });

        return Array.from(uniqueCategoriesMap.values());
    }, [packageTypes]);

    const renderWrapper = (children) => (
        <div>
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', sm: 'center' }}
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
                        placeholder="Search by name or type"
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
                        <MenuItem value="">All Types</MenuItem>
                        {uniqueCategories.map((category) => (
                            <MenuItem key={category.id} value={category.id}>
                                {category.type}
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

                    <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleNewProduct}>
                        New Item
                    </Button>
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
                            .map((product) => (
                            <Grid item key={product._id} xs={12} sm={6} md={4} lg={3}>
                                <Card
                                    style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F5F5F7' }}
                                    variant="outlined"
                                >
                                    <CardContent style={{ flex: '1 1 auto' }}>
                                        <Stack direction="column" justifyContent="flex-start" alignItems="flex-start" spacing={1.25}>
                                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                                <Chip label={startCase(product.packageType)} size="small" variant="outlined" color="primary" />
                                                {product.discount && (
                                                    <Chip
                                                        label={
                                                            product.discount.type === 'percentage'
                                                                ? `${product.discount.value}% OFF`
                                                                : `₱${new Intl.NumberFormat().format(product.discount.value)} OFF`
                                                        }
                                                        size="small"
                                                        color="error"
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
                                                    {startCase(product.name)}
                                                </Typography>
                                                {product.description && (
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
                                            <Stack direction="row" alignItems="baseline" spacing={1}>
                                                {product.discount &&
                                                product.totalDiscountedPrice != null &&
                                                product.totalDiscountedPrice !== product.totalPackagePrice ? (
                                                    <>
                                                        <Typography
                                                            variant="h4"
                                                            color="primary.main"
                                                            sx={{ display: 'flex', alignItems: 'center' }}
                                                        >
                                                            <FaPesoSign style={{ fontSize: '0.75rem', marginRight: 3 }} />
                                                            {new Intl.NumberFormat().format(product.totalDiscountedPrice)}
                                                        </Typography>
                                                        <Typography
                                                            variant="body2"
                                                            color="text.disabled"
                                                            sx={{ textDecoration: 'line-through', display: 'flex', alignItems: 'center' }}
                                                        >
                                                            <FaPesoSign style={{ fontSize: '0.65rem', marginRight: 2 }} />
                                                            {new Intl.NumberFormat().format(product.totalPackagePrice)}
                                                        </Typography>
                                                    </>
                                                ) : (
                                                    <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center' }}>
                                                        <FaPesoSign style={{ fontSize: '0.75rem', marginRight: 3 }} />
                                                        {new Intl.NumberFormat().format(product.totalPackagePrice || 0)}
                                                    </Typography>
                                                )}
                                            </Stack>
                                            <Stack direction="row" spacing={0.75} alignItems="center">
                                                <ScienceOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                                <Typography variant="body2" color="text.secondary">
                                                    {product.labTest?.length || 0} lab test{product.labTest?.length === 1 ? '' : 's'} included
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
                                                onClick={() => handleEditProduct(product._id)}
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
                                <TableCell>Type</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Lab Tests</TableCell>
                                <TableCell>Action</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredProducts?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((product) => (
                                <TableRow key={product._id}>
                                    <TableCell>{product.name}</TableCell>
                                    <TableCell>
                                        <Chip label={product.packageType} size="small" variant="outlined" color="primary" />
                                    </TableCell>
                                    <TableCell dangerouslySetInnerHTML={{ __html: product.description }} />
                                    <TableCell>{product.labTest?.map((prerequisite) => `${prerequisite.name}`).join(', ')}</TableCell>
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

export default PackageList;
