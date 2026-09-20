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
    Box,
    Card,
    Chip,
    FormControl,
    FormHelperText,
    Select,
    Grid,
    InputAdornment,
    ToggleButton,
    ToggleButtonGroup,
    IconButton
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CheckIcon from '@mui/icons-material/Check';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useQueryClient, useMutation } from 'react-query';
import customer from 'api/customer';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment'; // Import moment for date formatting
import { customerType } from 'utils/mockData';

const CUSTOMER_TYPE_OPTIONS = [
    { value: 'member', label: 'Member' },
    { value: 'non-member', label: 'Non-member' },
    { value: 'seniorcitizenpwd', label: 'Senior Citizen/PWD' },
    { value: 'officer-bod', label: 'Officer BOD' },
    { value: 'officer-gm', label: 'Officer GM' },
    { value: 'officer-treasurer', label: 'Officer Treasure' },
    { value: 'officer-committer-officers', label: 'Officer Committee Officers' },
    { value: 'associate-member', label: 'Associate Member' },
    { value: 'solo-parent', label: 'Solo Parent' }
];

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

// Small gray caption rendered below a field to explain its purpose/format.
const FieldHint = ({ children }) => (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {children}
    </Typography>
);

// Numbered header bar for a section card (e.g. "01  Personal Information").
const SectionHeader = ({ index, title, caption }) => (
    <Box
        sx={{
            px: 3,
            py: 1.75,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: 'space-between',
            alignItems: 'center',
            bgcolor: 'grey.50',
            borderBottom: '1px solid',
            borderColor: 'divider'
        }}
    >
        <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
                sx={{
                    width: 26,
                    height: 26,
                    borderRadius: 1,
                    bgcolor: 'primary.light',
                    color: 'primary.dark',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0
                }}
            >
                {index}
            </Box>
            <Typography variant="subtitle1" fontWeight={600}>
                {title}
            </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
            {caption}
        </Typography>
    </Box>
);

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
            birthDate: null,
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
            toast.success('Customer created successfully.', { autoClose: 1500 });
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
            toast.success('Customer edited successfully.', { autoClose: 1500 });
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

    const isSoloParent = watch('customerType') === 'solo-parent';
    const isSeniorCitizenPwd = watch('customerType') === 'seniorcitizenpwd';

    console.log('initialData', initialData);

    return (
        <>
            <ToastContainer />
            <Stack spacing={2.5}>
                {/* Header */}
                <Card>
                    <Box sx={{ px: 3, py: 2.5, display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Stack direction="row" spacing={1.5} alignItems="flex-start">
                            <IconButton aria-label="back" onClick={handleBack} sx={{ mt: 0.5 }}>
                                <ArrowBackIcon />
                            </IconButton>
                            <Box>
                                <Typography variant="h2" fontWeight={600}>
                                    {initialData ? 'Edit Customer' : 'New Customer Registration'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" mt={0.5}>
                                    Enter complete demographic, contact, and residential information to establish a new client account.
                                </Typography>
                            </Box>
                        </Stack>
                        <Chip
                            size="small"
                            label="Fields marked with (*) are strictly required."
                            sx={{ bgcolor: 'warning.light', color: 'warning.dark', fontWeight: 500 }}
                        />
                    </Box>
                </Card>

                {/* Customer Type — pill selector */}
                <Card>
                    <Box sx={{ px: 3, py: 2.5 }}>
                        <Stack direction="row" flexWrap="wrap" gap={1} justifyContent="space-between" alignItems="center" mb={2}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
                                <Typography variant="overline" fontWeight={700} letterSpacing={0.5} lineHeight={1}>
                                    Customer Type
                                    <Box component="span" sx={{ color: 'warning.dark', ml: 0.3 }}>
                                        *
                                    </Box>
                                </Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                                Select client membership or institutional role
                            </Typography>
                        </Stack>
                        <Controller
                            name="customerType"
                            control={control}
                            render={({ field }) => (
                                <ToggleButtonGroup
                                    exclusive
                                    value={field.value || ''}
                                    onChange={(e, newValue) => {
                                        if (newValue !== null) field.onChange(newValue);
                                    }}
                                    sx={{ flexWrap: 'wrap', gap: 1 }}
                                >
                                    {CUSTOMER_TYPE_OPTIONS.map((option) => (
                                        <ToggleButton
                                            key={option.value}
                                            value={option.value}
                                            sx={{
                                                borderRadius: '20px !important',
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                px: 2,
                                                py: 0.5,
                                                textTransform: 'none',
                                                fontSize: '0.8125rem',
                                                '&.Mui-selected': {
                                                    bgcolor: 'primary.main',
                                                    borderColor: 'primary.main',
                                                    color: 'primary.contrastText',
                                                    '&:hover': {
                                                        bgcolor: 'primary.dark'
                                                    }
                                                }
                                            }}
                                        >
                                            {field.value === option.value && <CheckIcon sx={{ fontSize: 16, mr: 0.5 }} />}
                                            {option.label}
                                        </ToggleButton>
                                    ))}
                                </ToggleButtonGroup>
                            )}
                        />
                        {errors.customerType && (
                            <FormHelperText error sx={{ mt: 1 }}>
                                {errors.customerType.message}
                            </FormHelperText>
                        )}
                    </Box>
                </Card>

                {/* Section 01 — Personal Information */}
                <Card sx={{ overflow: 'hidden' }}>
                    <SectionHeader index="01" title="Personal Information" caption="Identity & Legal Records" />
                    <Box sx={{ px: 3, py: 3 }}>
                        <Grid container spacing={3}>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="firstName"
                                    control={control}
                                    render={({ field }) => (
                                        <Box>
                                            <FieldLabel required>First Name</FieldLabel>
                                            <TextField
                                                {...field}
                                                placeholder="e.g. Juan"
                                                variant="outlined"
                                                fullWidth
                                                error={!!errors.firstName}
                                                helperText={errors.firstName?.message}
                                            />
                                        </Box>
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="middleName"
                                    control={control}
                                    render={({ field }) => (
                                        <Box>
                                            <FieldLabel optional>Middle Name</FieldLabel>
                                            <TextField
                                                {...field}
                                                placeholder="e.g. Santos"
                                                variant="outlined"
                                                fullWidth
                                                error={!!errors.middleName}
                                                helperText={errors.middleName?.message}
                                            />
                                        </Box>
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="lastName"
                                    control={control}
                                    render={({ field }) => (
                                        <Box>
                                            <FieldLabel required>Last Name</FieldLabel>
                                            <TextField
                                                {...field}
                                                placeholder="e.g. Dela Cruz"
                                                variant="outlined"
                                                fullWidth
                                                error={!!errors.lastName}
                                                helperText={errors.lastName?.message}
                                            />
                                        </Box>
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <LocalizationProvider dateAdapter={AdapterMoment}>
                                    <Controller
                                        name="birthDate"
                                        control={control}
                                        render={({ field: { onChange, onBlur, value, ref } }) => (
                                            <Box>
                                                <FieldLabel required>Birth Date</FieldLabel>
                                                <DatePicker
                                                    format="MM/DD/YYYY"
                                                    value={formatValue(value)}
                                                    onChange={(newValue) => {
                                                        // Handle value change and validation
                                                        onChange(newValue);
                                                    }}
                                                    slotProps={{
                                                        textField: {
                                                            variant: 'outlined',
                                                            fullWidth: true,
                                                            error: !!errors.birthDate,
                                                            helperText: errors.birthDate?.message
                                                        }
                                                    }}
                                                />
                                                {!errors.birthDate && <FieldHint>Date format MM/DD/YYYY</FieldHint>}
                                            </Box>
                                        )}
                                    />
                                </LocalizationProvider>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="age"
                                    control={control}
                                    render={({ field }) => (
                                        <Box>
                                            <FieldLabel>Age</FieldLabel>
                                            <TextField
                                                {...field}
                                                placeholder="Auto"
                                                variant="outlined"
                                                fullWidth
                                                disabled
                                                error={!!errors.age}
                                                helperText={errors.age?.message}
                                                InputProps={{
                                                    readOnly: true
                                                }}
                                            />
                                            {!errors.age && <FieldHint>Computed from birth date</FieldHint>}
                                        </Box>
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="gender"
                                    control={control}
                                    render={({ field }) => (
                                        <Box>
                                            <FieldLabel required>Gender</FieldLabel>
                                            <TextField
                                                {...field}
                                                select
                                                displayEmpty
                                                variant="outlined"
                                                fullWidth
                                                error={!!errors.gender}
                                                helperText={errors.gender?.message}
                                            >
                                                <MenuItem value="" disabled>
                                                    Select gender
                                                </MenuItem>
                                                <MenuItem value="male">Male</MenuItem>
                                                <MenuItem value="female">Female</MenuItem>
                                                <MenuItem value="others">Others</MenuItem>
                                            </TextField>
                                        </Box>
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
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
                                        <Box>
                                            <FieldLabel optional>TIN Number</FieldLabel>
                                            <TextField
                                                {...field}
                                                placeholder="000-000-000-000"
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
                                            {!errors.tinNumber && <FieldHint>Taxpayer Identification Number</FieldHint>}
                                        </Box>
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="contactNumber"
                                    control={control}
                                    render={({ field }) => (
                                        <Box>
                                            <FieldLabel required>Contact Number</FieldLabel>
                                            <TextField
                                                {...field}
                                                placeholder="09XXXXXXXXX"
                                                variant="outlined"
                                                fullWidth
                                                type="tel"
                                                error={!!errors.contactNumber}
                                                helperText={errors.contactNumber?.message}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <PhoneIcon fontSize="small" color="action" />
                                                        </InputAdornment>
                                                    )
                                                }}
                                            />
                                            {!errors.contactNumber && <FieldHint>Primary mobile or business contact</FieldHint>}
                                        </Box>
                                    )}
                                />
                            </Grid>
                            {(isSeniorCitizenPwd || isSoloParent) && (
                                <Grid item xs={12} sm={4}>
                                    <Controller
                                        name="customerTypeId"
                                        control={control}
                                        render={({ field }) => (
                                            <Box>
                                                <FieldLabel required>{isSoloParent ? 'Solo Parent ID No.' : 'SC/PWD ID No.'}</FieldLabel>
                                                <TextField
                                                    {...field}
                                                    variant="outlined"
                                                    fullWidth
                                                    error={!!errors.customerTypeId}
                                                    helperText={errors.customerTypeId?.message}
                                                />
                                                {!errors.customerTypeId && <FieldHint>Required to validate this discount</FieldHint>}
                                            </Box>
                                        )}
                                    />
                                </Grid>
                            )}
                        </Grid>
                    </Box>
                </Card>

                {/* Section 02 — Address */}
                <Card sx={{ overflow: 'hidden' }}>
                    <SectionHeader index="02" title="Address" caption="Primary Residence / Billing" />
                    <Box sx={{ px: 3, py: 3 }}>
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <Controller
                                    name="address.street"
                                    control={control}
                                    render={({ field }) => (
                                        <Box>
                                            <FieldLabel optional>Street Address</FieldLabel>
                                            <TextField
                                                {...field}
                                                placeholder="House / Building number, Street name, Subdivision"
                                                variant="outlined"
                                                fullWidth
                                                error={!!errors.address?.street}
                                                helperText={errors.address?.street?.message}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <LocationOnOutlinedIcon fontSize="small" color="action" />
                                                        </InputAdornment>
                                                    )
                                                }}
                                            />
                                        </Box>
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="address.province"
                                    control={control}
                                    render={({ field }) => (
                                        <Box>
                                            <FieldLabel optional>Province</FieldLabel>
                                            <FormControl fullWidth error={!!errors.address?.province}>
                                                <Select
                                                    {...field}
                                                    displayEmpty
                                                    onChange={(e) => {
                                                        field.onChange(e);
                                                        setSelectedProvince(e.target.value);
                                                    }}
                                                >
                                                    <MenuItem value="">
                                                        <em>Select province</em>
                                                    </MenuItem>
                                                    {provinces.map((province) => (
                                                        <MenuItem key={province} value={province}>
                                                            {province}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                                <FormHelperText>{errors.address?.province?.message}</FormHelperText>
                                            </FormControl>
                                        </Box>
                                    )}
                                />
                            </Grid>
                            {selectedProvince && (
                                <Grid item xs={12} sm={4}>
                                    <Controller
                                        name="address.cityMunicipality"
                                        control={control}
                                        render={({ field }) => (
                                            <Box>
                                                <FieldLabel optional>City/Municipality</FieldLabel>
                                                <FormControl fullWidth error={!!errors.address?.cityMunicipality}>
                                                    <Select
                                                        {...field}
                                                        displayEmpty
                                                        value={field.value || ''}
                                                        onChange={(e) => {
                                                            field.onChange(e);
                                                            setSelectedMunicipality(e.target.value);
                                                        }}
                                                    >
                                                        <MenuItem value="">
                                                            <em>Select city/municipality</em>
                                                        </MenuItem>
                                                        {(municipalities[selectedProvince] || []).map((municipality) => (
                                                            <MenuItem key={municipality} value={municipality}>
                                                                {municipality}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                    <FormHelperText>{errors.address?.cityMunicipality?.message}</FormHelperText>
                                                </FormControl>
                                            </Box>
                                        )}
                                    />
                                </Grid>
                            )}
                            {selectedMunicipality && (
                                <Grid item xs={12} sm={4}>
                                    <Controller
                                        name="address.barangay"
                                        control={control}
                                        render={({ field }) => (
                                            <Box>
                                                <FieldLabel optional>Barangay</FieldLabel>
                                                <FormControl fullWidth error={!!errors.address?.barangay}>
                                                    <Select {...field} displayEmpty value={field.value || ''}>
                                                        <MenuItem value="">
                                                            <em>Select barangay</em>
                                                        </MenuItem>
                                                        {(barangays[selectedMunicipality] || []).map((barangay) => (
                                                            <MenuItem key={barangay} value={barangay}>
                                                                {barangay}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                    <FormHelperText>{errors.address?.barangay?.message}</FormHelperText>
                                                </FormControl>
                                            </Box>
                                        )}
                                    />
                                </Grid>
                            )}
                            <Grid item xs={12} sm={4}>
                                <Controller
                                    name="address.country"
                                    control={control}
                                    render={({ field }) => (
                                        <Box>
                                            <FieldLabel optional>Country</FieldLabel>
                                            <TextField
                                                {...field}
                                                variant="outlined"
                                                fullWidth
                                                defaultValue="Philippines"
                                                error={!!errors.address?.country}
                                                helperText={errors.address?.country?.message}
                                            />
                                        </Box>
                                    )}
                                />
                            </Grid>
                        </Grid>
                    </Box>
                </Card>

                {/* Section 03 — Child Information (Solo Parent only) */}
                {isSoloParent && (
                    <Card sx={{ overflow: 'hidden' }}>
                        <SectionHeader index="03" title="Child Information" caption="Solo Parent Requirement" />
                        <Box sx={{ px: 3, py: 3 }}>
                            <Grid container spacing={3}>
                                <Grid item xs={12} sm={4}>
                                    <Controller
                                        name="childName"
                                        control={control}
                                        render={({ field }) => (
                                            <Box>
                                                <FieldLabel required>Child Name</FieldLabel>
                                                <TextField
                                                    {...field}
                                                    variant="outlined"
                                                    fullWidth
                                                    error={!!errors.childName}
                                                    helperText={errors.childName?.message}
                                                />
                                            </Box>
                                        )}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <LocalizationProvider dateAdapter={AdapterMoment}>
                                        <Controller
                                            name="childBirthDate"
                                            control={control}
                                            render={({ field: { onChange, value } }) => (
                                                <Box>
                                                    <FieldLabel required>Child Birth Date</FieldLabel>
                                                    <DatePicker
                                                        format="MM/DD/YYYY"
                                                        value={formatValue(value)}
                                                        onChange={(newValue) => {
                                                            onChange(newValue);
                                                        }}
                                                        slotProps={{
                                                            textField: {
                                                                variant: 'outlined',
                                                                fullWidth: true,
                                                                error: !!errors.childBirthDate,
                                                                helperText: errors.childBirthDate?.message
                                                            }
                                                        }}
                                                    />
                                                </Box>
                                            )}
                                        />
                                    </LocalizationProvider>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <Controller
                                        name="childAge"
                                        control={control}
                                        render={({ field }) => (
                                            <Box>
                                                <FieldLabel>Child Age</FieldLabel>
                                                <TextField
                                                    {...field}
                                                    placeholder="Auto"
                                                    variant="outlined"
                                                    fullWidth
                                                    disabled
                                                    error={!!errors.childAge}
                                                    helperText={errors.childAge?.message}
                                                    InputProps={{
                                                        readOnly: true
                                                    }}
                                                />
                                                {!errors.childAge && <FieldHint>Computed from birth date</FieldHint>}
                                            </Box>
                                        )}
                                    />
                                </Grid>
                            </Grid>
                        </Box>
                    </Card>
                )}

                {/* Footer */}
                <Card>
                    <Box
                        sx={{
                            px: 3,
                            py: 2,
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 2,
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}
                    >
                        <Stack direction="row" spacing={1} alignItems="center">
                            <CheckCircleOutlineIcon color="success" fontSize="small" />
                            <Typography variant="body2" color="text.secondary">
                                All changes are automatically validated prior to submission.
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1.5}>
                            <Button variant="outlined" color="inherit" onClick={handleBack}>
                                Cancel
                            </Button>
                            <Button variant="outlined" onClick={handleReset} disabled={isSubmitting}>
                                Reset
                            </Button>
                            <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
                                {initialData ? 'Update Customer' : 'Create Customer'}
                            </Button>
                        </Stack>
                    </Box>
                </Card>
            </Stack>
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
