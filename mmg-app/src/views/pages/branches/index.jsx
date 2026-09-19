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
    Container,
    Card,
    CircularProgress
} from '@mui/material';
import CreateBranchModal from './components/CreateBranchModal';
import { useQuery } from 'react-query';
import { omit, startCase } from 'lodash';
import branch from 'api/branch';
import BranchSwitch from './components/BranchSwitch';
import UpdateBranchModal from './components/UpdateBranchModal';
import MainCard from 'ui-component/cards/MainCard';

function BranchesPage() {
    const { data: branches, isLoading, isRefetching } = useQuery('branches', branch.GetAllBranch);
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = (event) => {
        setSearchQuery(event.target.value);
    };


    const filteredBranches = useMemo(() => {
        return branches?.filter(
            (branch) =>
                branch.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [branches, searchQuery]);

    const renderView = (children) => (
        <MainCard title="Branches">
            <Stack
                mb={2}
                gap={1}
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
            >
                <TextField size="small" label="Search" onChange={handleSearch} sx={{ minWidth: 300 }} />
                <CreateBranchModal />
            </Stack>

            <Card sx={{ borderRadius: 2 }}>
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell width={0} sx={{ textWrap: 'nowrap' }}>
                                    Name
                                </TableCell>
                                <TableCell>Address</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell>TIN</TableCell>

                                <TableCell>Phone</TableCell>
                                {/* <TableCell>Active</TableCell> */}
                                <TableCell sx={{ pl: 0, py: 0 }}>
                                    <Stack alignItems="end">
                                        <CircularProgress sx={{ visibility: isRefetching ? 'visible' : 'hidden' }} size={24} />
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {!isLoading &&
                                filteredBranches?.map((branch) => (
                                    <TableRow key={branch._id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                        <TableCell width={0} sx={{ textWrap: 'nowrap' }} component="th" scope="row">
                                            {startCase(branch.name)}
                                        </TableCell>
                                        <TableCell>{startCase(branch.streetAddress)}</TableCell>
                                        <TableCell sx={{ textTransform: 'none' }}>{branch.emailAddress}</TableCell>
                                        <TableCell>{branch.tin}</TableCell>
                                        <TableCell>{branch.contactNumber}</TableCell>
                                        {/* <TableCell>
                                            <BranchSwitch id={branch.id} value={branch.isActive} />
                                        </TableCell> */}
                                        <TableCell sx={{ pl: 0, py: 0, width: 0 }}>
                                            <UpdateBranchModal initialValues={branch} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                        </TableBody>
                    </Table>
                    {children}
                </TableContainer>
            </Card>
        </MainCard>
    );

    const renderMessage = (children) => (
        <Stack alignItems="center" my={4}>
            {children}
        </Stack>
    );

    if (isLoading) {
        return renderView(renderMessage(<CircularProgress size={28} />));
    }

    if (!branches || branches.length === 0) {
        return renderView(
            renderMessage(
                <Typography color="lightgray" variant="h5">
                    No data available for this table
                </Typography>
            )
        );
    }

    return renderView();
}

export default BranchesPage;
