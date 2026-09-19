import React from 'react'
import { useTheme } from '@emotion/react';

import {
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
} from '@mui/material';

import { RiDeleteBack2Fill } from 'react-icons/ri';
import { FaPesoSign } from 'react-icons/fa6';

const PromoContainer = ({ items, onRemoveItem }) => {
    const theme = useTheme();

    console.log('items', items);

    const handleRemove = (item) => {
        // You might have additional logic here, like confirmation dialogs
        onRemoveItem(item);
    };

    return (
        <Table sx={{ tableLayout: 'fixed' }}>
            <TableHead>
                <TableRow
                    sx={{
                        '& .MuiTableCell-root': {
                            py: 2,
                            border: 1,
                            borderColor: theme.palette.grey[200]
                        }
                    }}
                >
                    <TableCell sx={{ width: '40%' }}>Name</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell align="center">Qty</TableCell>
                    <TableCell align="center">Discount</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell sx={{ width: 0 }} align="center"></TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {items?.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={5} align="center">
                            No items added yet
                        </TableCell>
                    </TableRow>
                ) : (
                    items?.map((item, index) => (
                        <React.Fragment key={index}>
                            {index === 0 || items[index - 1].source !== item.source ? (
                                <TableRow
                                    key={`separator-${index}`}
                                    sx={{
                                        '& .MuiTableCell-root': {
                                            py: 2,
                                            backgroundColor: 'white !important'
                                        }
                                    }}
                                >
                                    <TableCell
                                        colSpan={5}
                                        sx={{
                                            fontSize: '1.05rem',
                                            fontWeight: 'bold',
                                            borderRight: '0 !important',
                                            borderLeft: 3,
                                            borderColor: theme.palette.primary.main,
                                            borderBottom: 0
                                        }}
                                    >
                                        Promo Items
                                    </TableCell>
                                    <TableCell
                                        sx={{
                                            borderLeft: '0 !important',
                                            borderRight: 1,
                                            borderColor: theme.palette.grey[200]
                                        }}
                                    >
                                        <Stack alignItems="center">
                                            {item.source !== 'labTest' && (
                                                <IconButton size="small" onClick={() => handleRemove(item)}>
                                                    <RiDeleteBack2Fill />
                                                </IconButton>
                                            )}
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ) : null}
                            {(item.labTest || []).map((subItem, subIndex) => (
                                <TableRow
                                    key={`${index}-${subIndex}`}
                                    sx={{
                                        '& .MuiTableCell-root': {
                                            backgroundColor: theme.palette.grey[50],
                                            py: 0.6,
                                            border: 1,
                                            borderColor: theme.palette.grey[200]
                                        }
                                    }}
                                >
                                    <TableCell
                                        sx={{
                                            pl: '60px !important',
                                            textWrap: 'nowrap',
                                            textOverflow: 'ellipsis',
                                            overflow: 'hidden',
                                            fontSize: '1.08rem'
                                        }}
                                    >
                                        {subItem.name}
                                    </TableCell>
                                    <TableCell>
                                        <FaPesoSign style={{ marginLeft: '3px', fontSize: '0.85rem' }} />{' '}
                                        {new Intl.NumberFormat().format(subItem.price)}
                                    </TableCell>
                                    <TableCell align="center">({subItem.qty})</TableCell>
                                    <TableCell>
                                        <FaPesoSign style={{ marginLeft: '3px', fontSize: '0.85rem' }} />{' '}
                                        {new Intl.NumberFormat().format(item.discount.value)}
                                    </TableCell>
                                    <TableCell>
                                        <FaPesoSign style={{ marginLeft: '3px', fontSize: '0.85rem' }} />{' '}
                                        {new Intl.NumberFormat().format(subItem.amount - item.discount.value)}
                                    </TableCell>
                                    <TableCell>
                                        <Stack alignItems="center">
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </React.Fragment>
                    ))
                )}
            </TableBody>
        </Table>
    )
}

export default PromoContainer