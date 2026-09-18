import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import * as Yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
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
    Box,
    Card,
    CardContent,
    CardActions,
    FormControl,
    InputLabel,
    FormHelperText,
    Select
} from '@mui/material';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useQueryClient, useMutation } from 'react-query';
import customer from 'api/customer';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment'; // Import moment for date formatting
import { customerType } from 'utils/mockData';

const CustomerSchema = Yup.object().shape({
    firstName: Yup.string().required('First name is required'),
    middleName: Yup.string(),
    lastName: Yup.string().required('Last name is required'),
    birthDate: Yup.date().required('Birth date is required'),
    gender: Yup.string().required('Gender is required'),
    contactNumber: Yup.string()
        .required('Contact number is required')
        .matches(/^[0-9]+$/, 'Contact number must be numeric')
        .min(11, 'Contact number must be at least 11 digits long'),
    age: Yup.number().required('Customer Type is required'),
    customerType: Yup.string().required('Customer Type is required'),
    customerTypeId: Yup.string()
        .when('customerType', {
            is: (val) => val === 'seniorcitizenpwd' || val === 'solo-parent',
            then: (schema) => schema.required('ID Number is required'),
            otherwise: (schema) => schema
        }),
    childName: Yup.string().when('customerType', {
        is: 'solo-parent',
        then: (schema) => schema.required('Child Name is required'),
        otherwise: (schema) => schema
    }),
    childBirthDate: Yup.string().when('customerType', {
        is: 'solo-parent',
        then: (schema) => schema.required('Child Birth Date is required').nullable(),
        otherwise: (schema) => schema.nullable()
    }),
    childAge: Yup.string().when('customerType', {
        is: 'solo-parent',
        then: (schema) => schema.required('Child Age is required'),
        otherwise: (schema) => schema
    })
});

const calculateAge = (birthDate) => {
    if (!birthDate) return 0;
    const today = new Date();
    const birthDateObj = new Date(birthDate);
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDifference = today.getMonth() - birthDateObj.getMonth();

    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
    }

    return age;
};

const CustomerForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();

    const {
        control,
        watch,
        setValue,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm({
        resolver: yupResolver(CustomerSchema),
        mode: 'onChange', // Validate on change
        reValidateMode: 'onChange', // Re-validate on change
        defaultValues: {
            firstName: '',
            middleName: '',
            lastName: '',
            birthDate: 'null',
            gender: '',
            contactNumber: '',
            customerTypeId: '',
            tinNumber: '',
            age: '',
            childName: '',
            childBirthDate: null,
            childAge: '',
            address: {
                street: '',
                barangay: '',
                cityMunicipality: '',
                province: '',
                country: ''
            }
        }
    });

    const [initialData, setInitialData] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);


    const [provinces, setProvinces] = useState([]);
    const [municipalities, setMunicipalities] = useState({});
    const [barangays, setBarangays] = useState({});
    const [selectedProvince, setSelectedProvince] = useState('');
    const [selectedMunicipality, setSelectedMunicipality] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(
                    'https://raw.githubusercontent.com/flores-jacob/philippine-regions-provinces-cities-municipalities-barangays/master/philippine_provinces_cities_municipalities_and_barangays_2019v2.json'
                );
                const data = await response.json();

                // Initialize state variables
                const filteredProvinces = [];
                const filteredMunicipalities = {};
                const filteredBarangays = {};

                // Extract Region V data
                const regionVData = data['05'];

                if (!regionVData) {
                    throw new Error('Region V data not found');
                }

                // Log the data to check its structure
                console.log('Fetched data:', regionVData);

                // Process provinces in Region V
                if (regionVData.province_list) {
                    for (const provinceName in regionVData.province_list) {
                        if (regionVData.province_list.hasOwnProperty(provinceName)) {
                            filteredProvinces.push(provinceName);

                            // Process municipalities and barangays for the province
                            const municipalityList = regionVData.province_list[provinceName].municipality_list;
                            filteredMunicipalities[provinceName] = Object.keys(municipalityList);

                            Object.keys(municipalityList).forEach((municipality) => {
                                filteredBarangays[municipality] = municipalityList[municipality].barangay_list || [];
                            });
                        }
                    }
                }

                setProvinces(filteredProvinces);
                setMunicipalities(filteredMunicipalities);
                setBarangays(filteredBarangays);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        // Reset municipality and barangay when province changes
        setSelectedMunicipality('');
    }, [selectedProvince]);

    const birthDate = watch('birthDate');

    useEffect(() => {
        if (birthDate) {
            const age = calculateAge(birthDate);
            setValue('age', age.toString());
        }
    }, [birthDate, setValue]);

    const childBirthDate = watch('childBirthDate');

    useEffect(() => {
        if (childBirthDate) {
            const age = calculateAge(childBirthDate);
            setValue('childAge', age.toString());
        }
    }, [childBirthDate, setValue]);

    const handleNavigation = () => {
        navigate('/dashboard/customers');
    };

    const createCustomerMutation = useMutation(customer.CreateCustomer, {
        onMutate: async (newCustomer) => {
            await queryClient.cancelQueries('customers');
            const previousCustomers = queryClient.getQueryData('customers');
            if (previousCustomers) {
                queryClient.setQueryData('customers', [...previousCustomers, newCustomer]);
            } else {
                queryClient.setQueryData('customers', [newCustomer]);
            }
            return { previousCustomers };
        },
        onError: (err, newCustomer, context) => {
            if (context?.previousCustomers) {
                queryClient.setQueryData('customers', context.previousCustomers);
            }
            toast.error('Error creating customer.');
        },
        onSuccess: () => {
            toast.success('Customer created successfully.');
            handleNavigation();
        },
        onSettled: () => {
            queryClient.invalidateQueries('customers');
        }
    });

    const editCustomerMutation = useMutation(customer.EditCustomer, {
        onMutate: async (updatedCustomer) => {
            await queryClient.cancelQueries('customers');
            const previousCustomers = queryClient.getQueryData('customers');
            if (previousCustomers) {
                queryClient.setQueryData(
                    'customers',
                    previousCustomers.map((customer) => (customer._id === updatedCustomer._id ? updatedCustomer : customer))
                );
            }
            return { previousCustomers };
        },
        onError: (err, updatedCustomer, context) => {
            if (context?.previousCustomers) {
                queryClient.setQueryData('customers', context.previousCustomers);
            }
            toast.error('Error editing customer.');
        },
        onSuccess: () => {
            toast.success('Customer edited successfully.');
            handleNavigation();
        },
        onSettled: () => {
            queryClient.invalidateQueries('customers');
        }
    });

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const encodedCustomer = queryParams.get('customer');
        if (encodedCustomer) {
            const decodedCustomer = JSON.parse(decodeURIComponent(encodedCustomer));
            setInitialData(decodedCustomer);
        }
    }, [location.search]);

    useEffect(() => {
        if (initialData) {
            reset(initialData);
        }
    }, [initialData, reset]);

    const isSubmitting = createCustomerMutation.isLoading || editCustomerMutation.isLoading;

    const onSubmit = async (data) => {
        if (isSubmitting) return;

        const newData = {
            ...data,
            birthDate: moment(data?.birthDate).format('MM/DD/YYYY'),
            childBirthDate: data?.childBirthDate ? moment(data?.childBirthDate).format('MM/DD/YYYY') : null
        };
        console.log('data', newData);

        try {
            if (initialData) {
                await editCustomerMutation.mutateAsync({ id: initialData._id, ...data });
            } else {
                await createCustomerMutation.mutateAsync(data);
            }
        } catch (error) {
            console.error('Error submitting form:', error);
        }
    };

    const handleReset = () => {
        reset({
            firstName: '',
            middleName: '',
            lastName: '',
            birthDate: null,
            gender: '',
            contactNumber: '',
            tinNumber: '',
            age: '',
            address: {
                street: '',
                barangay: '',
                cityMunicipality: '',
                province: '',
                country: ''
            }
        });
        setValue('childName', '');
        setValue('childBirthDate', null);
        setValue('childAge', '');
        setSelectedProvince('');
        setSelectedMunicipality('');
    };

    const handleBack = () => {
        navigate(-1);
    };

    const handleDelete = () => {
        console.log('Customer deleted:', initialData);
        navigate(-1);
    };

    const handleOpenDeleteDialog = () => {
        setDeleteDialogOpen(true);
    };

    const handleCloseDeleteDialog = () => {
        setDeleteDialogOpen(false);
    };

    // Ensure value is converted to Moment object if needed
    const formatValue = (value) => {
        if (value && !moment.isMoment(value)) {
            return moment(value, 'MM/DD/YYYY');
        }
        return value;
    };

    console.log('initialData', initialData);

    return (
        <>
            <ToastContainer />
            <Card>
                <CardContent>
                    <Typography variant="h4" mb={2}>
                        {initialData ? 'Edit Customer' : 'Create Customer'}
                    </Typography>
                    <Box sx={{ maxHeight: '67vh', overflowY: 'auto' }}>
                        <Stack spacing={2} mr={1.5}>
                            <Typography variant="h6">Information</Typography>
                            <Controller
                                name="firstName"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label="First Name*"
                                        variant="outlined"
                                        fullWidth
                                        error={!!errors.firstName}
                                        helperText={errors.firstName?.message}
                                    />
                                )}
                            />
                            <Controller
                                name="middleName"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label="Middle Name"
                                        variant="outlined"
                                        fullWidth
                                        error={!!errors.middleName}
                                        helperText={errors.middleName?.message}
                                    />
                                )}
                            />
                            <Controller
                                name="lastName"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label="Last Name*"
                                        variant="outlined"
                                        fullWidth
                                        error={!!errors.lastName}
                                        helperText={errors.lastName?.message}
                                    />
                                )}
                            />
                            <LocalizationProvider dateAdapter={AdapterMoment}>
                                <Controller
                                    name="birthDate"
                                    control={control}
                                    render={({ field: { onChange, onBlur, value, ref } }) => (
                                        <DatePicker
                                            label="Birth Date*"
                                            inputFormat="MM/DD/YYYY"
                                            value={formatValue(value)}
                                            onChange={(newValue) => {
                                                // Handle value change and validation
                                                onChange(newValue);
                                            }}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    variant="outlined"
                                                    fullWidth
                                                    error={!!errors.birthDate}
                                                    helperText={errors.birthDate?.message}
                                                />
                                            )}
                                        />
                                    )}
                                />
                            </LocalizationProvider>
                            <Controller
                                name="age"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label="Age"
                                        variant="outlined"
                                        fullWidth
                                        disabled
                                        error={!!errors.age}
                                        helperText={errors.age?.message}
                                        InputProps={{
                                            readOnly: true
                                        }}
                                    />
                                )}
                            />
                            <Controller
                                name="gender"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        select
                                        label="Gender*"
                                        variant="outlined"
                                        fullWidth
                                        error={!!errors.gender}
                                        helperText={errors.gender?.message}
                                    >
                                        <MenuItem value="male">Male</MenuItem>
                                        <MenuItem value="female">Female</MenuItem>
                                        <MenuItem value="others">Others</MenuItem>
                                    </TextField>
                                )}
                            />
                            <Controller
                                name="contactNumber"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label="Contact Number*"
                                        variant="outlined"
                                        fullWidth
                                        type="tel"
                                        error={!!errors.contactNumber}
                                        helperText={errors.contactNumber?.message}
                                    />
                                )}
                            />
                            <Controller
                                name="tinNumber"
                                control={control}
                                // rules={{
                                //     pattern: {
                                //         value: /^[0-9]{15}$/,
                                //         message: 'TIN Number must be exactly 12 digits'
                                //     }
                                // }}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label="TIN Number"
                                        variant="outlined"
                                        fullWidth
                                        type="text" // Use text type to ensure full control over numeric input
                                        inputProps={{ maxLength: 15 }} // Restrict input length to 12 digits
                                        error={!!errors.tinNumber}
                                        helperText={errors.tinNumber?.message}
                                        onChange={(e) => {
                                            field.onChange(e);
                                            // Optionally, you can manually trigger validation if needed
                                        }}
                                    />
                                )}
                            />
                            <Controller
                                name="customerType"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        select
                                        {...field}
                                        size="small"
                                        label="Customer Type*"
                                        variant="outlined"
                                        fullWidth
                                        value={field.value || ''}
                                        error={!!errors.customerType}
                                        helperText={errors.tinNumber?.customerType}
                                    >
                                        <MenuItem value="member">Member</MenuItem>
                                        <MenuItem value="non-member">Non-member</MenuItem>
                                        <MenuItem value="seniorcitizenpwd">Senior Citizen/PWD</MenuItem>
                                        <MenuItem value="officer-bod">Officer BOD</MenuItem>
                                        <MenuItem value="officer-gm">Officer GM</MenuItem>
                                        <MenuItem value="officer-treasurer">Officer Treasure</MenuItem>
                                        <MenuItem value="officer-committer-officers">Officer Committee Officers</MenuItem>
                                        <MenuItem value="associate-member">Associate Member</MenuItem>
                                        <MenuItem value="solo-parent">Solo Parent</MenuItem>
                                    </TextField>
                                )}
                            />
                            {(watch('customerType') === 'seniorcitizenpwd' || watch('customerType') === 'solo-parent') && (
                                <Controller
                                    name="customerTypeId"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            label={watch('customerType') === 'solo-parent' ? "Solo Parent ID No." : "SC/PWD ID No."}
                                            variant="outlined"
                                            fullWidth
                                            error={!!errors.customerTypeId}
                                            helperText={errors.customerTypeId?.message}
                                        />
                                    )}
                                />
                            )}
                            {watch('customerType') === 'solo-parent' && (
                                <>
                                    <Typography variant="h6">Child Information</Typography>
                                    <Controller
                                        name="childName"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                label="Child Name*"
                                                variant="outlined"
                                                fullWidth
                                                error={!!errors.childName}
                                                helperText={errors.childName?.message}
                                            />
                                        )}
                                    />
                                    <LocalizationProvider dateAdapter={AdapterMoment}>
                                        <Controller
                                            name="childBirthDate"
                                            control={control}
                                            render={({ field: { onChange, value } }) => (
                                                <DatePicker
                                                    label="Child Birth Date*"
                                                    inputFormat="MM/DD/YYYY"
                                                    value={formatValue(value)}
                                                    onChange={(newValue) => {
                                                        onChange(newValue);
                                                    }}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            variant="outlined"
                                                            fullWidth
                                                            error={!!errors.childBirthDate}
                                                            helperText={errors.childBirthDate?.message}
                                                        />
                                                    )}
                                                />
                                            )}
                                        />
                                    </LocalizationProvider>
                                    <Controller
                                        name="childAge"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                label="Child Age"
                                                variant="outlined"
                                                fullWidth
                                                disabled
                                                error={!!errors.childAge}
                                                helperText={errors.childAge?.message}
                                                InputProps={{
                                                    readOnly: true
                                                }}
                                            />
                                        )}
                                    />
                                </>
                            )}
                            <Typography variant="h6">Address</Typography>
                            <Controller
                                name="address.street"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label="Street"
                                        variant="outlined"
                                        fullWidth
                                        error={!!errors.address?.street}
                                        helperText={errors.address?.street?.message}
                                    />
                                )}
                            />
                            <Controller
                                name="address.province"
                                control={control}
                                render={({ field }) => (
                                    <FormControl fullWidth error={!!errors.address?.province}>
                                        <InputLabel>Province</InputLabel>
                                        <Select
                                            {...field}
                                            label="Province"
                                            onChange={(e) => {
                                                field.onChange(e);
                                                setSelectedProvince(e.target.value);
                                            }}
                                        >
                                            {provinces.map((province) => (
                                                <MenuItem key={province} value={province}>
                                                    {province}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                        <FormHelperText>{errors.address?.province?.message}</FormHelperText>
                                    </FormControl>
                                )}
                            />
                            {selectedProvince && (
                                <Controller
                                    name="address.cityMunicipality"
                                    control={control}
                                    render={({ field }) => (
                                        <FormControl fullWidth error={!!errors.address?.cityMunicipality}>
                                            <InputLabel>City/Municipality</InputLabel>
                                            <Select
                                                {...field}
                                                label="City/Municipality"
                                                value={field.value || ''}
                                                onChange={(e) => {
                                                    field.onChange(e);
                                                    setSelectedMunicipality(e.target.value);
                                                }}
                                            >
                                                {(municipalities[selectedProvince] || []).map((municipality) => (
                                                    <MenuItem key={municipality} value={municipality}>
                                                        {municipality}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            <FormHelperText>{errors.address?.cityMunicipality?.message}</FormHelperText>
                                        </FormControl>
                                    )}
                                />
                            )}
                            {selectedMunicipality && (
                                <Controller
                                    name="address.barangay"
                                    control={control}
                                    render={({ field }) => (
                                        <FormControl fullWidth error={!!errors.address?.barangay}>
                                            <InputLabel>Barangay</InputLabel>
                                            <Select {...field} label="Barangay" value={field.value || ''}>
                                                {(barangays[selectedMunicipality] || []).map((barangay) => (
                                                    <MenuItem key={barangay} value={barangay}>
                                                        {barangay}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            <FormHelperText>{errors.address?.barangay?.message}</FormHelperText>
                                        </FormControl>
                                    )}
                                />
                            )}
                            <Controller
                                name="address.country"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label="Country"
                                        variant="outlined"
                                        fullWidth
                                        defaultValue="Philippines"
                                        error={!!errors.address?.country}
                                        helperText={errors.address?.country?.message}
                                    />
                                )}
                            />
                        </Stack>
                    </Box>
                </CardContent>
                <CardActions>
                    <Stack direction="row" spacing={2} justifyContent="center">
                        {/* {initialData && (
                            <Button variant="outlined" color="error" onClick={handleOpenDeleteDialog}>
                                Delete
                            </Button>
                        )} */}
                        <Button variant="outlined" onClick={handleReset} disabled={isSubmitting}>
                            Reset
                        </Button>
                        <Button variant="outlined" onClick={handleBack} color="primary">
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
                            {initialData ? 'Update' : 'Save'}
                        </Button>
                    </Stack>
                </CardActions>
            </Card>
            <Dialog
                open={deleteDialogOpen}
                onClose={handleCloseDeleteDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">Confirm Deletion</DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">Are you sure you want to delete this customer?</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeleteDialog} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={handleDelete} color="primary" autoFocus>
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default CustomerForm;
