import React, { useState, useMemo } from 'react';
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
    Avatar,
    Box,
    MenuItem,
    CircularProgress,
    TablePagination,
    Divider,
    ToggleButton,
    ToggleButtonGroup
} from '@mui/material';
import packageapi from 'api/package';
import { useQuery } from 'react-query';
import { startCase } from 'lodash';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { CSVLink } from 'react-csv';
import moment from 'moment';

const SORT_OPTIONS = [
    { value: 'name-asc', label: 'Name (A-Z)' },
    { value: 'name-desc', label: 'Name (Z-A)' },
    { value: 'price-asc', label: 'Price (Low-High)' },
    { value: 'price-desc', label: 'Price (High-Low)' }
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

// Cosmetic display code — this app has no sequential package-facing id, so this numbers
// packages by their position in the sorted catalog rather than inventing a backend field.
const getDisplayCode = (index) => `#PKG-${String(index + 1).padStart(3, '0')}`;

const formatCurrency = (value) => `₱${new Intl.NumberFormat().format(value || 0)}`;

const PackagesList = () => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState('table');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState('all');
    const [sortBy, setSortBy] = useState('name-asc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const { data: packages, isLoading } = useQuery('packages', () =>
        packageapi.GetAllPackages().then((data) => data.sort((a, b) => a.name.localeCompare(b.name)))
    );

    const handleSearch = (event) => {
        setSearchQuery(event.target.value);
        setPage(0);
    };

    const handleTypeChange = (event) => {
        setSelectedType(event.target.value);
        setPage(0);
    };

    const handleNewPackage = () => {
        navigate('/dashboard/packages/new');
    };

    const handleEditPackage = (id) => {
        const found = packages.find((p) => p._id === id);
        if (found) {
            const encodedProduct = encodeURIComponent(JSON.stringify(found));
            navigate(`/dashboard/packages/edit?product=${encodedProduct}`);
        }
    };

    const handleChangePage = (event, newPage) => setPage(newPage);

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Sorted the same way regardless of filter/search, so display codes (#PKG-001, ...) stay
    // stable for a given package rather than shifting as the user filters.
    const sortedPackages = useMemo(() => (packages || []).slice().sort((a, b) => a.name.localeCompare(b.name)), [packages]);

    const filteredPackages = useMemo(() => {
        const query = searchQuery.toLowerCase();
        const filtered = sortedPackages
            .map((pkg, index) => ({ ...pkg, displayCode: getDisplayCode(index) }))
            .filter((pkg) => {
                const testNames = (pkg.labTest || []).map((t) => t.name.toLowerCase()).join(' ');
                return (
                    (pkg.name.toLowerCase().includes(query) ||
                        pkg.packageType?.toLowerCase().includes(query) ||
                        pkg.displayCode.toLowerCase().includes(query) ||
                        testNames.includes(query)) &&
                    (selectedType === 'all' || pkg.packageType === selectedType)
                );
            });

        const [field, direction] = sortBy.split('-');
        const sorted = [...filtered].sort((a, b) => {
            let result = 0;
            if (field === 'name') {
                result = a.name.localeCompare(b.name);
            } else if (field === 'price') {
                result = (a.totalDiscountedPrice ?? a.totalPackagePrice ?? 0) - (b.totalDiscountedPrice ?? b.totalPackagePrice ?? 0);
            }
            return direction === 'desc' ? -result : result;
        });

        return sorted;
    }, [sortedPackages, searchQuery, selectedType, sortBy]);

    const csvData = useMemo(
        () =>
            filteredPackages.map((pkg) => ({
                Code: pkg.displayCode,
                Name: pkg.name,
                Type: startCase(pkg.packageType),
                Description: pkg.description,
                'Lab Tests': (pkg.labTest || []).map((t) => t.name).join('; '),
                Price: pkg.totalDiscountedPrice ?? pkg.totalPackagePrice ?? 0
            })),
        [filteredPackages]
    );

    const uniqueTypes = useMemo(() => Array.from(new Set((packages || []).map((p) => p.packageType).filter(Boolean))), [packages]);

    const paginated = filteredPackages.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const renderPriceBlock = (pkg, { align = 'left' } = {}) => {
        const hasDiscount = pkg.discount && pkg.totalDiscountedPrice != null && pkg.totalDiscountedPrice !== pkg.totalPackagePrice;
        return (
            <Stack direction={align === 'right' ? 'column' : 'row'} alignItems={align === 'right' ? 'flex-end' : 'baseline'} spacing={0.75}>
                <Stack direction="row" alignItems="baseline" spacing={0.75}>
                    <Typography variant="subtitle1" fontWeight={700} color={hasDiscount ? 'error.main' : 'text.primary'}>
                        {formatCurrency(hasDiscount ? pkg.totalDiscountedPrice : pkg.totalPackagePrice)}
                    </Typography>
                    {hasDiscount && (
                        <Typography variant="caption" color="text.disabled" sx={{ textDecoration: 'line-through' }}>
                            {formatCurrency(pkg.totalPackagePrice)}
                        </Typography>
                    )}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                    /patient
                </Typography>
            </Stack>
        );
    };

    const renderHeader = () => (
        <Card>
            <Box sx={{ px: 3, py: 2.5, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography variant="h2" fontWeight={600}>
                            Packages
                        </Typography>
                        <Chip
                            size="small"
                            label={`${(packages?.length || 0).toLocaleString()} Packages Available`}
                            sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 500 }}
                        />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                        Manage clinical test bundles, medical consultation tariffs, and promotional discount schemes.
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1.5}>
                    <CSVLink data={csvData} filename={`packages-export-${moment().format('YYYY-MM-DD')}.csv`} style={{ textDecoration: 'none' }}>
                        <Button variant="outlined" color="inherit" startIcon={<DescriptionOutlinedIcon />}>
                            Export CSV
                        </Button>
                    </CSVLink>
                    <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleNewPackage}>
                        New Item
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
                            placeholder="Search by package name, test, or code..."
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
            count={filteredPackages.length}
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
                No packages to display. Try checking your filters
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
                        {paginated.map((pkg) => {
                            const avatarColor = stringToAvatarColor(pkg._id);
                            const hasDiscount = pkg.discount && pkg.totalDiscountedPrice != null && pkg.totalDiscountedPrice !== pkg.totalPackagePrice;
                            return (
                                <Grid item key={pkg._id} xs={12} sm={6} md={4} lg={3}>
                                    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                        <Box sx={{ p: 2.5, flex: 1 }}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                                                <Chip
                                                    label={startCase(pkg.packageType)}
                                                    size="small"
                                                    sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 500 }}
                                                />
                                                {hasDiscount && pkg.discount?.type === 'percentage' && (
                                                    <Chip label={`${pkg.discount.value}% OFF`} size="small" color="error" />
                                                )}
                                            </Stack>
                                            <Typography variant="subtitle1" fontWeight={700}>
                                                {startCase(pkg.name)}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                                                {pkg.displayCode}
                                            </Typography>
                                            {pkg.description && (
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden',
                                                        mb: 1.5
                                                    }}
                                                >
                                                    {pkg.description}
                                                </Typography>
                                            )}
                                            {renderPriceBlock(pkg)}
                                            <Divider sx={{ my: 1.5 }} />
                                            <Stack direction="row" spacing={0.75} alignItems="center" mb={1}>
                                                <ScienceOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                                <Typography variant="body2" color="text.secondary">
                                                    {pkg.labTest?.length || 0} lab test{pkg.labTest?.length === 1 ? '' : 's'} included
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                                {(pkg.labTest || []).slice(0, 3).map((test, i) => (
                                                    <Chip key={i} label={test.name} size="small" variant="outlined" />
                                                ))}
                                            </Stack>
                                        </Box>
                                        <Box sx={{ p: 2, pt: 0 }}>
                                            <Button
                                                variant="outlined"
                                                fullWidth
                                                startIcon={<EditIcon fontSize="small" />}
                                                onClick={() => handleEditPackage(pkg._id)}
                                            >
                                                Edit Package
                                            </Button>
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
                            {['Package Name', 'Type', 'Description', 'Lab Tests Included', 'Price / Tariff', 'Action'].map((head) => (
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
                                <TableCell colSpan={6}>{renderEmptyState()}</TableCell>
                            </TableRow>
                        )}
                        {paginated.map((pkg) => {
                            const avatarColor = stringToAvatarColor(pkg._id);
                            const hasDiscount = pkg.discount && pkg.totalDiscountedPrice != null && pkg.totalDiscountedPrice !== pkg.totalPackagePrice;
                            return (
                                <TableRow key={pkg._id} hover>
                                    <TableCell>
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            <Avatar sx={{ bgcolor: avatarColor.bg, color: avatarColor.color, fontWeight: 600, fontSize: '0.8125rem' }}>
                                                {getInitials(pkg.name)}
                                            </Avatar>
                                            <Box>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {startCase(pkg.name)}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {pkg.displayCode}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </TableCell>
                                    <TableCell>
                                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                            <Chip
                                                label={startCase(pkg.packageType)}
                                                size="small"
                                                sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 500 }}
                                            />
                                            {hasDiscount && pkg.discount?.type === 'percentage' && (
                                                <Chip label={`${pkg.discount.value}% OFF`} size="small" color="error" />
                                            )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 240 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            {pkg.description}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 220 }}>
                                        <Chip
                                            label={`${pkg.labTest?.length || 0} Tests`}
                                            size="small"
                                            variant="outlined"
                                            sx={{ mb: 0.5 }}
                                        />
                                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                            {(pkg.labTest || []).slice(0, 3).map((test, i) => (
                                                <Chip key={i} label={test.name} size="small" variant="outlined" />
                                            ))}
                                        </Stack>
                                    </TableCell>
                                    <TableCell>{renderPriceBlock(pkg, { align: 'right' })}</TableCell>
                                    <TableCell align="right">
                                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                            <Button
                                                onClick={() => handleEditPackage(pkg._id)}
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
            </TableContainer>
            {renderPagination()}
        </Card>
    );

    if (isLoading) {
        return (
            <Stack spacing={2.5}>
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
            {renderHeader()}
            {renderFilters()}
            {viewMode === 'card' ? renderCardView() : renderTableView()}
        </Stack>
    );
};

export default PackagesList;
