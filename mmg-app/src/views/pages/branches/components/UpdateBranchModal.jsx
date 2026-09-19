import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import EditIcon from '@mui/icons-material/Edit';

import Grid from '@mui/material/Grid';
import { Divider, Stack, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Field, Formik } from 'formik';
import * as Yup from 'yup';
import { useMutation, useQueryClient } from 'react-query';
import branch from 'api/branch';
import TextField from 'ui-component/TextField';
import Switch from 'ui-component/switch';

const validationSchema = Yup.object().shape({
    streetAddress: Yup.string().required('Address is required'),
    name: Yup.string().required('Name is required'),
    // city: Yup.string().required(),
    // postalCode: Yup.string().required(),
    // state: Yup.string().required(),
    tin: Yup.string().required('TIN is required'),
    contactNumber: Yup.string(),
    emailAddress: Yup.string(),
    // isActive: Yup.bool()
});

export default function ({ initialValues }) {
    const [open, setOpen] = React.useState(false);

    const queryClient = useQueryClient();
    const { mutateAsync } = useMutation(branch.UpdateBranch);

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
                                queryClient.invalidateQueries('branches');
                                handleClose();
                            })
                            .catch((e) => actions.setFieldError('submit', e))
                            .finally(() => actions.setSubmitting(false));
                    }}
                    validationSchema={validationSchema}
                >
                    {({ handleSubmit, submitForm, isSubmitting, errors }) => (
                        <form noValidate onSubmit={handleSubmit}>
                            <DialogTitle sx={{ fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                Edit Branch
                                <IconButton onClick={handleClose} size="small" aria-label="Close">
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
                                            <TextField name="name" placeholder="Name" />
                                            <TextField name="tin" placeholder="TIN Number" />
                                        </Stack>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Divider />
                                    </Grid>
                                    <Grid item xs={3}>
                                        <Typography className="required" variant="caption">
                                            Address
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={9}>
                                        <TextField
                                            multiline
                                            rows={3}
                                            maxRows={3}
                                            name="streetAddress"
                                            placeholder="Full Address"
                                        />
                                        {/* <Stack spacing={2}>
                                            <TextField name="streetAddress" placeholder="Street Address" />
                                            <TextField name="city" placeholder="City" />
                                            <Stack direction="row" width="100%" spacing={1}>
                                                <TextField name="state" placeholder="State" />
                                                <TextField name="postalCode" placeholder="Postal Code" />
                                            </Stack>
                                        </Stack> */}
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Divider />
                                    </Grid>
                                    <Grid item xs={3}>
                                        <Typography variant="caption">
                                            Contact
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={9}>
                                        <Stack spacing={2}>
                                            <TextField name="contactNumber" placeholder="Phone" />
                                            <TextField name="emailAddress" placeholder="Email" />
                                        </Stack>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Divider />
                                    </Grid>
                                    <Grid item xs={3}>
                                        <Typography variant="caption">Active</Typography>
                                    </Grid>
                                    <Grid item xs={9}>
                                        <Field name="isActive">{({ field }) => <Switch {...field} />}</Field>
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
