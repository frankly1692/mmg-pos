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
import user from 'api/user';

import RoleSelector from './RoleSelector';
import BranchSelector from './BranchSelector';
import TextField from 'ui-component/TextField';
import Switch from 'ui-component/switch';
import { omit } from 'lodash';

const validationSchema = Yup.object().shape({
    firstName: Yup.string().required('First name is required'),
    lastName: Yup.string().required('Last name is required'),
    username: Yup.string().required('Username is required'),
    branches: Yup.array().of(Yup.object()).min(1, 'At least one branch is required').required('At least one branch is required'),
    role: Yup.object().required('Role is required'),
    isActive: Yup.bool()
});

export default function ({ initialValues }) {
    const [open, setOpen] = React.useState(false);

    const queryClient = useQueryClient();
    const { mutateAsync } = useMutation(user.UpdateUser);

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
                        mutateAsync({
                            ...omit(values, ['role', 'branches', '_id']),
                            roleId: values?.role?._id,
                            branchIds: values?.branches.map((branch) => branch.id)
                        })
                            .then(() => {
                                queryClient.invalidateQueries('users');
                                handleClose();
                            })
                            .catch((e) => actions.setFieldError('submit', e))
                            .finally(() => actions.setSubmitting(false));
                    }}
                    validationSchema={validationSchema}
                >
                    {({ handleSubmit, submitForm, isSubmitting }) => (
                        <form noValidate onSubmit={handleSubmit}>
                            <DialogTitle sx={{ fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                Edit User
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
                                        <Stack direction="row" spacing={1}>
                                            <TextField name="firstName" placeholder="First name" />
                                            <TextField name="lastName" placeholder="Last name" />
                                        </Stack>
                                    </Grid>
                                    <Grid item xs={3}>
                                        <Typography className="required" variant="caption">
                                            Username
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={9}>
                                        <TextField name="username" helperText placeholder="Username" />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Divider />
                                    </Grid>
                                    <Grid item xs={3}>
                                        <Typography className="required" variant="caption">
                                            Role
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={9}>
                                        <RoleSelector />
                                    </Grid>
                                    <Grid item xs={3}>
                                        <Typography className="required" variant="caption">
                                            Branch
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={9}>
                                        <BranchSelector />
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
