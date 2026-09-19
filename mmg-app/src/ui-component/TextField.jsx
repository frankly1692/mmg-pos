import { TextField } from '@mui/material';
import { useField } from 'formik';

export default function ({ helperText, required, ...props }) {
    const [field, meta, helper] = useField(props.name);
    const { error, touched } = meta;
    const hasError = Boolean(error || (!field.value && touched && required));

    return (
        <TextField
            size="small"
            fullWidth={!props.disableFullWidth}
            error={hasError}
            helperText={hasError ? error : typeof helperText === 'boolean' ? undefined : helperText}
            {...props}
            {...field}
        />
    );
}
