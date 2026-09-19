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
    Container,
    CircularProgress,
    FormControl,
    FormLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
    Checkbox,
    Grid,
    styled,
    Paper
} from '@mui/material';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import MainCard from 'ui-component/cards/MainCard';
import service from 'api/service';
import discount from 'api/discount';
import packageapi from 'api/package';

const Item = styled(Paper)(({ theme }) => ({
    backgroundColor: '#e7e7e7',
    ...theme.typography.body2,
    padding: theme.spacing(1),
    textAlign: 'center',
    color: '#015200',
    ...theme.applyStyles('dark', {
        backgroundColor: '#1A2027',
    }),
}));

const ProductSchema = Yup.object().shape({
    name: Yup.string().required('Package name is required'),
    packageType: Yup.string().required('Type is required'),
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
    const [labTests, setLabTests] = useState([]);
    const [selectedLabTests, setSelectedLabTests] = useState([]);
    const [discounts, setDiscounts] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isServicesLoading, setServicesLoading] = useState(true);
    const [selectedDiscount, setSelectedDiscount] = useState(null);
    const [totalPrice, setTotalPrice] = useState(0);
    const [totalDiscountedPrice, setTotalDiscountedPrice] = useState(0);

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

    const {
        data: services,
        isLoading: servicesLoading,
        error: servicesError
    } = useQuery('services', service.GetAllServices, {
        onSuccess: () => {
            setServicesLoading(false); // Set services loading to false on success
        },
        onError: () => {
            setServicesLoading(false); // Set services loading to false on error
        }
    });

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const encodedProduct = queryParams.get('product');
        console.log('encodedProduct', encodedProduct);
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
                labTests.forEach((labTest, index) => {
                    append({
                        _id: labTest._id,
                        name: labTest.name,
                        price: labTest.price,
                        excludeFromDiscount: labTest.excludeFromDiscount
                    });
                });
                setSelectedLabTests(labTests); // Initialize selectedLabTests
            } else {
                // If labTests is empty, add a default lab test
                append({
                    _id: '',
                    name: '',
                    price: 0,
                    excludeFromDiscount: false
                });
            }
            reset(initialData);
        }
    }, [initialData, reset, append]);


    const createPackageMutation = useMutation(packageapi.CreatePackage, {
        onMutate: async (newPackage) => {
            await queryClient.cancelQueries('packages');
            const previousPackages = queryClient.getQueryData('packages');

            // Check if a package with the same name already exists
            const existingPackage = previousPackages?.find(
                (pkg) => pkg.name.toLowerCase() === newPackage.name.toLowerCase()
            );

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
            // queryClient.setQueryData('packages', context.previousPackages);
            // Display the specific error message
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
        onError: (err) => {
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

    // useEffect(() => {
    //     const queryParams = new URLSearchParams(location.search);
    //     const encodedProduct = queryParams.get('product');
    //     if (encodedProduct) {
    //         const decodedProduct = JSON.parse(decodeURIComponent(encodedProduct));
    //         setInitialData(decodedProduct);
    //     }
    // }, [location.search]);

    useEffect(() => {
        if (initialData) {
            reset(initialData);
        }
    }, [initialData, reset]);

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
            labTest: [{ id: '', price: 0 }]
        });
        setSelectedLabTests([]);
    };

    const handleBack = () => {
        navigate(-1);
        console.log('Back button clicked!');
    };

    const handleDelete = () => {
        // Implement your delete logic here
        console.log('Product deleted:', initialData);
        // Navigate back after deletion
        navigate(-1);
    };

    const handleOpenDeleteDialog = () => {
        setDeleteDialogOpen(true);
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
            // Update the selected lab tests

            const newData = {
                ...labTest,
                excludeFromDiscount: false
            };

            setSelectedLabTests((prev) => {
                const newSelected = [...prev];
                newSelected[index] = newData;
                return newSelected;
            });
        } else {
            // Reset the lab test fields
            setValue(`labTest.${index}._id`, '');
            setValue(`labTest.${index}.name`, '');
            setValue(`labTest.${index}.price`, 0);
            setValue(`labTest.${index}.excludeFromDiscount`, false);
            // Update the selected lab tests
            setSelectedLabTests((prev) => {
                const newSelected = [...prev];
                newSelected[index] = null;
                return newSelected;
            });
        }
    };

    const handleRemoveLabTest = (index) => {
        // Remove the lab test from the selectedLabTests array
        setSelectedLabTests((prev) => {
            const newSelected = [...prev];
            newSelected.splice(index, 1);
            return newSelected;
        });
        // Remove the lab test from the fields array
        remove(index);
    };

    const handleLabTestCBChange = (index, updatedData) => {
        setSelectedLabTests((prev) => {
            const newSelected = [...prev];
            newSelected[index] = updatedData
                ? { ...updatedData, excludeFromDiscount: updatedData.excludeFromDiscount || false }
                : null;
            return newSelected;
        });
    };

    // Calculate total price with discount applied
    const calculateTotalPrice = () => {
        console.log('selectedLabTests', selectedLabTests)
        // console.log('selectedDiscount', selectedDiscount)

        // Filter out items excluded from the discount
        const discountableItems = selectedLabTests.filter(
            (test) => !test?.excludeFromDiscount
        );

        // Calculate the price of ONLY the discountable items
        const discountedPrice = discountableItems.reduce((total, test) => total + (test?.price || 0), 0);

        // Calculate the discount to be applied
        let discountAmount = 0;

        console.log('discountedPrice', discountedPrice, discountAmount)

        if (selectedDiscount && selectedDiscount?.type === 'percentage') {
            discountAmount = discountedPrice * (selectedDiscount.value / 100);
        } else if (selectedDiscount?.type === 'fixed') {
            discountAmount = selectedDiscount.value;
        }

        // Calculate the price of the excluded items
        const excludedItemsPrice = selectedLabTests.filter((test) => test?.excludeFromDiscount)
            .reduce((total, test) => total + (test?.price || 0), 0);


        console.log('selectedLabTestsxxxx', discountedPrice, discountAmount, excludedItemsPrice)
        // setDiscountAmount(discountAmount);

        // Calculate and return the final total price
        const finalTotalPrice = (discountedPrice - discountAmount) + excludedItemsPrice;
        return finalTotalPrice;
        // setTotalDiscountedPrice(finalTotalPrice);
    };

    console.log('initialData', initialData)

    if (isLoading || isServicesLoading) return <CircularProgress />;

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
                                label="Package/Promo Name"
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
                        name="packageType"
                        control={control}
                        render={({ field }) => (
                            <TextField
                                select
                                {...field}
                                label="Type"
                                variant="outlined"
                                fullWidth
                                value={field.value || ''}
                                error={Boolean(errors.packageType)}
                                helperText={errors.packageType?.message}
                            >
                                <MenuItem value="promo">Promo</MenuItem>
                                <MenuItem value="package">Package</MenuItem>
                            </TextField>
                        )}
                    />
                    {/* <FormControl component="fieldset">
                        <FormLabel component="legend">For</FormLabel>
                        <Controller
                            control={control}
                            name="packageForMemberType"
                            render={({ field: { value, onChange } }) => (
                                <RadioGroup value={value} onChange={onChange} row>
                                    <FormControlLabel value="non-member" control={<Radio />} label="Non-Member" />
                                    <FormControlLabel value="member" control={<Radio />} label="Member" />
                                    <FormControlLabel value="corporate" control={<Radio />} label="Corporate" />
                                    <FormControlLabel value="bothNonMemberAndMember" control={<Radio />} label="Both Non-member and Member" />
                                </RadioGroup>
                            )}
                        />
                    </FormControl> */}
                    <Controller
                        name="packageForMemberType" // Make sure this matches your form field name
                        control={control}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                select
                                label="Applied to Member Type"
                                fullWidth
                                value={field.value || ''}
                                variant="outlined"
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
                        )}
                    />
                    <Controller
                        name="discount"
                        control={control}
                        render={({ field }) => (
                            <Autocomplete
                                options={discounts} // Use discounts state for options
                                getOptionLabel={(discount) => `${discount?.name} (${discount?.type === 'percentage' ? discount?.value : discount?.value})`} // Customize label display
                                value={field.value || null}
                                onChange={(event, newValue) => {
                                    setValue('discount', newValue);
                                    setSelectedDiscount(newValue); // Update the selectedDiscount state
                                }}
                                sx={{ width: '100%' }}
                                renderInput={(params) => <TextField {...params} label="Select Discount" variant="outlined" fullWidth />}
                            />
                        )}
                    />
                    <div>
                        <Typography variant="h4" mb={2}>
                            Lab Test
                        </Typography>
                        {fields.map((field, index) => (
                            <Stack key={field.id} direction="row" justifyContent="center" alignItems="center" spacing={2} mb={2}>
                                <Autocomplete
                                    options={services}
                                    getOptionLabel={(option) => option.name}
                                    value={selectedLabTests[index] || null}
                                    onChange={(event, newValue) => handleLabTestChange(index, newValue)}
                                    sx={{ width: 500 }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Select Lab Test"
                                            variant="outlined"
                                            error={Boolean(errors.labTest?.[index]?._id)}
                                            helperText={errors.labTest?.[index]?._id?.message}
                                        />
                                    )}
                                    disableClearable
                                    filterOptions={(options, { inputValue }) => {
                                        const existingIds = selectedLabTests?.map((item) => item?._id) || [];
                                        return options.filter((option) => (
                                            !existingIds.includes(option._id) &&
                                            option.name.toLowerCase().includes(inputValue.toLowerCase())
                                        ));
                                    }}
                                    filterSelectedOptions
                                />
                                <Controller
                                    name={`labTest.${index}.price`}
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            label="Price"
                                            type="number"
                                            variant="outlined"
                                            fullWidth
                                            disabled
                                            error={Boolean(errors.labTest?.[index]?.price)}
                                            helperText={errors.labTest?.[index]?.price?.message}
                                        />
                                    )}
                                />
                                {/* Checkbox to exclude from discount */}
                                <FormControlLabel
                                    control={
                                        <Controller
                                            name={`labTest.${index}.excludeFromDiscount`}
                                            control={control}
                                            render={({ field }) => (
                                                <Checkbox
                                                    {...field}
                                                    fullWidth
                                                    checked={field.value || false}
                                                    onChange={(e) => {
                                                        field.onChange(e.target.checked); // Update form value
                                                        handleLabTestCBChange(index, { // Update selectedLabTests
                                                            ...selectedLabTests[index],
                                                            excludeFromDiscount: e.target.checked
                                                        });
                                                    }}
                                                />
                                            )}
                                        />
                                    }
                                    label="Exclude from Discount"
                                />
                                <Button type="button" onClick={() => handleRemoveLabTest(index)}>
                                    Remove
                                </Button>
                            </Stack>
                        ))}
                        <Button type="button" onClick={() => append({ id: '', name: '', price: '' })}>
                            Add Lab Test
                        </Button>
                        {!Array.isArray(errors.labTest) && errors.labTest?.message && (
                            <Typography color="error" variant="body2" mt={1}>
                                {errors.labTest.message}
                            </Typography>
                        )}
                    </div>

                    <Box sx={{ width: '100%' }}>
                        <Grid container spacing={3}>
                            <Grid item xs={4}>
                                <Item>
                                    <Typography variant="h3">
                                        {selectedLabTests.reduce((total, test) => total + (test?.price || 0), 0)}
                                    </Typography>
                                    <Typography variant='subtitle1'>
                                        Total
                                    </Typography>
                                </Item>
                            </Grid>
                            <Grid item xs={4}>
                                <Item>
                                    <Typography variant="h3">
                                        {calculateTotalPrice()}
                                    </Typography>
                                    <Typography variant='subtitle1'>
                                        Total w/ Discount
                                    </Typography>
                                </Item>
                            </Grid>
                            <Grid item xs={4}>
                                <Item>
                                    <Typography variant="h3">
                                        {
                                            selectedDiscount && selectedDiscount?.type === 'percentage'
                                                ? `${selectedDiscount.value} %`
                                                : selectedDiscount?.value || 0 // Add "|| 0" here
                                        }
                                    </Typography>
                                    <Typography variant='subtitle1'>
                                        Discount Applied
                                    </Typography>
                                </Item>
                            </Grid>
                        </Grid>
                    </Box>

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
                            onClick={handleSubmit(handleFormSubmit, handleInvalidSubmit)}
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

export default PackageForm;
