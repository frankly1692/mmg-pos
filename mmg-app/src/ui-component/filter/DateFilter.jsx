import { MenuItem, TextField } from '@mui/material';
import { isArray, startCase } from 'lodash';
import { memo, useEffect, useState } from 'react';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';

export const DEFAULT_DATE_FILTER = 1;
export const DateFilterEnum = Object.freeze({
    ALL: 0,
    TODAY: 1,
    YESTERDAY: 2,
    THIS_WEEK: 3,
    THIS_MONTH: 4,
    THIS_YEAR: 5,
    LAST_WEEK: 6,
    LAST_MONTH: 7,
    LAST_YEAR: 8,
    CUSTOM_FILTER: 9,
    CUSTOM_DATE: 10
});

export const DateFilterOptions = [
    { value: DateFilterEnum.ALL, label: 'All' },
    { value: DateFilterEnum.TODAY, label: 'Today' },
    { value: DateFilterEnum.YESTERDAY, label: 'Yesterday' },
    { value: DateFilterEnum.THIS_WEEK, label: 'This Week' },
    { value: DateFilterEnum.THIS_MONTH, label: 'This Month' },
    { value: DateFilterEnum.THIS_YEAR, label: 'This Year' },
    { value: DateFilterEnum.LAST_WEEK, label: 'Last Week' },
    { value: DateFilterEnum.LAST_MONTH, label: 'Last Month' },
    { value: DateFilterEnum.LAST_YEAR, label: 'Last Year' },
    { value: DateFilterEnum.CUSTOM_DATE, label: 'Custom Month Year' },
    { value: DateFilterEnum.CUSTOM_FILTER, label: 'Custom Date Range' }
];

export const generateDateName = (dateFilter, customDate) => {
    const today = moment();
    const isoFormat = 'YYYY-MM-DD';
    const monthYearFormat = 'MMMM-YYYY';
    const yearFormat = 'YYYY';

    switch (dateFilter) {
        case DateFilterEnum.ALL:
            return '';
        case DateFilterEnum.TODAY:
            return today.format(isoFormat);
        case DateFilterEnum.YESTERDAY:
            return today.subtract(1, 'day').format(isoFormat);
        case DateFilterEnum.THIS_WEEK:
            return today.startOf('week').format(isoFormat) + '-' + today.endOf('week').format(isoFormat);
        case DateFilterEnum.THIS_MONTH:
            return today.format(monthYearFormat).toLocaleLowerCase();
        case DateFilterEnum.THIS_YEAR:
            return today.format(yearFormat);
        case DateFilterEnum.LAST_WEEK:
            return (
                today.subtract(1, 'week').startOf('week').format(isoFormat) +
                '-' +
                today.subtract(1, 'week').endOf('week').format(isoFormat)
            );
        case DateFilterEnum.LAST_MONTH:
            return today.subtract(1, 'month').format(monthYearFormat);
        case DateFilterEnum.LAST_YEAR:
            return today.subtract(1, 'year').format(yearFormat);
        case DateFilterEnum.CUSTOM_DATE:
            return moment(customDate.date).format(monthYearFormat);
        case DateFilterEnum.CUSTOM_FILTER:
            return moment(customDate.startDate).format(monthYearFormat) + '-' + moment(customDate.endDate).format(monthYearFormat);
        default:
            return '';
    }
};

export default memo(({ filter, onChange, customDate, onChangeCustomDate }) => {
    return (
        <LocalizationProvider dateAdapter={AdapterMoment}>
            <TextField
                select
                size="small"
                label="Date"
                value={filter}
                onChange={(e) => {
                    onChange(e?.target?.value);
                    onChangeCustomDate({});
                }}
                sx={{ minWidth: 200 }}
            >
                {DateFilterOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                        {option.label}
                    </MenuItem>
                ))}
            </TextField>
            {filter == DateFilterEnum.CUSTOM_DATE && (
                <DatePicker
                    label="Custom Month & Year"
                    disableFuture
                    value={customDate?.date}
                    onAccept={(value) => onChangeCustomDate((date) => ({ ...date, date: value }))}
                    // views={['year', 'month']}
                    slotProps={{
                        textField: { size: 'small' },
                        actionBar: {
                            actions: ['clear', 'today', 'accept']
                        }
                    }}
                />
            )}
            {filter == DateFilterEnum.CUSTOM_FILTER && (
                <>
                    <DatePicker
                        disableFuture
                        value={customDate?.startDate}
                        onAccept={(value) => onChangeCustomDate((date) => ({ ...date, startDate: value }))}
                        openTo="year"
                        views={['year', 'month', 'day']}
                        slotProps={{
                            textField: { size: 'small' },
                            actionBar: {
                                actions: ['clear', 'today', 'accept']
                            }
                        }}
                        label="Start Date"
                    />
                    <DatePicker
                        disableFuture
                        disabled={!customDate?.startDate}
                        onAccept={(value) => onChangeCustomDate((date) => ({ ...date, endDate: value }))}
                        openTo="year"
                        shouldDisableDate={(date) => customDate?.startDate?.isAfter(date, 'date')}
                        shouldDisableMonth={(month) => customDate.startDate?.isAfter(month, 'month')}
                        shouldDisableYear={(year) => customDate.startDate?.isAfter(year, 'year')}
                        views={['year', 'month', 'day']}
                        slotProps={{
                            textField: { size: 'small' },
                            actionBar: {
                                actions: ['clear', 'today', 'accept']
                            }
                        }}
                        label="End Date"
                    />
                </>
            )}
        </LocalizationProvider>
    );
});
