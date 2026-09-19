import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import * as Yup from 'yup';
import { Formik } from 'formik';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import AuthCardWrapper from '../AuthCardWrapper';
import logo from '../../../assets/images/company-logo.png';
import { useMutation } from 'react-query';
import { useTheme } from '@mui/system';
import { useEffect, useState } from 'react';
import { Link, TextField } from '@mui/material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from 'providers/AuthProvider';
import FooterWatermark from 'ui-component/FooterWatermark';
import ConnectionSection from 'layout/MainLayout/Header/ConnectionSection';
import useServerConnection from 'hooks/useServerConnection';

const validationSchema = Yup.object().shape({
    username: Yup.string().max(255).required('Username is required'),
    password: Yup.string().max(255).required('Password is required')
});

const Login = () => {
    const { loginUser } = useAuth();
    const { state } = useLocation();
    const redirect = state?.redirect;

    const isConnected = useServerConnection();

    const theme = useTheme();
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const { mutateAsync } = useMutation(loginUser);

    const handleSubmit = (values, actions) => {
        mutateAsync(values)
            .then(() => navigate(redirect ? redirect : '/', { replace: true }))
            .catch((e) => actions.setFieldError('submit', e))
            .finally(() => actions.setSubmitting(false));
    };

    return (
        <Grid container justifyContent="center" alignItems="center" sx={{ minHeight: 'calc(100vh - 68px)' }}>
            <Grid item sx={{ m: { xs: 1, sm: 3 }, mb: 0 }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    <ConnectionSection isConnected={isConnected} />
                </div>
                <AuthCardWrapper>
                    <Grid container spacing={2} alignItems="center" justifyContent="center">
                        <Grid item sx={{ mb: 1 }}>
                            <img style={{ height: 60 }} src={logo} loading="lazy" />
                        </Grid>
                        <Grid item xs={12}>
                            <Grid container direction={{ xs: 'column-reverse', md: 'row' }} alignItems="center" justifyContent="center">
                                <Grid item>
                                    <Stack alignItems="center" justifyContent="center">
                                        <Typography variant="subtitle2" fontWeight="medium" color="primary">
                                            Sign in to MMG
                                        </Typography>
                                        <Typography variant="subtitle2" fontWeight="medium">
                                            Enter your credentials to continue
                                        </Typography>
                                    </Stack>
                                </Grid>
                            </Grid>
                        </Grid>
                        <Grid item xs={12}>
                            <Formik
                                initialValues={{
                                    username: '',
                                    password: ''
                                }}
                                onSubmit={handleSubmit}
                                validationSchema={validationSchema}
                            >
                                {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values }) => (
                                    <form noValidate onSubmit={handleSubmit}>
                                        <TextField
                                            fullWidth
                                            name="username"
                                            label="Username"
                                            onBlur={handleBlur}
                                            onChange={handleChange}
                                            error={Boolean(touched.username && errors.username)}
                                            helperText={touched.username && errors.username}
                                            sx={{ ...theme.typography.customInput }}
                                        />
                                        <TextField
                                            fullWidth
                                            name="password"
                                            label="Password"
                                            onBlur={handleBlur}
                                            onChange={handleChange}
                                            type={showPassword ? 'text' : 'password'}
                                            error={Boolean(touched.password && errors.password)}
                                            helperText={touched.password && errors.password && errors.password}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="large">
                                                            {showPassword ? <Visibility /> : <VisibilityOff />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                )
                                            }}
                                            sx={{ ...theme.typography.customInput }}
                                        />
                                        {errors.submit && (
                                            <Box sx={{ mt: 1 }}>
                                                <FormHelperText sx={{ textAlign: 'center' }} error>
                                                    {errors.submit?.message}
                                                </FormHelperText>
                                            </Box>
                                        )}

                                        <Box sx={{ my: 2 }}>
                                            <Button
                                                disableElevation
                                                disabled={isSubmitting}
                                                fullWidth
                                                size="large"
                                                type="submit"
                                                variant="contained"
                                                sx={{ py: 1.2, borderRadius: 3 }}
                                            >
                                                Sign in
                                            </Button>
                                        </Box>
                                        <Stack direction="row" textAlign='center' spacing={1}>
                                            If you forgot your password, Please Contact System Admin. <br />
                                            {import.meta.env.VITE_APP_VERSION}
                                        </Stack>
                                    </form>
                                )}
                            </Formik>
                        </Grid>
                    </Grid>
                </AuthCardWrapper>
            </Grid>
            <FooterWatermark />
        </Grid>
    );
};

export default Login;
