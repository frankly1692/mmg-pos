import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import { Checkbox, Divider, MenuItem, Stack, Typography, IconButton } from '@mui/material';
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

const AddDoctorModal = ({ open, onClose }) => {
    const queryClient = useQueryClient();
    const { mutateAsync } = useMutation(doctor.CreateDoctor);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <Formik
                initialValues={{
                    address: '',
                    firstName: '',
                    gender: '',
                    lastName: '',
                    middleName: '',
                    age: '',
                    isMember: false
                }}
                onSubmit={(values, actions) => {
                    mutateAsync(values)
                        .then(() => {
                            queryClient.invalidateQueries('doctors');
                            actions.resetForm(); // Reset the form after submission
                            onClose(); // Close the dialog
                        })
                        .catch((e) => actions.setFieldError('submit', e))
                        .finally(() => actions.setSubmitting(false));
                }}
                validationSchema={validationSchema}
            >
                {({ handleSubmit, submitForm, isSubmitting }) => (
                    <form noValidate onSubmit={handleSubmit}>
                        <DialogTitle sx={{ fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            New Doctor
                            <IconButton onClick={onClose} size="small" aria-label="Close">
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </DialogTitle>
                        <DialogContent>
                            <Grid container spacing={2}>
                                <Grid item xs={3}>
                                    <Typography className="required" variant="caption">
                                        Name
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
                                    <Typography className="required" variant="caption">
                                        Others
                                    </Typography>
                                </Grid>
                                <Grid item xs={9}>
                                    <Stack spacing={2}>
                                        <TextField select name="gender" label="Gender">
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
                                    <Typography variant="caption">Member</Typography>
                                </Grid>
                                <Grid item xs={9}>
                                    <Field name="isMember">{({ field }) => <Checkbox {...field} />}</Field>
                                </Grid>
                            </Grid>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={onClose}>Cancel</Button>
                            <Button disableElevation disabled={isSubmitting} onClick={submitForm} size="small" variant="contained">
                                {isSubmitting ? 'Saving...' : 'Submit'}
                            </Button>
                        </DialogActions>
                    </form>
                )}
            </Formik>
        </Dialog>
    );
};

export default AddDoctorModal;
