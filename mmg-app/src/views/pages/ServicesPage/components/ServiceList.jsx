import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import service from 'api/service';
import category from 'api/category';
import { useQuery } from 'react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { CSVLink } from 'react-csv';
import moment from 'moment';

const SORT_OPTIONS = [
    { value: 'name-asc', label: 'Name (A-Z)' },
    { value: 'name-desc', label: 'Name (Z-A)' },
    { value: 'price-asc', label: 'Price (Low-High)' },
    { value: 'price-desc', label: 'Price (High-Low)' }
];

// Deterministic color per category (by id) so the same category always renders the same chip
// color across grid/table views and page reloads.
const stringToChipColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str?.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return { bg: `hsl(${hue}, 70%, 92%)`, color: `hsl(${hue}, 55%, 38%)` };
};

const formatCurrency = (value) => `₱${new Intl.NumberFormat().format(value || 0)}`;

const ProductList = ({ mode }) => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState('table');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [sortBy, setSortBy] = useState('name-asc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [userRole, setUserRole] = useState([]);

    const { data: services, isLoading } = useQuery('services', () =>
        service.GetAllServices().then((data) => data.sort((a, b) => a.name.localeCompare(b.name)))
    );
    const { data: categories } = useQuery('categories', () =>
        category.GetAllCategories().then((data) => data.filter((cat) => cat.isActive).sort((a, b) => a.name.localeCompare(b.name)))
    );

    // Retrieve user role from session storage
    useEffect(() => {
        const role = JSON.parse(localStorage.getItem('session'));
        setUserRole(role);
    }, []);
    const isAdmin = userRole?.role?.name === 'admin';

    const handleSearch = (event) => {
        setSearchQuery(event.target.value);
        setPage(0);
    };

    const handleCategoryChange = (event) => {
        setSelectedCategory(event.target.value);
        setPage(0);
    };

    const handleNewProduct = () => {
        navigate('/dashboard/labtest/new');
    };

    const handleChangePage = (event, newPage) => setPage(newPage);

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleEditProduct = (id) => {
        const found = services.find((p) => p._id === id);
        if (found) {
            const categoryId = found.category?.id;
            const serviceWithCategoryId = { ...found, categoryId };
            const encodedProduct = encodeURIComponent(JSON.stringify(serviceWithCategoryId));
            navigate(`/dashboard/labtest/edit?product=${encodedProduct}`);
        }
    };

    const filteredProducts = useMemo(() => {
        const query = searchQuery.toLowerCase();
        const filtered = (services || []).filter(
            (product) =>
                (product?.name?.toLowerCase().includes(query) ||
                    product?.sku?.toLowerCase().includes(query) ||
                    product?.category?.name?.toLowerCase().includes(query)) &&
                (selectedCategory === 'all' || product?.category?.id === selectedCategory)
        );

        const [field, direction] = sortBy.split('-');
        const sorted = [...filtered].sort((a, b) => {
            let result = 0;
            if (field === 'name') {
                result = a.name.localeCompare(b.name);
            } else if (field === 'price') {
                result = (a.price || 0) - (b.price || 0);
            }
            return direction === 'desc' ? -result : result;
        });

        return sorted;
    }, [services, searchQuery, selectedCategory, sortBy]);

    const csvData = useMemo(
        () =>
            filteredProducts.map((p) => ({
                Code: p.sku,
                Name: p.name,
                Category: p.category?.name,
                Description: p.description,
                Price: p.no_price ? 'No set price' : p.price
            })),
        [filteredProducts]
    );

    const uniqueCategories = useMemo(() => {
        const categoryMap = new Map();
        categories?.forEach((cat) => {
            if (!categoryMap.has(cat.name)) categoryMap.set(cat.name, { id: cat._id, name: cat.name });
        });
        return Array.from(categoryMap.values());
    }, [categories]);

    const paginated = filteredProducts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const renderPrice = (product) =>
        product?.no_price ? (
            <Chip label="No set price" size="small" variant="outlined" />
        ) : (
            <Typography variant="subtitle1" fontWeight={700}>
                {formatCurrency(product.price)}
            </Typography>
        );

    const renderCategoryChip = (product) => {
        if (!product?.category?.name) return null;
        const style = stringToChipColor(product.category.id || product.category.name);
        return <Chip label={product.category.name} size="small" sx={{ bgcolor: style.bg, color: style.color, fontWeight: 500 }} />;
    };

    const renderHeader = () => (
        <Card>
            <Box sx={{ px: 3, py: 2.5, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography variant="h2" fontWeight={600}>
                            Diagnostics
                        </Typography>
                        <Chip
                            size="small"
                            label={`${(services?.length || 0).toLocaleString()} Available`}
                            sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 500 }}
                        />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                        Manage laboratory diagnostic tests, pricing, procedures, tariffs, and cost breakdowns.
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1.5}>
                    <CSVLink data={csvData} filename={`lab-tests-export-${moment().format('YYYY-MM-DD')}.csv`} style={{ textDecoration: 'none' }}>
                        <Button variant="outlined" color="inherit" startIcon={<DescriptionOutlinedIcon />}>
                            Export CSV
                        </Button>
                    </CSVLink>
                    {isAdmin && (
                        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleNewProduct}>
                            New Test
                        </Button>
                    )}
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
                            placeholder="Search by test name, code, or category..."
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
                        <TextField select size="small" value={selectedCategory} onChange={handleCategoryChange} sx={{ minWidth: 190 }}>
                            <MenuItem value="all">All Categories</MenuItem>
                            {uniqueCategories.map((cat) => (
                                <MenuItem key={cat.id} value={cat.id}>
                                    {cat.name}
                                </MenuItem>
                            ))}
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
                                sx={{ minWidth: 150 }}
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
                                Table View
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
            count={filteredProducts.length}
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
                No lab tests to display. Try checking your filters
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
                        {paginated.map((product) => (
                            <Grid item key={product._id} xs={12} sm={6} md={4} lg={3}>
                                <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <Box sx={{ p: 2.5, flex: 1 }}>
                                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap mb={1.5}>
                                            {renderCategoryChip(product)}
                                            {product?.sku && <Chip label={product.sku} size="small" variant="outlined" />}
                                        </Stack>
                                        <Typography
                                            variant="subtitle1"
                                            fontWeight={700}
                                            sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
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
                                        <Divider sx={{ my: 1.5 }} />
                                        {renderPrice(product)}
                                        {product?.transaction_count > 0 && (
                                            <Stack direction="row" spacing={0.75} alignItems="center" mt={1}>
                                                <TrendingUpOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                                <Typography variant="body2" color="text.secondary">
                                                    Ordered {product.transaction_count} time{product.transaction_count === 1 ? '' : 's'}
                                                </Typography>
                                            </Stack>
                                        )}
                                    </Box>
                                    {isAdmin && (
                                        <Box sx={{ p: 2, pt: 0 }}>
                                            <Button
                                                variant="outlined"
                                                fullWidth
                                                startIcon={<EditIcon fontSize="small" />}
                                                onClick={() => handleEditProduct(product._id)}
                                            >
                                                Edit
                                            </Button>
                                        </Box>
                                    )}
                                </Card>
                            </Grid>
                        ))}
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
                            {['Test Name', 'Category', 'Description', 'Price', ...(mode !== 'view' ? ['Action'] : [])].map((head) => (
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
                                <TableCell colSpan={mode !== 'view' ? 5 : 4}>{renderEmptyState()}</TableCell>
                            </TableRow>
                        )}
                        {paginated.map((product) => (
                            <TableRow key={product._id} hover>
                                <TableCell>
                                    <Typography variant="body2" fontWeight={600}>
                                        {product.name}
                                    </Typography>
                                    {product?.sku && (
                                        <Typography variant="caption" color="text.secondary">
                                            {product.sku}
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell>{renderCategoryChip(product)}</TableCell>
                                <TableCell sx={{ maxWidth: 320 }}>
                                    <Typography variant="body2" color="text.secondary" dangerouslySetInnerHTML={{ __html: product.description }} />
                                </TableCell>
                                <TableCell>{renderPrice(product)}</TableCell>
                                {mode !== 'view' && (
                                    <TableCell align="right">
                                        {isAdmin && (
                                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                <Button
                                                    onClick={() => handleEditProduct(product._id)}
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
                                        )}
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            {renderPagination()}
        </Card>
    );

    // mode="view" is the compact picker embedded in the POS drawer (PosComponent.jsx) — the
    // dashboard-style title/subtitle/Export/New Test header belongs only on the full admin page.
    const isEmbeddedPicker = mode === 'view';

    if (isLoading) {
        return (
            <Stack spacing={2.5}>
                {isEmbeddedPicker ? (
                    <Typography variant="h3">Diagnostics</Typography>
                ) : (
                    renderHeader()
                )}
                {renderFilters()}
                <Stack alignItems="center" py={6}>
                    <CircularProgress size={28} />
                </Stack>
            </Stack>
        );
    }

    return (
        <Stack spacing={2.5}>
            {isEmbeddedPicker ? <Typography variant="h3">Diagnostics</Typography> : renderHeader()}
            {renderFilters()}
            {viewMode === 'card' ? renderCardView() : renderTableView()}
        </Stack>
    );
};

export default ProductList;
