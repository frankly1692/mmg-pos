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
    Paper,
    TextField,
    Stack,
    CircularProgress,
    TablePagination,
    Select,
    MenuItem
} from '@mui/material';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { FaPesoSign } from 'react-icons/fa6';
// api
import discount from 'api/discount';

import DiscountFormModal from './DiscountFormModal';

// Mock data
const mockDiscounts = [
    {
        id: 'dis-0001',
        name: 'Senior Citizen Discount',
        description: 'This is a description for Discount 1',
        discountPercentage: 0.2
    },
    {
        id: 'dis-0002',
        name: 'PWD Discount',
        description: 'This is a description for Discount 1',
        discountPercentage: 0.2
    }
];

const DiscountList = () => {
    const navigate = useNavigate();
    const [openModal, setOpenModal] = useState(false);
    const [editingDiscount, setEditingDiscount] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [selectedStatus, setSelectedStatus] = useState('');

    const queryClient = useQueryClient();

    const { data: discounts, isLoading, isError, error } = useQuery('discounts', discount.GetAllDiscounts);

    const createDiscountMutation = useMutation(discount.CreateDiscount, {
        onMutate: async (newDiscount) => {
            await queryClient.cancelQueries('discounts');
            const previousDiscounts = queryClient.getQueryData('discounts');

            // Check if a package with the same name already exists
            const existingDiscount = previousDiscounts?.find(
                (pkg) => pkg.name.toLowerCase() === newDiscount.name.toLowerCase()
            );

            if (existingDiscount) {
                // If a package with the same name exists, throw an error
                throw new Error('A discount with this name already exists.');
            } else {
                // If no duplicate found, proceed with creating the new package
                if (!previousDiscounts || previousDiscounts.length === 0) {
                    // If empty, proceed with creating the new service
                    queryClient.setQueryData('packages', [newDiscount]);
                } else {
                    // If not empty, append the new service to the existing list
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

            queryClient.setQueryData('discounts', (old) => old.map((cat) => (cat._id === updateDiscount._id ? updateDiscount : cat)));
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
    };

    const handleStatusChange = (event) => {
        setSelectedStatus(event.target.value);
    };

    const handleNewDiscount = () => {
        setEditingDiscount(null); // Clear any previous editing data
        setOpenModal(true);
    };

    const handleEditDiscount = (id) => {
        const discount = discounts.find((c) => c._id === id); // Use 'id' instead of 'sku'
        if (discount) {
            setEditingDiscount({
                id: discount._id,
                name: discount.name,
                description: discount.description,
                value: discount.value,
                type: discount.type
            });
            setOpenModal(true); // Open the modal for editing
        }
    };

    const handleCloseModal = () => {
        setOpenModal(false);
    };

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
        console.log(data);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // const filteredDiscounts = discounts?.filter((discount) => discount?.name?.toLowerCase().includes(searchQuery.toLowerCase()));

    const filteredDiscounts = useMemo(() => {
        return discounts?.filter(
            (discount) =>
                discount.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                (selectedStatus === '' || discount.type === selectedStatus)
        );
    }, [discounts, searchQuery, selectedStatus]);

    const uniqueStatus = useMemo(() => {
        return [...new Set(discounts?.map((discount) => discount?.type))];
    }, [discounts]);

    const renderTableView = () => (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell sx={{ textWrap: 'nowrap', overflow: 'hidden' }}>Description</TableCell>
                            <TableCell>Discount</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Action</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredDiscounts?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((discount) => (
                            <TableRow key={discount._id}>
                                <TableCell>{discount.name}</TableCell>
                                <TableCell dangerouslySetInnerHTML={{ __html: discount.description }} />
                                <TableCell>
                                    <Stack direction="row" alignItems="center">
                                        {discount.type == 'percentage' ? (
                                            `${discount.value}%`
                                        ) : (
                                            <>
                                                <FaPesoSign fontSize={16} />
                                                {`${new Intl.NumberFormat().format(discount.value)}`}
                                            </>
                                        )}
                                    </Stack>
                                </TableCell>
                                <TableCell>{discount.type}</TableCell>
                                <TableCell>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        color="primary"
                                        onClick={() => handleEditDiscount(discount._id)}
                                        startIcon={<EditIcon />}
                                    >
                                        Edit
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <div style={{ flex: '0 1 auto' }}>
                <TablePagination
                    component="div"
                    count={filteredDiscounts?.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <Stack direction="column" justifyContent="center" alignItems="center" spacing={2}>
                <CircularProgress />
            </Stack>
        );
    }

    if (isError) {
        return <Typography color="error">{error.message}</Typography>;
    }

    return (
        <div>
            <ToastContainer />
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={2}
                mb={3}
            >
                <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={2}>
                    <Select value={selectedStatus} onChange={handleStatusChange} displayEmpty size="small" sx={{ minWidth: 190 }}>
                        <MenuItem value="">All Types</MenuItem>
                        {uniqueStatus.map((status) => (
                            <MenuItem key={status} value={status}>
                                {status}
                            </MenuItem>
                        ))}
                    </Select>
                    <TextField label="Search" variant="outlined" onChange={handleSearch} size="small" sx={{ minWidth: 300 }} />
                </Stack>
                <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={2}>
                    <Button startIcon={<AddIcon />} variant="contained" onClick={handleNewDiscount}>
                        New Discount
                    </Button>
                </Stack>
            </Stack>
            {renderTableView()}

            <DiscountFormModal open={openModal} onClose={handleCloseModal} onSubmit={handleSubmitForm} discount={editingDiscount} />
        </div>
    );
};

export default DiscountList;
