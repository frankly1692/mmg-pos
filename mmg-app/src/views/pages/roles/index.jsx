import React, { useState } from 'react';
import { Stack, TextField, TableRow, TableCell, Table, TableBody, CircularProgress } from '@mui/material';
import CreateRoleModal from './components/CreateRoleModal';
import MainCard from 'ui-component/cards/MainCard';
import DataTable from 'ui-component/DataTable';
import { useQuery } from 'react-query';
import role from 'api/role';
import { startCase } from 'lodash';
import UpdateRoleModal from './components/UpdateRoleModal';

const columns = [
    {
        key: 'name',
        header: 'Name',
        width: 0,
        nowrap: true,
        render: (role) => startCase(role.name)
    },
    { key: 'spacer1', header: '' },
    { key: 'spacer2', header: '' },
    {
        key: 'actions',
        header: ({ isRefetching }) => (
            <Stack alignItems="end">
                <CircularProgress sx={{ visibility: isRefetching ? 'visible' : 'hidden' }} size={24} />
            </Stack>
        ),
        width: 0,
        align: 'right',
        stopPropagation: true,
        render: (role) => <UpdateRoleModal initialValues={{ ...role, id: role._id }} />
    }
];

function RolesPage() {
    const { data: roles, isLoading, isRefetching } = useQuery('roles', role.GetAllRoles);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [expandedRow, setExpandedRow] = useState(null);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleRowClick = (role) => {
        setExpandedRow(expandedRow === role._id ? null : role._id);
    };

    return (
        <MainCard title="Manage Roles">
            <Stack
                mb={2}
                gap={1}
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
            >
                <TextField variant="outlined" size="small" label="Search" sx={{ width: { xs: '100%', sm: 360 } }} />
                <CreateRoleModal />
            </Stack>
            <DataTable
                dense
                columns={columns}
                rows={roles}
                isLoading={isLoading}
                isRefetching={isRefetching}
                onRowClick={handleRowClick}
                isRowExpanded={(role) => expandedRow === role._id}
                renderExpanded={(role) => (
                    <Table sx={{ minWidth: 650 }}>
                        <TableBody>
                            {role?.authorizations?.map((auth) => (
                                <TableRow key={auth.resource}>
                                    <TableCell>{startCase(auth.resource)}</TableCell>
                                    <TableCell colSpan={4}>
                                        {Object.entries(auth.permissions || {})
                                            .filter(([_, value]) => value)
                                            .map(([permission, _]) => startCase(permission))
                                            .join(', ')}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                count={roles?.length}
            />
        </MainCard>
    );
}

export default RolesPage;
