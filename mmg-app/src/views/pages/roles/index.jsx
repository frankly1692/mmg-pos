import React, { useState, useMemo } from 'react';
import { Typography, Button, Stack, TextField, IconButton, Chip, Avatar, Box, Card, TableRow, TableCell, Table, TableBody, CircularProgress } from '@mui/material';
import CreateRoleModal from './components/CreateRoleModal';
import DataTable from 'ui-component/DataTable';
import { useQuery } from 'react-query';
import role from 'api/role';
import { startCase } from 'lodash';
import UpdateRoleModal from './components/UpdateRoleModal';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

// Deterministic pastel avatar color derived from the record's own id, stable across reloads/re-sorts.
const stringToAvatarColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str?.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return { bg: `hsl(${hue}, 70%, 92%)`, color: `hsl(${hue}, 55%, 38%)` };
};

const getInitials = (name) =>
    (name || '')
        .split(/[\s-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0])
        .join('')
        .toUpperCase();

const columns = [
    {
        key: 'name',
        header: 'Name',
        width: 0,
        nowrap: true,
        render: (role) => {
            const avatarColor = stringToAvatarColor(role._id);
            return (
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: avatarColor.bg, color: avatarColor.color, fontWeight: 600, fontSize: '0.8125rem' }}>
                        {getInitials(role.name)}
                    </Avatar>
                    <Typography variant="body2" fontWeight={600}>
                        {startCase(role.name)}
                    </Typography>
                </Stack>
            );
        }
    },
    {
        key: 'permissions',
        header: 'Permissions',
        render: (role) => (
            <Chip label={`${role?.authorizations?.length || 0} Resources`} size="small" variant="outlined" />
        )
    },
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
    const [searchQuery, setSearchQuery] = useState('');

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

    const filteredRoles = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return (roles || []).filter((r) => r.name.toLowerCase().includes(query));
    }, [roles, searchQuery]);

    return (
        <Stack spacing={2.5}>
            <Card>
                <Box sx={{ px: 3, py: 2.5, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Typography variant="h2" fontWeight={600}>
                                Roles
                            </Typography>
                            <Chip
                                size="small"
                                label={`${(roles?.length || 0).toLocaleString()} Roles`}
                                sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 500 }}
                            />
                        </Stack>
                        <Typography variant="body2" color="text.secondary" mt={0.5}>
                            Manage staff roles and their resource-level permissions.
                        </Typography>
                    </Box>
                    <CreateRoleModal />
                </Box>
            </Card>

            <Card>
                <Box sx={{ px: 3, py: 2.5 }}>
                    <TextField
                        size="small"
                        placeholder="Search by role name..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPage(0);
                        }}
                        sx={{ minWidth: 300 }}
                        InputProps={{
                            startAdornment: <SearchIcon fontSize="small" color="action" sx={{ mr: 1 }} />,
                            endAdornment: searchQuery ? (
                                <IconButton size="small" onClick={() => setSearchQuery('')}>
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            ) : null
                        }}
                    />
                </Box>
            </Card>

            <DataTable
                dense
                columns={columns}
                rows={filteredRoles}
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
                count={filteredRoles?.length}
            />
        </Stack>
    );
}

export default RolesPage;
