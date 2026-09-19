import React, { useState, useMemo } from 'react';
import {
    Stack,
    TextField,
    Typography,
    TableContainer,
    TableHead,
    TableRow,
    TableBody,
    TableCell,
    Table,
    Paper,
    Card,
    CircularProgress,
    TablePagination
} from '@mui/material';
import CreateUserModal from './components/CreateUserModal';
import { useQuery } from 'react-query';
import user from 'api/user';
import { startCase } from 'lodash';
import UserSwitch from './components/UserSwitch';
import UpdateUserModal from './components/UpdateUserModal';
import MainCard from 'ui-component/cards/MainCard';

function UsersPage() {
    const { data: users, isLoading, isRefetching } = useQuery('users', user.GetAllUser);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchQuery, setSearchQuery] = useState('');

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleSearch = (event) => {
        setSearchQuery(event.target.value);
    };

    const filteredusers = useMemo(() => {
        const lowercaseSearchQuery = searchQuery.toLowerCase();
        return users?.filter(
          (user) =>
            user.firstName.toLowerCase().includes(lowercaseSearchQuery) ||
          user.lastName.toLowerCase().includes(lowercaseSearchQuery) 
        );
      }, [users, searchQuery]);     

    const renderTable = (children) => (
        <MainCard title="Users">
            <Stack
                mb={2}
                gap={1}
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
            >
                <TextField variant="outlined" size="small" label="Search" onChange={handleSearch} sx={{ minWidth: 300 }} />
                <CreateUserModal />
            </Stack>
            <Card sx={{ borderRadius: 2 }}>
                <TableContainer component={Paper}>
                    <Table sx={{ minWidth: 650, borderBottom: 1, borderColor: 'grey.100' }}>
                        <TableHead>
                            <TableRow>
                                <TableCell width={0} sx={{ textWrap: 'nowrap' }}>
                                    Name
                                </TableCell>
                                <TableCell>Username</TableCell>
                                <TableCell>Branch</TableCell>
                                <TableCell>Role</TableCell>
                                <TableCell>Active</TableCell>
                                <TableCell sx={{ pl: 0, py: 0 }}>
                                    <Stack alignItems="end">
                                        <CircularProgress sx={{ visibility: isRefetching ? 'visible' : 'hidden' }} size={24} />
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {!isLoading &&
                                filteredusers?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((user) => (
                                    <TableRow key={user._id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                        <TableCell width={0} sx={{ textWrap: 'nowrap' }} component="th" scope="row">
                                            {startCase(`${user.firstName} ${user.lastName}`)}
                                        </TableCell>
                                        <TableCell sx={{ textTransform: 'none' }}>{user.username}</TableCell>
                                        <TableCell sx={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                            {user?.branches?.map((branch) => startCase(branch.name)).join(', ')}
                                        </TableCell>
                                        <TableCell>{startCase(user?.role?.name)}</TableCell>
                                        <TableCell>
                                            <UserSwitch value={user.isActive} id={user._id} />
                                        </TableCell>
                                        <TableCell sx={{ pl: 0, py: 0, width: 0 }}>
                                            <UpdateUserModal
                                                initialValues={{
                                                    ...user,
                                                    id: user._id
                                                }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                        </TableBody>
                    </Table>
                    {children}
                    {/* <Stack py={1.5} px={2.5} justifyContent='space-between' direction='row'>
                    <Button variant='outlined'>Previous</Button>
                    <Button variant='outlined'>Next</Button>
                    </Stack> */}
                </TableContainer>
                <div style={{ flex: '0 1 auto' }}>
                    <TablePagination
                        component="div"
                        count={users?.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                    />
                </div>
            </Card>
        </MainCard>
    );

    const renderMessage = (children) => (
        <Stack alignItems="center" my={4}>
            {children}
        </Stack>
    );

    if (isLoading) {
        return renderTable(renderMessage(<CircularProgress size={28} />));
    }

    if (!users || users.length === 0) {
        return renderTable(
            renderMessage(
                <Typography color="lightgray" variant="h5">
                    No data available for this table
                </Typography>
            )
        );
    }

    return renderTable();
}

export default UsersPage;
