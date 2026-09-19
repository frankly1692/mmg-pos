import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Typography,
    Grid,
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
    Chip,
    MenuItem,
    CircularProgress,
    TablePagination
} from '@mui/material';
import customer from 'api/customer';
import { useQuery } from 'react-query';
import { debounce, startCase } from 'lodash';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';

// Mock data
import { customerType } from 'utils/mockData';
import moment from 'moment';

const CustomerList = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // const {  isError, error } = useQuery('customers', customer.GetAllCustomers);
    const { data: customers, isLoading, isRefetching } = useQuery('customers', () => 
        customer.GetAllCustomers().then(data => 
            data.sort((a, b) => {
                const fullNameA = `${a.firstName} ${a.lastName}`.toLowerCase();
                const fullNameB = `${b.firstName} ${b.lastName}`.toLowerCase();
                return fullNameA.localeCompare(fullNameB);
            })
        )
    );

    const handleSearch = debounce((event) => {
        setSearchQuery(event.target.value);
    }, 300);

    const handleCategoryChange = (event) => {
        setSelectedCategory(event.target.value);
    };

    const handleNewCustomer = () => {
        // Redirect to the service form route when "New Product" button is clicked
        navigate('/dashboard/customers/new');
    };

    const handleEditCustomer = (id) => {
        const customer = filteredCustomers.find((p) => p._id === id);
        const newData = {
            ...customer,
            birthDate: moment(customer?.birthDate).format('L')
        };

        console.log(newData);
        if (customer) {
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
        return customers?.filter((customer) => {
            const fullName =
                `${customer.firstName} ${customer.middleName ? customer.middleName + ' ' : ''}${customer.lastName}`.toLowerCase();

            return (
                (customer.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    customer.middleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    customer.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    fullName.includes(searchQuery.toLowerCase()) ||
                    customer.customerType.toLowerCase().includes(searchQuery.toLowerCase())) &&
                (selectedCategory === 'all' || customer.customerType === selectedCategory)
            );
        });
    }, [customers, searchQuery, selectedCategory]);

    const renderTableView = (children) => (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={2}
                mb={3}
            >
                <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1}>
                    <TextField
                        select
                        size="small"
                        label="Member Type"
                        value={selectedCategory}
                        onChange={handleCategoryChange}
                        sx={{ minWidth: 200 }}
                    >
                        <MenuItem value="all">All</MenuItem>
                        {customers &&
                            Object.keys(Object.groupBy(customers, ({ customerType }) => customerType))
                                .filter((key) => !key || key != 'undefined')
                                .map((customerType) => <MenuItem value={customerType}>{startCase(customerType)}</MenuItem>)}
                    </TextField>
                    <TextField label="Search" variant="outlined" onChange={handleSearch} size="small" sx={{ minWidth: 300 }} />
                </Stack>
                <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={2}>
                    <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleNewCustomer}>
                        New Customer
                    </Button>
                </Stack>
            </Stack>
            <div className="table-responsive"></div>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Customer Type</TableCell>
                            <TableCell>Gender</TableCell>
                            <TableCell>Age</TableCell>
                            <TableCell>Action</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredCustomers?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((customer) => (
                            <TableRow key={customer._id}>
                                <TableCell>
                                    {customer.firstName} {customer.middleName ? customer.middleName + ' ' : ''} {customer.lastName}
                                </TableCell>
                                <TableCell>
                                    <Chip label={customer.customerType} size="small" variant="outlined" color="primary" />
                                </TableCell>
                                <TableCell>{customer.gender}</TableCell>
                                <TableCell>{customer.age}</TableCell>
                                <TableCell>
                                    <Button
                                        onClick={() => handleEditCustomer(customer._id)}
                                        startIcon={<EditIcon fontSize="small" />}
                                        variant="outlined"
                                        size="small"
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
                    count={filteredCustomers?.length}
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

    if (isLoading) {
        return renderTableView(renderMessage(<CircularProgress size={28} />));
    }

    if (!filteredCustomers || filteredCustomers.length === 0) {
        return renderTableView(
            renderMessage(
                <Typography color="lightgray" variant="h5">
                    No available data to display. Try checking your filters
                </Typography>
            )
        );
    }

    return renderTableView();
};

export default CustomerList;
