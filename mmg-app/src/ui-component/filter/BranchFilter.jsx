import { MenuItem, TextField } from '@mui/material';
import { isArray, startCase } from 'lodash';
import { memo, useEffect, useState } from 'react';

export const DEFAULT_BRANCH_FILTER = 'all';

export default memo(({ filter, onChange, values, options, setValues, ...otherProps }) => {
    useEffect(() => {
        let data = values || [];
        if (filter == DEFAULT_BRANCH_FILTER) setValues(data);
        else data = data?.filter(({ branch }) => branch.name == filter);

        setValues(data);
    }, [values, filter]);

    return (
        <TextField
            select
            size="small"
            label="Branch"
            value={filter}
            onChange={(e) => onChange(e?.target?.value)}
            sx={{ minWidth: 150 }}
            {...otherProps}
        >
            <MenuItem value={DEFAULT_BRANCH_FILTER}>All</MenuItem>
            {options
                ? options.map((option) => (
                      <MenuItem key={option} value={option}>
                          {startCase(option)}
                      </MenuItem>
                  ))
                : values &&
                  Object.keys(Object.groupBy(values, ({ branch }) => branch?.name))
                      .filter((key) => !key || key != 'undefined')
                      .map((branch) => (
                          <MenuItem key={branch} value={branch}>
                              {startCase(branch)}
                          </MenuItem>
                      ))}
        </TextField>
    );
});
