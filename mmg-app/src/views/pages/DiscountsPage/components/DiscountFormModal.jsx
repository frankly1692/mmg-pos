import React from 'react';
import { Box, TextField, Button, Stack, Dialog, DialogContent, DialogTitle, MenuItem, IconButton, Typography, InputAdornment } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const schema = yup.object().shape({
    name: yup.string().required('Discount name is required'),
    type: yup.string().required('Discount type is required'),
    value: yup
        .number()
        .required('Discount value is required')
        .positive('Value must be positive')
        .when('type', {
            is: 'percentage',
            then: (valueSchema) => valueSchema.max(100, 'Percentage value cannot exceed 100')
        })
});

// Uppercase static caption, matching this modal's design (as opposed to the sentence-case
// captions used elsewhere in the app).
const FieldLabel = ({ children, required, optional }) => (
    <Typography variant="caption" fontWeight={700} letterSpacing={0.4} color="text.secondary" sx={{ textTransform: 'uppercase' }}>
        {children}
        {required && (
            <Box component="span" sx={{ color: 'warning.dark', ml: 0.3 }}>
                *
            </Box>
        )}
        {optional && (
            <Box component="span" sx={{ ml: 0.5, fontWeight: 400, textTransform: 'none' }}>
                Optional
            </Box>
        )}
    </Typography>
);

const DiscountFormModal = ({ open, onClose, onSubmit, discount }) => {
    const {
        control,
        handleSubmit,
        watch,
        setValue,
        getValues,
        formState: { errors },
        reset
    } = useForm({
        resolver: yupResolver(schema),
        defaultValues: discount || {
            name: '',
            description: '',
            type: 'percentage',
            value: ''
        }
    });

    // Reset form when category prop changes
    React.useEffect(() => {
        reset(
            discount || {
                name: '',
                description: '',
                type: 'percentage',
                value: ''
            }
        );
    }, [discount, reset]);

    const handleFormSubmit = (data) => {
        onSubmit(data);
        onClose();
    };

    const handleCancel = () => {
        reset();
        onClose();
    };

    const watchedType = watch('type');
    const watchedValue = watch('value');
    const formattedValue = watchedType === 'percentage' ? `${watchedValue || 0}%` : `₱${Number(watchedValue || 0).toLocaleString()}`;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ pb: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                        <Typography variant="h4" fontWeight={600}>
                            {discount ? 'Edit Discount' : 'Create New Discount'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mt={0.25}>
                            Configure rate reductions and promo discounts for lab tests and services.
                        </Typography>
                    </Box>
                    <IconButton onClick={handleCancel} size="small" aria-label="Close">
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent>
                <form onSubmit={handleSubmit(handleFormSubmit)}>
                    <Stack direction="column" spacing={2.5}>
                        <Controller
                            name="name"
                            control={control}
                            render={({ field }) => (
                                <Box>
                                    <FieldLabel required>Discount Name</FieldLabel>
                                    <TextField
                                        {...field}
                                        placeholder="e.g., Senior Citizen Discount (20%) or PWD Promo"
                                        error={!!errors.name}
                                        helperText={errors.name?.message}
                                        fullWidth
                                        sx={{ mt: 0.5 }}
                                    />
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
                                            Optional
                                        </Typography>
                                    </Stack>
                                    <TextField
                                        {...field}
                                        placeholder="Provide details on eligibility criteria or applicability across tests..."
                                        error={!!errors.description}
                                        helperText={errors.description?.message}
                                        fullWidth
                                        multiline
                                        rows={3}
                                        sx={{ mt: 0.5 }}
                                    />
                                </Box>
                            )}
                        />
                        <Controller
                            name="type"
                            control={control}
                            render={({ field }) => (
                                <Box>
                                    <FieldLabel required>Discount Type</FieldLabel>
                                    <TextField
                                        select
                                        {...field}
                                        variant="outlined"
                                        fullWidth
                                        sx={{ mt: 0.5 }}
                                        error={!!errors.type}
                                        helperText={errors.type?.message}
                                        onChange={(e) => {
                                            field.onChange(e);
                                            const newType = e.target.value;
                                            const currentValue = getValues('value');
                                            if (newType === 'percentage' && currentValue !== '' && Number(currentValue) > 100) {
                                                setValue('value', 100, { shouldValidate: true });
                                            }
                                        }}
                                    >
                                        <MenuItem value="percentage">Percentage (%)</MenuItem>
                                        <MenuItem value="fixed">Fixed Amount (₱)</MenuItem>
                                    </TextField>
                                </Box>
                            )}
                        />
                        <Controller
                            name="value"
                            control={control}
                            render={({ field }) => (
                                <Box>
                                    <FieldLabel required>Discount Value</FieldLabel>
                                    <TextField
                                        {...field}
                                        placeholder="20"
                                        type="number"
                                        error={!!errors.value}
                                        helperText={errors.value?.message}
                                        fullWidth
                                        sx={{ mt: 0.5 }}
                                        inputProps={watchedType === 'percentage' ? { max: 100 } : undefined}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">{watchedType === 'percentage' ? '%' : '₱'}</InputAdornment>
                                            )
                                        }}
                                        onChange={(e) => {
                                            let val = e.target.value;
                                            if (watchedType === 'percentage' && val !== '' && Number(val) > 100) {
                                                val = '100';
                                            }
                                            field.onChange(val);
                                        }}
                                    />
                                </Box>
                            )}
                        />

                        {watchedValue !== '' && watchedValue != null && (
                            <Stack
                                direction="row"
                                spacing={1}
                                sx={{ p: 1.5, borderRadius: 1.5, bgcolor: '#EFF6FF', border: '1px solid', borderColor: '#BFDBFE' }}
                            >
                                <InfoOutlinedIcon fontSize="small" sx={{ mt: 0.25, color: '#2563EB' }} />
                                <Typography variant="body2" color="text.secondary">
                                    Applies a{' '}
                                    <Typography component="span" variant="body2" fontWeight={700} sx={{ color: '#1D4ED8' }}>
                                        {formattedValue}
                                    </Typography>{' '}
                                    reduction across all qualifying clinical laboratory test charges at cashier counter checkout.
                                </Typography>
                            </Stack>
                        )}

                        <Stack direction="row" justifyContent="flex-end" spacing={1.5} pt={1}>
                            <Button onClick={handleCancel}>Cancel</Button>
                            <Button type="submit" variant="contained" color="primary">
                                Save
                            </Button>
                        </Stack>
                    </Stack>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default DiscountFormModal;
