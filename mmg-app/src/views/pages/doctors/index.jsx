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
    Checkbox,
    TablePagination
} from '@mui/material';
import CreateDoctorModal from './components/CreateDoctorModal';
import { useQuery } from 'react-query';
import { startCase } from 'lodash';
import doctor from 'api/doctor';
import UpdateDoctorModal from './components/UpdateDoctorModal';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

const SORT_OPTIONS = [
    { value: 'name-asc', label: 'Name (A-Z)' },
    { value: 'name-desc', label: 'Name (Z-A)' },
    { value: 'age-asc', label: 'Age (Low-High)' },
    { value: 'age-desc', label: 'Age (High-Low)' }
];

// Deterministic pastel avatar color derived from the doctor's own id, so it stays stable
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

function DoctorsPage() {
    const { data: doctors, isLoading, isRefetching } = useQuery('doctors', () =>
        doctor.GetAllDoctor().then((data) =>
            data.sort((a, b) => {
                const fullNameA = `${a.firstName} ${a.lastName}`.toLowerCase();
                const fullNameB = `${b.firstName} ${b.lastName}`.toLowerCase();
                return fullNameA.localeCompare(fullNameB);
            })
        )
    );

    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name-asc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

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

    const filteredDoctors = useMemo(() => {
        const lowercaseSearchQuery = searchQuery.toLowerCase();
        const filtered =
            doctors?.filter(
                (doctor) =>
                    doctor.firstName.toLowerCase().includes(lowercaseSearchQuery) || doctor.lastName.toLowerCase().includes(lowercaseSearchQuery)
            ) || [];

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
    }, [doctors, searchQuery, sortBy]);

    const renderTable = (children) => (
        <Stack spacing={2.5}>
            {/* Header */}
            <Card>
                <Box sx={{ px: 3, py: 2.5, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Typography variant="h2" fontWeight={600}>
                                Doctors
                            </Typography>
                            <Chip
                                size="small"
                                label={`${(doctors?.length || 0).toLocaleString()} Doctors`}
                                sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 500 }}
                            />
                            {isRefetching && <CircularProgress size={16} />}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" mt={0.5}>
                            Manage physician and healthcare specialist records for the clinical registry.
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1.5}>
                        <CreateDoctorModal />
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
                                {['Name', 'Age', 'Gender', 'Address', 'Member', 'Action'].map((head) => (
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
                            {filteredDoctors.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((doc) => {
                                const avatarColor = stringToAvatarColor(doc._id);
                                return (
                                    <TableRow key={doc._id} hover>
                                        <TableCell>
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <Avatar
                                                    sx={{ bgcolor: avatarColor.bg, color: avatarColor.color, fontWeight: 600, fontSize: '0.8125rem' }}
                                                >
                                                    {getInitials(doc.firstName, doc.lastName)}
                                                </Avatar>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {startCase(`${doc.firstName} ${doc.middleName ? doc.middleName + ' ' : ''}${doc.lastName}`)}
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>{doc.age}</TableCell>
                                        <TableCell>{doc.gender === 'M' ? 'Male' : 'Female'}</TableCell>
                                        <TableCell>{doc.address}</TableCell>
                                        <TableCell>
                                            <Checkbox checked={doc.isMember} readOnly disableRipple />
                                        </TableCell>
                                        <TableCell align="right">
                                            <UpdateDoctorModal initialValues={{ ...doc, id: doc._id }} />
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
                    count={filteredDoctors.length}
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

    if (!doctors || doctors.length === 0) {
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

export default DoctorsPage;
