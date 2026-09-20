import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import EditIcon from '@mui/icons-material/Edit';

import Grid from '@mui/material/Grid';
import { Box, Checkbox, Divider, MenuItem, Stack, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Field, Formik } from 'formik';
import * as Yup from 'yup';
import { useMutation, useQueryClient } from 'react-query';
import TextField from 'ui-component/TextField';
import doctor from 'api/doctor';

const validationSchema = Yup.object().shape({
    address: Yup.string().required('Address is required'),
    firstName: Yup.string().required('First name is required'),
    lastName: Yup.string().required('Last name is required'),
    middleName: Yup.string().required('Middle name is required'),
    gender: Yup.string().required('Gender is required'),
    age: Yup.number().required('Age is required'),
    isMember: Yup.bool().notRequired()
});

export default function ({ initialValues }) {
    const [open, setOpen] = React.useState(false);

    const queryClient = useQueryClient();
    const { mutateAsync } = useMutation(doctor.UpdateDoctor);

    const handleClickOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const renderButton = () => (
        <Button onClick={handleClickOpen} startIcon={<EditIcon fontSize="small" />} variant="outlined" size="small">
            Edit
        </Button>
    );

    if (!open) return renderButton();

    return (
        <React.Fragment>
            {renderButton()}
            <Dialog open={open} maxWidth="xs" fullWidth onClose={handleClose}>
                <Formik
                    initialValues={initialValues}
                    onSubmit={(values, actions) => {
                        mutateAsync(values)
                            .then(() => {
                                queryClient.invalidateQueries('doctors');
                                handleClose();
                            })
                            .catch((e) => actions.setFieldError('submit', e))
                            .finally(() => actions.setSubmitting(false));
                    }}
                    validationSchema={validationSchema}
                >
                    {({ handleSubmit, submitForm, isSubmitting }) => (
                        <form noValidate onSubmit={handleSubmit}>
                            <DialogTitle sx={{ pb: 1.5 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                    <Box>
                                        <Typography variant="h4" fontWeight={600}>
                                            Edit Doctor
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" mt={0.25}>
                                            Update this physician's registry details and network membership.
                                        </Typography>
                                    </Box>
                                    <IconButton onClick={handleClose} size="small" aria-label="Close">
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </Stack>
                            </DialogTitle>
                            <DialogContent>
                                <Grid container spacing={2}>
                                    <Grid item xs={3}>
                                        <Typography className="required" variant="body2" fontWeight={600}>
                                            Name
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Full legal name
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={9}>
                                        <Stack spacing={2}>
                                            <TextField name="firstName" placeholder="First Name" />
                                            <TextField name="middleName" placeholder="Middle Name" />
                                            <TextField name="lastName" placeholder="Last Name" />
                                        </Stack>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Divider />
                                    </Grid>
                                    <Grid item xs={3}>
                                        <Typography className="required" variant="body2" fontWeight={600}>
                                            Others
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Demographics
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={9}>
                                        <Stack spacing={2}>
                                            <TextField select displayEmpty name="gender">
                                                <MenuItem value="" disabled>
                                                    Gender
                                                </MenuItem>
                                                <MenuItem value="M">Male</MenuItem>
                                                <MenuItem value="F">Female</MenuItem>
                                                <MenuItem value="O">Others</MenuItem>
                                            </TextField>
                                            <TextField name="age" placeholder="Age" />
                                            <TextField name="address" placeholder="Address" />
                                        </Stack>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Divider />
                                    </Grid>
                                    <Grid item xs={3} alignSelf="center">
                                        <Typography variant="body2" fontWeight={600}>
                                            Member
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={9}>
                                        <Stack direction="row" alignItems="center" spacing={1}>
                                            <Field name="isMember">
                                                {({ field: { value, ...field } }) => <Checkbox checked={value} {...field} />}
                                            </Field>
                                            <Typography variant="body2" color="text.secondary">
                                                Check if doctor is an active hospital or network member
                                            </Typography>
                                        </Stack>
                                    </Grid>
                                </Grid>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={handleClose}>Cancel</Button>
                                <Button disableElevation disabled={isSubmitting} onClick={submitForm} size="small" variant="contained">
                                    {isSubmitting ? 'Saving...' : 'Submit'}
                                </Button>
                            </DialogActions>
                        </form>
                    )}
                </Formik>
            </Dialog>
        </React.Fragment>
    );
}
