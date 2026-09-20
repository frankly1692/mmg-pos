import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import {
    Box,
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
    Autocomplete,
    CircularProgress,
    Checkbox,
    Grid,
    Card,
    Chip,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckIcon from '@mui/icons-material/Check';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import service from 'api/service';
import discount from 'api/discount';
import packageapi from 'api/package';

const ProductSchema = Yup.object().shape({
    name: Yup.string().required('Package name is required'),
    packageType: Yup.string().required('Type is required'),
    packageForMemberType: Yup.string().required('Member type is required'),
    labTest: Yup.array()
        .of(
            Yup.object().shape({
                _id: Yup.string().required('Lab test is required'),
                price: Yup.number().required('Price is required').positive('Price must be positive')
            })
        )
        .required('Lab test is required')
        .min(1, 'At least one lab test item is required')
});

// Static caption rendered above each field instead of MUI's default floating/animated label.
const FieldLabel = ({ children, required, optional }) => (
    <Typography variant="body2" fontWeight={500} mb={0.5}>
        {children}
        {required && (
            <Box component="span" sx={{ color: 'warning.dark', ml: 0.3 }}>
                *
            </Box>
        )}
        {optional && (
            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400, fontSize: '0.75rem', ml: 0.5 }}>
                (Optional)
            </Box>
        )}
    </Typography>
);

