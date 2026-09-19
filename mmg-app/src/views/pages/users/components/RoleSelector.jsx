import * as React from 'react';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useQuery } from 'react-query';
import role from 'api/role';
import { InputAdornment } from '@mui/material';
import { omit, startCase } from 'lodash';
import { useField } from 'formik';

export default function () {
    const [open, setOpen] = React.useState(false);
    const { data, refetch, isLoading } = useQuery('role-selector', role.GetAllRoles);

    const [{ value }, { error, touched }, { setValue }] = useField('role');

    React.useEffect(() => {
        if (open) {
            refetch();
        }
    }, [open]);

    return (
        <Autocomplete
            value={value || null}
            onChange={(e, newValue) => setValue(newValue)}
            disabled={isLoading && !data}
            open={open}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
            isOptionEqualToValue={(option, value) => option._id === value._id}
            getOptionLabel={(option) => startCase(option?.name)}
            options={data || []}
            loading={isLoading}
            renderInput={(params) => (
                <TextField
                    {...omit(params, 'sx')}
                    size="small"
                    placeholder="Search"
                    InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchRoundedIcon sx={{ color: 'gray', fontSize: 18 }} />
                            </InputAdornment>
                        ),
                        endAdornment: (
                            <React.Fragment>
                                {isLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                {params.InputProps.endAdornment}
                            </React.Fragment>
                        )
                    }}
                    error={Boolean(error && touched)}
                    helperText={touched ? error : undefined}
                />
            )}
        />
    );
}
