import * as React from 'react';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { InputAdornment } from '@mui/material';
import { omit, startCase } from 'lodash';
import { useField } from 'formik';

export const StatusOptions = [
    { name: 'Active', id: 1 },
    { name: 'Hold', id: 2 },
    { name: 'Cancelled', id: 3 },
    { name: 'Completed', id: 4 },
    { name: 'Refunded', id: 5 }
];
export default function () {
    const [open, setOpen] = React.useState(false);

    const [{ value }, { error, touched }, { setValue }] = useField('status');

    return (
        <Autocomplete
            value={value || null}
            onChange={(e, newValue) => setValue(newValue)}
            open={open}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            getOptionLabel={(option) => startCase(option?.name)}
            options={StatusOptions}
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
                        )
                    }}
                    error={Boolean(error && touched)}
                    helperText={touched ? error : undefined}
                />
            )}
        />
    );
}
