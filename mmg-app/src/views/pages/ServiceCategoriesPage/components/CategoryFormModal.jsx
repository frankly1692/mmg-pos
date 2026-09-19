import React from 'react';
import { Box, Typography, TextField, Switch, Button, Stack, Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const schema = yup.object().shape({
    name: yup.string().required('Category name is required')
});

const CategoryFormModal = ({ open, onClose, onSubmit, category }) => {
    const {
        control,
        handleSubmit,
        formState: { errors },
        reset
    } = useForm({
        resolver: yupResolver(schema),
        defaultValues: category || {
            name: '',
            description: '',
            isActive: false
        }
    });

    // Reset form when category prop changes
    React.useEffect(() => {
        reset(
            category || {
                name: '',
                description: '',
                isActive: false
            }
        );
    }, [category, reset]);

    const handleFormSubmit = (data) => {
        onSubmit(data);
        onClose();
    };

    const handleCancel = () => {
        reset();
        onClose();
    };

    // const handleDelete = () => {
    //     onClose();
    // };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {category ? 'Edit Category' : 'Create New Category'}
                <IconButton onClick={handleCancel} size="small" aria-label="Close">
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <Box pt={2}>
                    <Stack direction="column" justifyContent="flex-start" alignItems="flex-start" spacing={2}>
                        <Controller
                            name="name"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Category Name"
                                    error={!!errors.name}
                                    helperText={errors.name?.message}
                                    fullWidth
                                    margin="normal"
                                />
                            )}
                        />
                        <Controller
                            name="description"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Description"
                                    error={!!errors.description}
                                    helperText={errors.description?.message}
                                    fullWidth
                                    margin="normal"
                                    multiline
                                    rows={4}
                                />
                            )}
                        />
                        {category && (
                            <Stack direction="column" justifyContent="flex-start" alignItems="flex-start" spacing={1}>
                                <Typography variant="h6">Set as active</Typography>
                                <Controller
                                    name="isActive"
                                    control={control}
                                    render={({ field }) => <Switch {...field} checked={field.value} color="primary" />}
                                />
                            </Stack>
                        )}
                        <Stack direction="row" justifyContent="flex-end" alignItems="flex-start" spacing={1} sx={{ width: '100%' }}>
                            {/* <Button variant="outlined" color="primary" onClick={handleCancel}>
                                Cancel
                            </Button> */}
                            {/* {category && (
                                <Button variant="outlined" color="error" onClick={handleDelete}>
                                    Delete
                                </Button>
                            )} */}
                            <Button variant="contained" color="primary" onClick={handleSubmit(handleFormSubmit)}>
                                Save
                            </Button>
                        </Stack>
                    </Stack>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default CategoryFormModal;
