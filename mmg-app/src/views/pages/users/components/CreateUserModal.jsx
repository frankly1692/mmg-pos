import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import AddIcon from '@mui/icons-material/Add';

import Grid from '@mui/material/Grid';
import { Divider, IconButton, InputAdornment, Stack, Typography } from '@mui/material';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { useMutation, useQueryClient } from 'react-query';
import user from 'api/user';

import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CloseIcon from '@mui/icons-material/Close';
import RoleSelector from './RoleSelector';
import BranchSelector from './BranchSelector';
import TextField from 'ui-component/TextField';
import { omit } from 'lodash';

const validationSchema = Yup.object().shape({
    firstName: Yup.string().required('First name is required'),
    lastName: Yup.string().required('Last name is required'),
    username: Yup.string().required('Username is required'),
    password: Yup.string().required('Password is required'),
    branches: Yup.array().of(Yup.object()).min(1, 'At least one branch is required').required('At least one branch is required'),
    role: Yup.object().required('Role is required')
});

export default function () {
    const [open, setOpen] = React.useState(false);
    const [showPassword, setShowPassword] = React.useState(false);

    const queryClient = useQueryClient();
    const { mutateAsync } = useMutation(user.CreateUser);

    const handleClickOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const handleSubmit = async (values, actions) => {
        try {
            const allUsers = await user.GetAllUser();
            const userExists = allUsers.some((user) => user.username === values.username);
            if (userExists) {
                actions.setFieldError('username', 'Username already exists');
                actions.setSubmitting(false);
            } else {
                await mutateAsync({
                    ...omit(values, ['role', 'branches']),
                    roleId: values?.role?._id,
                    branchIds: values?.branches.map((branch) => branch.id)
                });
                queryClient.invalidateQueries('users');
                handleClose();
            }
        } catch (e) {
            actions.setFieldError('submit', e.message);
            actions.setSubmitting(false);
        }
    };

    const renderButton = () => (
        <Button startIcon={<AddIcon />} onClick={handleClickOpen} variant="contained" color="primary">
            New User
        </Button>
    );

    if (!open) return renderButton();

    return (
        <React.Fragment>
            {renderButton()}
            <Dialog open={open} maxWidth="xs" fullWidth onClose={handleClose}>
                <Formik
                    initialValues={{
                        username: '',
                        firstName: '',
                        lastName: '',
                        branches: [],
                        role: null,
                        password: ''
                    }}
                    onSubmit={handleSubmit}
                    validationSchema={validationSchema}
                >
                    {({ handleSubmit, submitForm, isSubmitting }) => (
                        <form noValidate onSubmit={handleSubmit}>
                            <DialogTitle sx={{ fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                New User
                                <IconButton onClick={handleClose} size="small" aria-label="Close">
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </DialogTitle>
                            <DialogContent sx={{ mt: 1 }}>
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
                                    <Grid item xs={3}>
                                        <Typography className="required" variant="caption">
                                            Password
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={9}>
                                        <TextField
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            helperText
                                            placeholder="Password"
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="large">
                                                            {showPassword ? <Visibility /> : <VisibilityOff />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
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
                                            Branches
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={9}>
                                        <BranchSelector />
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
