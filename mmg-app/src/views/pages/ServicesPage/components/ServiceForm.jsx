import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import {
    TextField,
    Button,
    Stack,
    Typography,
    MenuItem,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Container,
    FormControlLabel,
    Checkbox
} from '@mui/material';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import MainCard from 'ui-component/cards/MainCard';
import service from 'api/service';
import category from 'api/category';

const ProductSchema = Yup.object().shape({
    name: Yup.string().required('Product name is required'),
    categoryId: Yup.string().required('Category is required'),
    price: Yup.number().required('Price is required').positive('Price must be positive'),
    // sku: Yup.string().required('SKU is required')
    // inventory_prerequisite: Yup.array().of(
    //     Yup.object().shape({
    //         id: Yup.string().required('SKU is required'),
    //         quantity: Yup.number().required('Quantity is required').positive('Quantity must be positive'),
    //     })
    // ).required('Inventory prerequisite is required').min(1, 'At least one prerequisite item is required'),
});

const ServiceForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        control,
        handleSubmit,
        formState: { errors },
        reset,
        watch,
        setValue
    } = useForm({
        resolver: yupResolver(ProductSchema),
        defaultValues: {
            name: '',
            description: '',
            price: 0,
            sku: '',
            categoryId: '',
            categoryName: '',
            inventoryPrerequisite: [{ id: '', quantity: 0 }],
            noPrice: false
        }
    });
    const { fields, append, remove } = useFieldArray({
        control,
        name: 'inventoryPrerequisite'
    });

    const [initialData, setInitialData] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedCategoryName, setSelectedCategoryName] = useState('');
    const [isNoPrice, setIsNoPrice] = useState(false);

    const queryClient = useQueryClient();

    const handleNavigation = () => {
        navigate('/dashboard/labtest');
    };

    const createServiceMutation = useMutation(service.CreateService, {
        onMutate: async (newService) => {
            await queryClient.cancelQueries('services');
            const previousServices = queryClient.getQueryData('services');

            const existingService = previousServices?.find(
                (pkg) => pkg.name.toLowerCase() === newService.name.toLowerCase()
            );

            if (existingService) {
                // If a package with the same name exists, throw an error
                throw new Error('A service with this name already exists.');
            } else {
                // If no duplicate found, proceed with creating the new package
                if (!previousServices || previousServices.length === 0) {
                    // If empty, proceed with creating the new service
                    queryClient.setQueryData('services', [newService]);
                } else {
                    // If not empty, append the new service to the existing list
                    queryClient.setQueryData('services', (old) => [...old, newService]);
                }

                return { previousServices };
            }

            // if (!previousServices || previousServices.length === 0) {
            //     queryClient.setQueryData('services', [newService]);
            // } else {
            //     queryClient.setQueryData('services', (old) => [...old, newService]);
            // }

            // return { previousServices };
        },
        onError: (err) => {
            if (err.message === 'A service with this name already exists.') {
                toast.error('A service with this name already exists.');
            } else {
                toast.error('An error occurred while creating the service.');
            }
        },
        onSuccess: () => {
            toast.success('Service created successfully.', {
                autoClose: 1500,
                onClose: handleNavigation
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries('services');
        }
    });

    const editServiceMutation = useMutation(service.EditService, {
        onMutate: async (updatedService) => {
            await queryClient.cancelQueries('services');
            const previousServices = queryClient.getQueryData('services');

            queryClient.setQueryData('services', (old) => old?.map((cat) => (cat._id === updatedService._id ? updatedService : cat)));
            return { previousServices };
        },
        onError: (err) => {
            toast.error('An error occurred while updating the service.');
        },
        onSuccess: () => {
            toast.success('Lab Test edited successfully.', {
                autoClose: 1500,
                onClose: handleNavigation
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries('services');
        }
    });

    const { data: categories } = useQuery('categories', () => category.GetAllCategories().then(data => data.filter(cat => cat.isActive).sort((a, b) => a.name.localeCompare(b.name))));

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const encodedProduct = queryParams.get('product');
        if (encodedProduct) {
            const decodedProduct = JSON.parse(decodeURIComponent(encodedProduct));
            setInitialData(decodedProduct);
        }
    }, [location.search]);

    useEffect(() => {
        if (initialData) {
            reset(initialData);
            const selectedCategory = categories?.find((cat) => cat._id === initialData.categoryId);
            setSelectedCategoryName(selectedCategory ? selectedCategory.name : '');
            setValue('categoryName', selectedCategory ? selectedCategory.name : '');
            setIsNoPrice(initialData.no_price !== null ? initialData.no_price : false);
        }
    }, [initialData, reset, categories, setValue]);

    const handleCategoryChange = (event) => {
        const selectedCategoryId = event.target.value;
        const selectedCategory = categories?.find((cat) => cat._id === selectedCategoryId);
        setSelectedCategoryName(selectedCategory ? selectedCategory.name : '');
        setValue('categoryName', selectedCategory ? selectedCategory.name : '');
    };

    const handleFormSubmit = async (data) => {
        setIsSubmitting(true);
        const transformedData = { ...data, id: data?._id, noPrice: isNoPrice };
        delete transformedData.no_price;
        console.log('data', transformedData);
        try {
            if (initialData) {
                await editServiceMutation.mutateAsync(transformedData);
            } else {
                await createServiceMutation.mutateAsync(data);
            }
        } catch (error) {
            console.error('Error submitting form:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReset = () => {
        reset({
            name: '',
            description: '',
            price: 0,
            sku: '',
            categoryId: '',
            categoryName: '',
            inventoryPrerequisite: [{ id: '', quantity: 1 }],
            noPrice: false
        });
        setSelectedCategoryName('');
        setIsNoPrice(false);
    };

    const handleBack = () => {
        navigate(-1);
    };

    const handleDelete = () => {
        console.log('Product deleted:', initialData);
        navigate(-1);
    };

    const handleOpenDeleteDialog = () => {
        setDeleteDialogOpen(true);
    };

    const handleCloseDeleteDialog = () => {
        setDeleteDialogOpen(false);
    };

    return (
        <Container maxWidth="md">
            <MainCard title={initialData ? 'Edit' : 'Create'} onBack={handleBack}>
                <ToastContainer />
                <Stack direction="column" justifyContent="start" alignItems="start" spacing={2} mb={3}>
                    <Controller
                        name="name"
                        control={control}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                label="Product Name"
                                variant="outlined"
                                fullWidth
                                error={Boolean(errors.name)}
                                helperText={errors.name?.message}
                            />
                        )}
                    />
                    <Controller
                        name="description"
                        control={control}
                        render={({ field }) => <TextField {...field} label="Description" multiline rows={4} variant="outlined" fullWidth />}
                    />
                    <Controller
                        name="categoryId"
                        control={control}
                        render={({ field }) => (
                            <TextField
                                select
                                {...field}
                                label="Category"
                                variant="outlined"
                                fullWidth
                                error={Boolean(errors.categoryId)}
                                helperText={errors.categoryId?.message}
                                onChange={(e) => {
                                    field.onChange(e);
                                    handleCategoryChange(e);
                                }}
                            >
                                {categories?.map((category) => (
                                    <MenuItem key={category?._id} value={category?._id}>
                                        {category.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                        )}
                    />
                    <FormControlLabel
                        control={<Checkbox checked={isNoPrice} onChange={(e) => setIsNoPrice(e.target.checked)} name="noPrice" />}
                        label="No Set Price?"
                    />

                    {!isNoPrice && (
                        <Controller
                            name="price"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Price"
                                    type="number"
                                    variant="outlined"
                                    fullWidth
                                    error={Boolean(errors.price) || field.value < 0} // Check for negative price
                                    helperText={errors.price?.message || (field.value < 0 ? 'Price cannot be negative' : '')} // Display error message
                                />
                            )}
                        />
                    )}
                    <Controller
                        name="sku"
                        control={control}
                        render={({ field }) => <TextField {...field} label="SKU" variant="outlined" fullWidth />}
                    />
                    {/* Uncomment in invetory implementation */}
                    {/* <div>
                        <Typography variant='h4' mb={2}>Inventory Prerequisite</Typography>
                        {fields.map((field, index) => (
                            <Stack key={field.id} direction="row" justifyContent="center" alignItems="center" spacing={2} mb={2}>
                                <Controller
                                    name={`inventoryPrerequisite.${index}.id`}
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            label="ID"
                                            variant="outlined"
                                            fullWidth
                                            error={Boolean(errors.inventoryPrerequisite?.[index]?.id)}
                                            helperText={errors.inventoryPrerequisite?.[index]?.id?.message}
                                        />
                                    )}
                                />
                                <Controller
                                    name={`inventoryPrerequisite.${index}.quantity`}
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            label="Quantity"
                                            type="number"
                                            variant="outlined"
                                            fullWidth
                                            error={Boolean(errors.inventoryPrerequisite?.[index]?.quantity)}
                                            helperText={errors.inventoryPrerequisite?.[index]?.quantity?.message}
                                        />
                                    )}
                                />
                                <Button type="button" onClick={() => remove(index)}>Remove</Button>
                            </Stack>
                        ))}
                        <Button type="button" onClick={() => append({ id: '', quantity: 1 })}>Add Prerequisite Item</Button>
                    </div> */}
                    <Stack direction="row" spacing={1}>
                        <Button variant="outlined" color="secondary" type="button" onClick={handleReset}>
                            Reset
                        </Button>
                        {/* {initialData && (
                            <Button variant="outlined" color="error" type="button" onClick={handleOpenDeleteDialog}>
                                Delete
                            </Button>
                        )} */}
                        <Button
                            variant="contained"
                            color="primary"
                            type="submit"
                            onClick={handleSubmit(handleFormSubmit)}
                            disabled={isSubmitting}
                        >
                            Save
                        </Button>
                    </Stack>
                </Stack>
                <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
                    <DialogTitle>Confirm Delete</DialogTitle>
                    <DialogContent>
                        <DialogContentText>Are you sure you want to delete this product?</DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDeleteDialog} color="primary">
                            Cancel
                        </Button>
                        <Button onClick={handleDelete} color="error">
                            Delete
                        </Button>
                    </DialogActions>
                </Dialog>
            </MainCard>
        </Container>
    );
};

export default ServiceForm;
