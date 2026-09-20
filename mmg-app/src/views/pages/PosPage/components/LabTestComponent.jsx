import React, { memo, useState } from 'react';
import {
    Typography,
    Grid,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Paper,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TextField,
    IconButton,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Stack,
    CircularProgress
} from '@mui/material';
import { FiSearch } from 'react-icons/fi';
import { IoCloseOutline, IoRefresh } from 'react-icons/io5';

// component import
import { Box, useTheme } from '@mui/system';
import { useQuery } from 'react-query';
import { useHotkeys } from 'react-hotkeys-hook';
import { toLower } from 'lodash';
import service from 'api/service';

export default memo(function ({ packageTests, selectedLabTest, handleAddItem, disabled, hideTitle }) {
    const { data: services, isLoading, isRefetching, refetch } = useQuery('services', service.GetAllServices);

    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [open, setOpen] = useState(false);
    const theme = useTheme();

    const onToggle = () => {
        if (disabled) return;
        setOpen((open) => !open);
        setSearch('');
    };

    const handleSelectItem = (item) => () => {
        onToggle();
        handleAddItem(item);
    };

    const selectFirstItem = (search) => {
        const firstItem = services.filter((item) => toLower(item.name).startsWith(toLower(search)))?.[0];
        return firstItem;
    };

    const handleKeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();

            if (services && services.length === 0) {
                onToggle();
                return;
            }

            const firstItem = selectFirstItem(search);
            if (firstItem) {
                handleSelectItem(firstItem)();
            }
            return;
        }

        if (e.key === 'Backspace' && !e?.target?.value) {
            e.preventDefault();
            onToggle();
            return;
        }
    };

    useHotkeys('ctrl+l', onToggle, { preventDefault: true });

    const handleCategoryChange = (event) => {
        setCategoryFilter(event.target.value);
    };

    if (isLoading) return null;

    const filteredServices = services?.filter(
        (service) => toLower(service.name).includes(toLower(search)) && (!categoryFilter || service.category?.name === categoryFilter)
    );

    console.log('packageTests', packageTests)

    return (
        <Box flex={1} display="flex" flexDirection="column">
            {!hideTitle && (
                <Typography mb={1} variant="h4">
                    Lab Tests
                </Typography>
            )}
            <Grid container spacing={1}>
                <Grid item>
                    <Button
                        sx={{
                            py: 1,
                            borderRadius: 3,
                            bgcolor: 'white'
                        }}
                        onClick={onToggle}
                        startIcon={<FiSearch size={17} style={{ marginBottom: 2 }} />}
                        fullWidth
                        disabled={disabled}
                        variant="outlined"
                    >
                        Search (Ctrl+L)
                    </Button>
                </Grid>
                {services?.slice(0, 20)?.map((service, index) => {
                    const isLabTestInPackage = packageTests?.some(
                        (i) => i.source === 'package' && i.labTest.some((itemObj) => itemObj.name === service?.name)
                    );
                    const selected = selectedLabTest?.some((test) => test === service?.name);

                    return (
                        <Grid item xs="auto" key={index}>
                            <Button
                                variant="outlined"
                                color={selected ? 'primary' : 'dark'}
                                sx={{
                                    py: 1,
                                    borderRadius: 3,
                                    borderColor: selected ? 'primary.main' : theme.palette.grey[500],
                                    color: selected ? 'primary.main' : 'inherit',
                                    borderWidth: selected ? '2px !important' : '1px',
                                    fontWeight: selected ? 'bold' : 'normal'
                                }}
                                onClick={() => handleAddItem(service)}
                                disabled={disabled || isLabTestInPackage}
                            >
                                {service.name}
                            </Button>
                        </Grid>
                    );
                })}
            </Grid>
            {open && (
                <Dialog
                    open
                    disableRestoreFocus
                    onClose={onToggle}
                    maxWidth="sm"
                    fullWidth
                    sx={{
                        '& .MuiPaper-root': {
                            height: '65%'
                        }
                    }}
                >
                    <DialogTitle sx={{ pt: 2 }}>
                        <Stack direction='row' spacing={1} alignItems='center'>
                            <Typography variant="h4">Select Laboratory Test</Typography>
                            <Box flex={1} />
                            {
                                isRefetching || isLoading ? <CircularProgress size={20}/>
                                : <Button startIcon={<IoRefresh />} onClick={refetch} size='small'>Refresh</Button>
                            }
                            <IconButton onClick={onToggle}>
                                <IoCloseOutline />
                            </IconButton>
                        </Stack>
                    </DialogTitle>
                    <DialogContent sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <TextField
                            placeholder="Search"
                            fullWidth
                            sx={{
                                pt: 1,
                                bgcolor: 'white'
                            }}
                            value={search}
                            onKeyDown={handleKeydown}
                            onChange={(e) => setSearch(e.target?.value)}
                            size="small"
                            autoFocus
                        />
                        <FormControl fullWidth sx={{ mt: 2 }}>
                            <InputLabel>Category</InputLabel>
                            <Select value={categoryFilter} onChange={handleCategoryChange} label="Category">
                                <MenuItem value="">
                                    <em>All</em>
                                </MenuItem>
                                {Array.from(new Set(services?.map((service) => service.category?.name))).map((category, index) => (
                                    <MenuItem key={index} value={category}>
                                        {category}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Typography ml={1} mt={0.5} mb={1.5} variant="h6" color="primary.main">
                            Press 'Enter' to select the first item on the list.
                        </Typography>
                        <Box flex={1} pb={2} flexBasis={80} overflow="auto">
                            <Grid container spacing={1}>
                                {filteredServices?.map((service, index) => {
                                    const isLabTestInPackage = packageTests?.some(
                                        (i) => i.source === 'package' && i.labTest.some((itemObj) => itemObj.name === service?.name)
                                    );
                                    const selected = selectedLabTest?.some((test) => test === service?.name);

                                    return (
                                        <Grid item xs="auto" key={index}>
                                            <Button
                                                variant="outlined"
                                                color={selected ? 'primary' : 'dark'}
                                                sx={{
                                                    py: 1,
                                                    borderRadius: 3,
                                                    borderColor: selected ? 'primary.main' : theme.palette.grey[500],
                                                    color: selected ? 'primary.main' : 'inherit',
                                                    borderWidth: selected ? '2px !important' : '1px',
                                                    fontWeight: selected ? 'bold' : 'normal'
                                                }}
                                                onClick={() => handleAddItem(service)}
                                                disabled={disabled || isLabTestInPackage}
                                            >
                                                {service.name}
                                            </Button>
                                        </Grid>
                                    );
                                })}
                            </Grid>
                        </Box>
                    </DialogContent>
                </Dialog>
            )}
        </Box>
    );
});
