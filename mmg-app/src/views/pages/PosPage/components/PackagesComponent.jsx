import React, { memo, useState, useEffect } from 'react';
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
    Stack,
    CircularProgress
} from '@mui/material';
import { FiSearch } from 'react-icons/fi';
import { IoCloseOutline, IoRefresh } from 'react-icons/io5';

// component import
import { Box, useTheme } from '@mui/system';
import _package from 'api/package';
import { useQuery } from 'react-query';
import { useHotkeys } from 'react-hotkeys-hook';
import { toLower } from 'lodash';

export default memo(function ({ customer, selectedPackages, handleAddItem, disabled, setIsPackageOrPromoAdded, hideTitle }) {

    console.log('customer', customer)

    const { data: packages, isLoading, refetch, isRefetching } = useQuery(
        'packages',
        _package.GetAllPackages,
    );

    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const [discountApplied, setDiscountApplied] = useState(false);
    const [discountAppliedPackage, setDiscountAppliedPackage] = useState(false);
    const theme = useTheme();

    // Update discountAppliedX based on selectedPackages
    useEffect(() => {
        if (selectedPackages === null || selectedPackages.length === 0) {
            setDiscountApplied(false);
            setDiscountAppliedPackage(false);
        }
    }, [selectedPackages])

    const [filteredPackages, setFilteredPackages] = useState([]);

    useEffect(() => {
        const filterPackages = () => {
            const filtered = packages?.filter(item => {
                // ... (your existing customerType filtering logic) ...

                // packageForMemberType Filtering:
                if (item.packageForMemberType) {
                    // If the package is for both, include it ONLY if customer is NOT corporate
                    if (item.packageForMemberType === "all") {
                        return customer.customerType !== 'corporate';
                    }

                    // Otherwise, check if the customer's memberType matches
                    return item.packageForMemberType.includes(customer.customerType);
                }

                // If packageForMemberType is not defined, include the package (optional)
                return true;
            });
            setFilteredPackages(filtered);
        };

        if (customer) { // Only filter if customer data is available
            filterPackages();
        }
    }, [customer, packages]); // Trigger on customer and packages change

    const onToggle = () => {
        if (disabled) return;
        setOpen((open) => !open);
        setSearch('');
    };

    const handleSelectItem = (item) => () => {
        console.log('item', item);

        if (item.packageType === 'package' || item.packageType === 'promo') {
            setDiscountApplied(true);
            setIsPackageOrPromoAdded(true);
        } else if (item.packageType === 'package' || item.packageType === 'promo') {
            setDiscountAppliedPackage(true);
            setIsPackageOrPromoAdded(true);
        }

        if (open) {
            onToggle();
        }
        handleAddItem(item);
    };

    const selectFirstItem = (search) => {
        const firstItem = packages.filter((item) => toLower(item.name).startsWith(toLower(search)))?.[0];
        return firstItem;
    };

    const handleKeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();

            if (packages && packages.length == 0) {
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

    useHotkeys('ctrl+p', onToggle, { preventDefault: true });

    console.log('filteredPackages', filteredPackages)


    if (isLoading) return null;

    return (
        <Box>
            {!hideTitle && (
                <Typography mb={1} variant="h4">
                    Packages
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
                        disabled={discountApplied || disabled || discountAppliedPackage}
                        variant="outlined"
                    >
                        Search (Ctrl+P)
                    </Button>
                </Grid>
                {filteredPackages && filteredPackages.length > 0 ? (
                    filteredPackages?.map((item, index) => {
                        const selected = selectedPackages.includes(item._id);
                        const isDisabled = discountApplied && item.packageType === 'package';
                        // const isDisabledNoDiscountPackage = discountAppliedPackage && item.packageType === 'package' && item.discount === 0 || discountAppliedPackage && item.packageType === 'promo';
                        const isDisabledNoDiscountPackage = discountAppliedPackage && item.packageType === 'package' || discountAppliedPackage && item.packageType === 'promo';
                        return (
                            <>
                                <Grid item>
                                    <Button
                                        sx={{
                                            py: 1,
                                            borderRadius: 3,
                                            textWrap: 'nowrap',
                                            overflow: 'hidden',
                                            ...(selected
                                                ? {
                                                    borderColor: 'primary.main',
                                                    color: 'primary.main',
                                                    borderWidth: '2px !important',
                                                    fontWeight: 'bold'
                                                }
                                                : {
                                                    borderColor: theme.palette.grey[500]
                                                })
                                        }}
                                        fullWidth
                                        key={index}
                                        disabled={disabled || isDisabled || isDisabledNoDiscountPackage}
                                        variant="outlined"
                                        color="dark"
                                        onClick={selected ? null : handleSelectItem(item)}
                                    >
                                        {item.name}
                                    </Button>
                                </Grid>
                            </>
                        );
                    })
                ) : (
                    <span>No packages available</span>
                )}
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
                            <Typography variant="h4">Select Package</Typography>
                            <Box flex={1} />
                            {
                                isRefetching || isLoading ? <CircularProgress size={20} />
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
                                '& .MuiOutlinedInput-notchedOutline': {},
                                bgcolor: 'white'
                            }}
                            value={search}
                            onKeyDown={handleKeydown}
                            onChange={(e) => setSearch(e.target?.value)}
                            size="small"
                            autoFocus
                        />
                        <Typography ml={1} mt={0.5} mb={1.5} variant="h6" color="primary.main">
                            Press 'Enter' to select the first item on the list.
                        </Typography>
                        <Box flex={1} flexBasis={80} overflow="auto">
                            <Grid container spacing={1}>
                                {packages && packages.length > 0 ? (
                                    packages
                                        .filter((item) => toLower(item.name).startsWith(toLower(search)))
                                        .map((item, index) => {
                                            const selected = selectedPackages.includes(item.name);
                                            return (
                                                <>
                                                    <Grid item xs={4}>
                                                        <Button
                                                            sx={{
                                                                py: 2,
                                                                borderRadius: 3,
                                                                textWrap: 'nowrap',
                                                                overflow: 'hidden'
                                                            }}
                                                            fullWidth
                                                            key={index}
                                                            variant="outlined"
                                                            color="dark"
                                                            onClick={selected ? null : handleSelectItem(item)}
                                                        >
                                                            {item.name}
                                                        </Button>
                                                    </Grid>
                                                </>
                                            );
                                        })
                                ) : (
                                    <span>No packages available</span>
                                )}
                            </Grid>
                        </Box>
                    </DialogContent>
                </Dialog>
            )}
        </Box>
    );
});
