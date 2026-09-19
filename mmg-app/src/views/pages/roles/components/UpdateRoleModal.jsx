import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import EditIcon from '@mui/icons-material/Edit';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Formik } from 'formik';
import * as Yup from 'yup';
import Switch from 'ui-component/switch';
import TextField from 'ui-component/TextField';
import { useMutation, useQueryClient } from 'react-query';
import role from 'api/role';
import { snakeCase, toLower } from 'lodash';

const validationSchema = Yup.object().shape({
    name: Yup.string().required('Role name is required')
});

const features = [
    'Dashboard',
    'POS',
    'Customers',
    'Packages',
    'Lab Test',
    'Lab Test Categories',
    'Discounts',
    'Branches',
    'Doctors',
    'Corporates',
    'Transactions'
];

const COLUMN = Object.freeze({
    FULL_ACCESS: 'full_access',
    READ: 'read',
    CREATE: 'create',
    UPDATE: 'update'
});

const formatKey = (key) => toLower(snakeCase(key));

const mapPermissionsToFormikValues = (authorizations) => {
    const permissions = {};
    authorizations.forEach(({ resource, permissions: perms }) => {
        permissions[formatKey(resource)] = perms;
    });
    return permissions;
};

export default function ({ initialValues }) {
    const [open, setOpen] = React.useState(false);
    const [permissions, setPermissions] = React.useState({});

    const queryClient = useQueryClient();
    const { mutateAsync } = useMutation(role.UpdateRole);

    React.useEffect(() => {
        if (initialValues) {
            const { name, authorizations } = initialValues;
            setPermissions(mapPermissionsToFormikValues(authorizations));
            initialValues = {
                name,
                permissions: mapPermissionsToFormikValues(authorizations)
            };
        }
    }, [initialValues]);

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    const toggleColumn = (column, row) => (e) => {
        const value = e.target.checked;

        if (column && row) {
            const newPermissions = {
                ...permissions,
                [row]: {
                    ...permissions?.[row],
                    [column]: value
                }
            };
            setPermissions(newPermissions);
            return;
        }

        if (row) {
            const newPermissions = {
                ...permissions,
                [row]: {
                    [COLUMN.CREATE]: value,
                    [COLUMN.READ]: value,
                    [COLUMN.UPDATE]: value
                }
            };

            setPermissions(newPermissions);
            return;
        }

        if (column) {
            const newPermissions = features.reduce((prev, curr) => {
                const key = formatKey(curr);
                const permission = permissions?.[key];
                return {
                    ...prev,
                    [key]: {
                        ...permission,
                        [column]: value
                    }
                };
            }, {});

            setPermissions(newPermissions);
            return;
        }
    };

    const renderSwitch = (column, row) => {
        let checked;

        console.log('column', column, row);

        const isEveryColumnChecked = (row) => {
            let values = permissions?.[row];
            values = values ? Object.values(values) : [];
            return values.length === 3 && values.every((permission) => !!permission);
        };

        const isEveryRowChecked = (column) => {
            const values = Object.entries(permissions);
            console.log(values);
            return (
                values.length === features.length && values.every(([key, value]) => (!column ? isEveryColumnChecked(key) : !!value[column]))
            );
        };

        if (column && row) checked = permissions?.[row]?.[column];
        else if (column) checked = isEveryRowChecked(column);
        else if (row) checked = isEveryColumnChecked(row);

        return <Switch checked={checked === true} onChange={toggleColumn(column, row)} />;
    };

    const renderButton = () => (
        <Button onClick={handleClickOpen} startIcon={<EditIcon fontSize="small" />} variant="outlined" size="small">
            Edit
        </Button>
    );

    const handleFormSubmit = async (values, actions) => {
        try {
            const authorizations = Object.keys(permissions).map((key) => ({
                resource: key,
                permissions: permissions[key]
            }));

            await mutateAsync({
                id: initialValues?.id,
                name: values.name,
                authorizations
            });
            queryClient.invalidateQueries('roles');
            handleClose();
        } catch (e) {
            actions.setFieldError('submit', e.message);
        } finally {
            actions.setSubmitting(false);
        }
    };

    if (!open) return renderButton();

    console.log('initialValues', initialValues);

    return (
        <React.Fragment>
            {renderButton()}
            <Dialog open={open} maxWidth="md" onClose={handleClose}>
                <Formik
                    initialValues={{
                        name: initialValues?.name || '',
                        permissions
                    }}
                    onSubmit={handleFormSubmit}
                    validationSchema={validationSchema}
                >
                    {({ handleSubmit, submitForm, isSubmitting, handleChange, handleBlur, values }) => (
                        <form noValidate onSubmit={handleSubmit}>
                            <DialogTitle sx={{ fontSize: '1.1rem', mb: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                Edit Role
                                <IconButton onClick={handleClose} size="small" aria-label="Close">
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </DialogTitle>
                            <DialogContent>
                                <TextField
                                    name="name"
                                    label="Role Name"
                                    value={values.name || initialValues?.name || ''}
                                    onChange={handleChange} // Handle change for Formik
                                    onBlur={handleBlur} // Handle blur for Formik
                                    sx={{ mt: 1, mb: 2 }}
                                />
                                <Typography className="required" variant="h5" ml={1} mb={1} color="grey.400" fontWeight="regular">
                                    Authorizations
                                </Typography>
                                <TableContainer component={Paper}>
                                    <Table>
                                        <TableHead
                                            sx={{
                                                '& .MuiTableCell-root': {
                                                    fontSize: '1rem'
                                                }
                                            }}
                                        >
                                            <TableRow>
                                                <TableCell>Name</TableCell>
                                                <TableCell width={0} sx={{ textWrap: 'nowrap' }} align="center">
                                                    Full Access
                                                </TableCell>
                                                <TableCell width={0}>Read</TableCell>
                                                <TableCell width={0}>Create</TableCell>
                                                <TableCell width={0}>Update</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell sx={{ py: 1.3 }}>All Items</TableCell>
                                                <TableCell sx={{ py: 0, width: 0 }} align="center">
                                                    {renderSwitch(COLUMN.FULL_ACCESS, null)}
                                                </TableCell>
                                                <TableCell sx={{ py: 0, width: 0 }}>{renderSwitch(COLUMN.READ, null)}</TableCell>
                                                <TableCell sx={{ py: 0, width: 0 }}>{renderSwitch(COLUMN.CREATE, null)}</TableCell>
                                                <TableCell sx={{ py: 0, width: 0 }}>{renderSwitch(COLUMN.UPDATE, null)}</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {features.map((feature) => (
                                                <TableRow
                                                    key={feature}
                                                    sx={{
                                                        '&:last-child td, &:last-child th': {
                                                            border: 0
                                                        },
                                                        '& .MuiTableCell-root': {
                                                            fontSize: '1rem'
                                                        }
                                                    }}
                                                >
                                                    <TableCell sx={{ py: 1.3 }}>{feature}</TableCell>
                                                    <TableCell sx={{ py: 0, width: 0 }} align="center">
                                                        {renderSwitch(COLUMN.FULL_ACCESS, formatKey(feature))}
                                                    </TableCell>
                                                    <TableCell sx={{ py: 0, width: 0 }}>
                                                        {renderSwitch(COLUMN.READ, formatKey(feature))}
                                                    </TableCell>
                                                    <TableCell sx={{ py: 0, width: 0 }}>
                                                        {renderSwitch(COLUMN.CREATE, formatKey(feature))}
                                                    </TableCell>
                                                    <TableCell sx={{ py: 0, width: 0 }}>
                                                        {renderSwitch(COLUMN.UPDATE, formatKey(feature))}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
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
