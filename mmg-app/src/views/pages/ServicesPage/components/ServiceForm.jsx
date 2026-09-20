import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
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
    Card,
    Chip,
    Box,
    IconButton,
    InputAdornment,
    Checkbox,
    FormControlLabel
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import service from 'api/service';
import category from 'api/category';

const ProductSchema = Yup.object().shape({
    name: Yup.string().required('Product name is required'),
    categoryId: Yup.string().required('Category is required'),
    price: Yup.number().required('Price is required').positive('Price must be positive')
});

const DESCRIPTION_MAX_LENGTH = 500;

// Static caption rendered above each field instead of MUI's default floating/animated label.
const FieldLabel = ({ children, required }) => (
    <Typography variant="body2" fontWeight={500} mb={0.5}>
        {children}
        {required && (
            <Box component="span" sx={{ color: 'warning.dark', ml: 0.3 }}>
                *
            </Box>
        )}
    </Typography>
);

// Small gray caption rendered below a field to explain its purpose/format.
const FieldHint = ({ children }) => (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {children}
    </Typography>
);

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

            const existingService = previousServices?.find((pkg) => pkg.name.toLowerCase() === newService.name.toLowerCase());

            if (existingService) {
                throw new Error('A service with this name already exists.');
            } else {
                if (!previousServices || previousServices.length === 0) {
                    queryClient.setQueryData('services', [newService]);
                } else {
                    queryClient.setQueryData('services', (old) => [...old, newService]);
                }
                return { previousServices };
            }
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
        onError: () => {
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

    const { data: categories } = useQuery('categories', () =>
        category.GetAllCategories().then((data) => data.filter((cat) => cat.isActive).sort((a, b) => a.name.localeCompare(b.name)))
    );

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
        navigate(-1);
    };

    const handleCloseDeleteDialog = () => {
        setDeleteDialogOpen(false);
    };

    const descriptionLength = watch('description')?.length || 0;

    return (
        <>
            <ToastContainer />
            <Card sx={{ p: { xs: 2.5, sm: 4 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5} flexWrap="wrap">
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <IconButton aria-label="back" onClick={handleBack} sx={{ mt: 0.5 }}>
                            <ArrowBackIcon />
                        </IconButton>
                        <Box>
                            <Typography variant="h2" fontWeight={600}>
                                {initialData ? 'Edit' : 'Create'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mt={0.5}>
                                Define standard lab test, diagnostic package, or billable medical supply.
                            </Typography>
                        </Box>
                    </Stack>
                    <Chip
                        size="small"
                        label="Catalog Item"
                        sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 500 }}
                    />
                </Stack>

                <Stack spacing={3} mt={3}>
                    <Controller
                        name="name"
                        control={control}
                        render={({ field }) => (
                            <Box>
                                <FieldLabel required>Product Name</FieldLabel>
                                <TextField
                                    {...field}
                                    placeholder="Product Name"
                                    variant="outlined"
                                    fullWidth
                                    error={Boolean(errors.name)}
                                    helperText={errors.name?.message}
                                />
                                {!errors.name && <FieldHint>e.g. Complete Blood Count (CBC) with Platelet Count or Lipid Profile</FieldHint>}
                            </Box>
                        )}
                    />

                    <Controller
                        name="description"
                        control={control}
                        render={({ field }) => (
                            <Box>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <FieldLabel>Description</FieldLabel>
                                    <Typography variant="caption" color="text.secondary">
                                        {descriptionLength} / {DESCRIPTION_MAX_LENGTH} characters
                                    </Typography>
                                </Stack>
                                <TextField
                                    {...field}
                                    placeholder="Description"
                                    multiline
                                    rows={4}
                                    variant="outlined"
                                    fullWidth
                                    inputProps={{ maxLength: DESCRIPTION_MAX_LENGTH }}
                                />
                            </Box>
                        )}
                    />

                    <Controller
                        name="categoryId"
                        control={control}
                        render={({ field }) => (
                            <Box>
                                <FieldLabel required>Category</FieldLabel>
                                <TextField
                                    select
                                    displayEmpty
                                    {...field}
                                    variant="outlined"
                                    fullWidth
                                    error={Boolean(errors.categoryId)}
                                    helperText={errors.categoryId?.message}
                                    onChange={(e) => {
                                        field.onChange(e);
                                        handleCategoryChange(e);
                                    }}
                                >
                                    <MenuItem value="" disabled>
                                        Category
                                    </MenuItem>
                                    {categories?.map((cat) => (
                                        <MenuItem key={cat?._id} value={cat?._id}>
                                            {cat.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Box>
                        )}
                    />

                    <FormControlLabel
                        control={<Checkbox checked={isNoPrice} onChange={(e) => setIsNoPrice(e.target.checked)} name="noPrice" />}
                        label={
                            <Typography variant="body2">
                                No Set Price?{' '}
                                <Typography component="span" variant="caption" color="text.secondary">
                                    (Variable, non-billable, or determined at checkout)
                                </Typography>
                            </Typography>
                        }
                    />

                    {!isNoPrice && (
                        <Controller
                            name="price"
                            control={control}
                            render={({ field }) => (
                                <Box>
                                    <FieldLabel>Price</FieldLabel>
                                    <TextField
                                        {...field}
                                        type="number"
                                        variant="outlined"
                                        fullWidth
                                        error={Boolean(errors.price) || field.value < 0}
                                        helperText={errors.price?.message || (field.value < 0 ? 'Price cannot be negative' : '')}
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start">₱</InputAdornment>
                                        }}
                                    />
                                    {!errors.price && field.value >= 0 && <FieldHint>Item base unit price in Philippine Peso (PHP).</FieldHint>}
                                </Box>
                            )}
                        />
                    )}

                    <Controller
                        name="sku"
                        control={control}
                        render={({ field }) => (
                            <Box>
                                <FieldLabel>SKU</FieldLabel>
                                <TextField
                                    {...field}
                                    placeholder="SKU"
                                    variant="outlined"
                                    fullWidth
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <LocalOfferOutlinedIcon fontSize="small" color="action" />
                                            </InputAdornment>
                                        )
                                    }}
                                />
                                <FieldHint>Unique identifier for laboratory inventory &amp; billing sync.</FieldHint>
                            </Box>
                        )}
                    />

                    <Stack direction="row" spacing={1.5}>
                        <Button variant="outlined" color="inherit" type="button" onClick={handleReset} disabled={isSubmitting}>
                            Reset
                        </Button>
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
            </Card>
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
        </>
    );
};

export default ServiceForm;