const formatCurrency = (value) =>
    `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SummaryBox = ({ label, value, highlight }) => (
    <Box
        sx={{
            p: 2,
            borderRadius: 1.5,
            textAlign: 'center',
            bgcolor: highlight ? 'primary.lighter' : 'grey.50',
            border: '1px solid',
            borderColor: highlight ? 'primary.light' : 'divider'
        }}
    >
        <Typography variant="h4" fontWeight={700} color={highlight ? 'primary.dark' : 'text.primary'}>
            {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
            {label}
        </Typography>
    </Box>
);

const PackageForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        control,
        handleSubmit,
        setValue,
        formState: { errors },
        reset
    } = useForm({
        resolver: yupResolver(ProductSchema),
        defaultValues: {
            name: '',
            description: '',
            discount: 0,
            packageType: '',
            packageForMemberType: '',
            discountType: 'perItem',
            labTest: []
        }
    });
    const { fields, append, remove } = useFieldArray({
        control,
        name: 'labTest'
    });

    const [initialData, setInitialData] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedLabTests, setSelectedLabTests] = useState([]);
    const [discounts, setDiscounts] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isServicesLoading, setServicesLoading] = useState(true);
    const [selectedDiscount, setSelectedDiscount] = useState(null);

    const queryClient = useQueryClient();

    const handleNavigation = () => {
        navigate('/dashboard/packages');
    };

    useEffect(() => {
        const fetchDiscounts = async () => {
            try {
                const response = await discount.GetAllDiscounts();
                setDiscounts(response);
                setIsLoading(false);
            } catch (error) {
                console.error('Error fetching discounts:', error);
            }
        };

        fetchDiscounts();
    }, []);

    const { data: services } = useQuery('services', service.GetAllServices, {
        onSuccess: () => setServicesLoading(false),
        onError: () => setServicesLoading(false)
    });

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const encodedProduct = queryParams.get('product');
        if (encodedProduct) {
            const decodedProduct = JSON.parse(encodedProduct);
            setInitialData(decodedProduct);
        }
    }, [location.search]);

    useEffect(() => {
        if (initialData) {
            // Find the discount object from the discounts array
            setSelectedDiscount(initialData.discount);
            setValue('discount', initialData.discount); // Set the discount field in the form

            // Initialize the fields array with lab tests from initialData
            const labTests = initialData.labTest || [];
            if (labTests.length > 0) {
                // Check if labTests is not empty
                labTests.forEach((labTest) => {
                    append({
                        _id: labTest._id,
                        name: labTest.name,
                        price: labTest.price,
                        excludeFromDiscount: labTest.excludeFromDiscount
                    });
                });
                setSelectedLabTests(labTests); // Initialize selectedLabTests
            }
            reset(initialData);
        }
    }, [initialData, reset, append]);

    const createPackageMutation = useMutation(packageapi.CreatePackage, {
        onMutate: async (newPackage) => {
            await queryClient.cancelQueries('packages');
            const previousPackages = queryClient.getQueryData('packages');

            // Check if a package with the same name already exists
            const existingPackage = previousPackages?.find((pkg) => pkg.name.toLowerCase() === newPackage.name.toLowerCase());

            if (existingPackage) {
                // If a package with the same name exists, throw an error
                throw new Error('A package with this name already exists.');
            } else {
                // If no duplicate found, proceed with creating the new package
                if (!previousPackages || previousPackages.length === 0) {
                    // If empty, proceed with creating the new service
                    queryClient.setQueryData('packages', [newPackage]);
                } else {
                    // If not empty, append the new service to the existing list
                    queryClient.setQueryData('packages', (old) => [...old, newPackage]);
                }

                return { previousPackages };
            }
        },
        onError: (err) => {
            if (err.message === 'A package with this name already exists.') {
                toast.error('A package with this name already exists.');
            } else {
                toast.error('An error occurred while creating the package.');
            }
        },
        onSuccess: () => {
            toast.success('Package created successfully.', {
                autoClose: 1500,
                onClose: handleNavigation
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries('packages');
        }
    });

    const editPackageMutation = useMutation(packageapi.EditPackage, {
        onMutate: async (updatedPackage) => {
            await queryClient.cancelQueries('packages');
            const previousPackages = queryClient.getQueryData('packages');

            queryClient.setQueryData('packages', (old) => old?.map((cat) => (cat._id === updatedPackage.id ? updatedPackage : cat)));
            return { previousPackages };
        },
        onError: () => {
            toast.error('An error occurred while updating the package.');
        },
        onSuccess: () => {
            toast.success('Service edited successfully.', {
                autoClose: 1500,
                onClose: handleNavigation
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries('packages');
        }
    });

    const handleFormSubmit = async (data) => {
        setIsSubmitting(true);

        const newData = {
            ...data,
            labTest: selectedLabTests,
            totalPackagePrice: selectedLabTests.reduce((total, test) => total + (test?.price || 0), 0),
            totalDiscountedPrice: calculateTotalPrice()
        };

        try {
            if (initialData) {
                const { _id, ...rest } = newData;
                const transformedData = { id: _id, ...rest };
                await editPackageMutation.mutateAsync(transformedData);
            } else {
                await createPackageMutation.mutateAsync(newData);
            }
        } catch (error) {
            console.error('Error submitting form:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInvalidSubmit = (formErrors) => {
        const firstMessage =
            formErrors.name?.message ||
            formErrors.packageType?.message ||
            formErrors.packageForMemberType?.message ||
            (!Array.isArray(formErrors.labTest) && formErrors.labTest?.message) ||
            'Please fix the highlighted fields before saving.';
        toast.error(firstMessage);
    };

    const handleReset = () => {
        reset({
            name: '',
            description: '',
            discount: 0,
            discountType: 'perItem',
            packageType: '',
            packageForMemberType: '',
            labTest: []
        });
        setSelectedDiscount(null);
        setSelectedLabTests([]);
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

    const handleLabTestChange = (index, labTest) => {
        if (labTest) {
            // Update the id, name, and price fields
            setValue(`labTest.${index}._id`, labTest._id);
            setValue(`labTest.${index}.name`, labTest.name);
            setValue(`labTest.${index}.price`, labTest.price);
            setValue(`labTest.${index}.excludeFromDiscount`, labTest.excludeFromDiscount);

            const newData = {
                ...labTest,
                excludeFromDiscount: false
            };

            setSelectedLabTests((prev) => {
                const newSelected = [...prev];
                newSelected[index] = newData;
                return newSelected;
            });
        }
    };

    const handleRemoveLabTest = (index) => {
        setSelectedLabTests((prev) => {
            const newSelected = [...prev];
            newSelected.splice(index, 1);
            return newSelected;
        });
        remove(index);
    };

    const handleLabTestCBChange = (index, updatedData) => {
        setSelectedLabTests((prev) => {
            const newSelected = [...prev];
            newSelected[index] = updatedData ? { ...updatedData, excludeFromDiscount: updatedData.excludeFromDiscount || false } : null;
            return newSelected;
        });
    };

    // Calculate total price with discount applied
    const calculateTotalPrice = () => {
        // Filter out items excluded from the discount
        const discountableItems = selectedLabTests.filter((test) => !test?.excludeFromDiscount);

        // Calculate the price of ONLY the discountable items
        const discountedPrice = discountableItems.reduce((total, test) => total + (test?.price || 0), 0);

        // Calculate the discount to be applied
        let discountAmount = 0;

        if (selectedDiscount && selectedDiscount?.type === 'percentage') {
            discountAmount = discountedPrice * (selectedDiscount.value / 100);
        } else if (selectedDiscount?.type === 'fixed') {
            discountAmount = selectedDiscount.value;
        }

        // Calculate the price of the excluded items
        const excludedItemsPrice = selectedLabTests
            .filter((test) => test?.excludeFromDiscount)
            .reduce((total, test) => total + (test?.price || 0), 0);

        // Calculate and return the final total price
        return discountedPrice - discountAmount + excludedItemsPrice;
    };

    if (isLoading || isServicesLoading) return <CircularProgress />;

    const totalValue = selectedLabTests.reduce((total, test) => total + (test?.price || 0), 0);
    const totalWithDiscount = calculateTotalPrice();
    const discountAmount = totalValue - totalWithDiscount;
    const discountRateLabel =
        selectedDiscount?.type === 'percentage' ? ` (${selectedDiscount.value}%)` : selectedDiscount ? ' (Fixed)' : '';
    const selectedCount = selectedLabTests.filter((test) => test?._id).length;

    return (
        <>
            <ToastContainer />
            <Card sx={{ p: { xs: 2.5, sm: 4 } }}>
                {/* Header */}
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <IconButton aria-label="back" onClick={handleBack} sx={{ mt: 0.5 }}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Box>
                        <Typography variant="h2" fontWeight={600}>
                            {initialData ? 'Edit Package / Promo' : 'Create Package / Promo'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mt={0.5}>
                            Configure clinical bundles, custom tariffs, and member eligibility
                        </Typography>
                    </Box>
                </Stack>

                <Stack spacing={3} mt={3}>
                    <Controller
                        name="name"
                        control={control}
                        render={({ field }) => (
                            <Box>
                                <FieldLabel required>Package / Promo Name</FieldLabel>
                                <TextField
                                    {...field}
                                    placeholder="e.g. Comprehensive Executive Wellness Panel"
                                    variant="outlined"
                                    fullWidth
                                    error={Boolean(errors.name)}
                                    helperText={errors.name?.message}
                                />
                            </Box>
                        )}
                    />

                    <Controller
                        name="description"
                        control={control}
                        render={({ field }) => (
                            <Box>
                                <FieldLabel optional>Description</FieldLabel>
                                <TextField
                                    {...field}
                                    placeholder="Describe what this package covers, any prerequisites, and fasting instructions"
                                    multiline
                                    rows={3}
                                    variant="outlined"
                                    fullWidth
                                />
                            </Box>
                        )}
                    />

                    {/* Wrapped in a Box (not a direct Stack child) — Stack's own child-margin reset
                        would otherwise strip Grid's negative gutter margin and misalign it. */}
                    <Box>
                    <Grid container spacing={3}>
                        <Grid item xs={12} sm={6}>
                            <Controller
                                name="packageType"
                                control={control}
                                render={({ field }) => (
                                    <Box>
                                        <FieldLabel required>Type</FieldLabel>
                                        <TextField
                                            select
                                            {...field}
                                            variant="outlined"
                                            fullWidth
                                            value={field.value || ''}
                                            error={Boolean(errors.packageType)}
                                            helperText={errors.packageType?.message}
                                        >
                                            <MenuItem value="promo">Promo</MenuItem>
                                            <MenuItem value="package">Package</MenuItem>
                                        </TextField>
                                    </Box>
                                )}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Controller
                                name="discount"
                                control={control}
                                render={({ field }) => (
                                    <Box>
                                        <FieldLabel optional>Select Discount</FieldLabel>
                                        <Autocomplete
                                            options={discounts || []}
                                            getOptionLabel={(d) =>
                                                d ? `${d?.name} (${d?.type === 'percentage' ? d?.value + '%' : d?.value})` : ''
                                            }
                                            value={field.value || null}
                                            onChange={(event, newValue) => {
                                                setValue('discount', newValue);
                                                setSelectedDiscount(newValue);
                                            }}
                                            renderInput={(params) => <TextField {...params} variant="outlined" fullWidth />}
                                        />
                                    </Box>
                                )}
                            />
                        </Grid>
                    </Grid>
                    </Box>

                    <Controller
                        name="packageForMemberType"
                        control={control}
                        render={({ field }) => (
                            <Box>
                                <FieldLabel required>Applied to Member Type</FieldLabel>
                                <TextField
                                    {...field}
                                    select
                                    fullWidth
                                    value={field.value || ''}
                                    variant="outlined"
                                    error={Boolean(errors.packageForMemberType)}
                                    helperText={errors.packageForMemberType?.message}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="non-member">Non-member</MenuItem>
                                    <MenuItem value="member">Member</MenuItem>
                                    <MenuItem value="seniorcitizenpwd">Senior Citizen/PWD</MenuItem>
                                    <MenuItem value="officer-bod">Officer BOD</MenuItem>
                                    <MenuItem value="officer-gm">Officer GM</MenuItem>
                                    <MenuItem value="officer-treasurer">Officer Treasurer</MenuItem>
                                    <MenuItem value="officer-committer-officers">Officer Committee Officers</MenuItem>
                                    <MenuItem value="associate-member">Associate Member</MenuItem>
                                    <MenuItem value="corporate">Corporate</MenuItem>
                                </TextField>
                            </Box>
                        )}
                    />

                    {/* Lab Tests Included */}
                    <Box>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} mb={1.5}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="subtitle1" fontWeight={600}>
                                    Lab Tests Included
                                </Typography>
                                <Chip
                                    size="small"
                                    label={`${selectedCount} Selected`}
                                    sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 500 }}
                                />
                            </Stack>
                            <Button
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() => append({ _id: '', name: '', price: '' })}
                            >
                                Add Lab Test
                            </Button>
                        </Stack>

                        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>Code</TableCell>
                                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>
                                            Test Description
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>Section</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>
                                            Standard Fee
                                        </TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>
                                            Exclude Discount
                                        </TableCell>
                                        <TableCell align="center" sx={{ width: 48 }} />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {fields.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6}>
                                                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                                                    No lab tests added yet — click "Add Lab Test" to build this package.
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {fields.map((field, index) => {
                                        const test = selectedLabTests[index];

                                        if (!test?._id) {
                                            return (
                                                <TableRow key={field.id}>
                                                    <TableCell colSpan={5}>
                                                        <Autocomplete
                                                            options={services || []}
                                                            getOptionLabel={(option) => option.name}
                                                            value={null}
                                                            onChange={(event, newValue) => handleLabTestChange(index, newValue)}
                                                            renderInput={(params) => (
                                                                <TextField
                                                                    {...params}
                                                                    placeholder="Select a lab test..."
                                                                    variant="outlined"
                                                                    size="small"
                                                                    error={Boolean(errors.labTest?.[index]?._id)}
                                                                    helperText={errors.labTest?.[index]?._id?.message}
                                                                />
                                                            )}
                                                            disableClearable
                                                            filterOptions={(options, { inputValue }) => {
                                                                const existingIds = selectedLabTests?.map((item) => item?._id) || [];
                                                                return options.filter(
                                                                    (option) =>
                                                                        !existingIds.includes(option._id) &&
                                                                        option.name.toLowerCase().includes(inputValue.toLowerCase())
                                                                );
                                                            }}
                                                            filterSelectedOptions
                                                        />
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <IconButton size="small" onClick={() => handleRemoveLabTest(index)}>
                                                            <DeleteOutlineIcon fontSize="small" />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }

                                        return (
                                            <TableRow key={field.id} sx={{ bgcolor: test.excludeFromDiscount ? 'primary.lighter' : 'inherit' }}>
                                                <TableCell>{test.sku || '—'}</TableCell>
                                                <TableCell>{test.name}</TableCell>
                                                <TableCell>{test.category?.name || '—'}</TableCell>
                                                <TableCell align="right">{formatCurrency(test.price)}</TableCell>
                                                <TableCell align="center">
                                                    <Controller
                                                        name={`labTest.${index}.excludeFromDiscount`}
                                                        control={control}
                                                        render={({ field: cbField }) => (
                                                            <Checkbox
                                                                checked={cbField.value || false}
                                                                onChange={(e) => {
                                                                    cbField.onChange(e.target.checked);
                                                                    handleLabTestCBChange(index, {
                                                                        ...selectedLabTests[index],
                                                                        excludeFromDiscount: e.target.checked
                                                                    });
                                                                }}
                                                            />
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell align="center">
                                                    <IconButton size="small" onClick={() => handleRemoveLabTest(index)}>
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        {!Array.isArray(errors.labTest) && errors.labTest?.message && (
                            <Typography color="error" variant="body2" mt={1}>
                                {errors.labTest.message}
                            </Typography>
                        )}
                    </Box>

                    {/* Summary */}
                    <Box>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                            <SummaryBox label="Total Test Value" value={formatCurrency(totalValue)} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <SummaryBox label={`Discount Applied${discountRateLabel}`} value={`- ${formatCurrency(discountAmount)}`} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <SummaryBox label="Total w/ Discount" value={formatCurrency(totalWithDiscount)} highlight />
                        </Grid>
                    </Grid>
                    </Box>

                    {/* Footer actions */}
                    <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                        <Button variant="outlined" color="inherit" type="button" onClick={handleReset} disabled={isSubmitting}>
                            Reset
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            type="submit"
                            startIcon={<CheckIcon />}
                            onClick={handleSubmit(handleFormSubmit, handleInvalidSubmit)}
                            disabled={isSubmitting}
                        >
                            {initialData ? 'Update Package' : 'Save & Apply Package'}
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

export default PackageForm;
