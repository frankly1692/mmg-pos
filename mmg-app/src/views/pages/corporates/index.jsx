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
import CreateDoctorModal from './components/CreateCorporateModal';
import { useQuery } from 'react-query';
import { omit, startCase } from 'lodash';
import UpdateDoctorModal from './components/UpdateCorporateModal';
import corporate from 'api/corporate';
import MainCard from 'ui-component/cards/MainCard';

function CorporatesPage() {
    const { data: corporates, isLoading, isRefetching } = useQuery('corporates', () => corporate.GetAllCorporate().then(data => data.sort((a, b) => a.name.localeCompare(b.name))));
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);


    const handleSearch = (event) => {
        setSearchQuery(event.target.value);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    console.log(corporates);

    const filteredCorporates = useMemo(() => {
        const lowercaseSearchQuery = searchQuery.toLowerCase();
        return corporates?.filter(
          (corporate) =>
            corporate.name.toLowerCase().includes(lowercaseSearchQuery)
        );
      }, [corporates, searchQuery]);  

    const renderTable = (children) => (
        <MainCard title="Corporates/HMO">
            <Stack
                mb={2}
                gap={1}
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
            >
                <TextField size="small" label="Search" onChange={handleSearch} sx={{ minWidth: 300 }} />
                <CreateDoctorModal />
            </Stack>

            <Card sx={{ borderRadius: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <TableContainer component={Paper}>
                    <Table sx={{ minWidth: 650, borderBottom: 1, borderColor: 'grey.100' }}>
                        <TableHead>
                            <TableRow>
                                <TableCell width={0} sx={{ textWrap: 'nowrap' }}>
                                    Name
                                </TableCell>
                                <TableCell>Address</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell>Phone</TableCell>
                                <TableCell sx={{ pl: 0, py: 0 }}>
                                    <Stack alignItems="end">
                                        <CircularProgress sx={{ visibility: isRefetching ? 'visible' : 'hidden' }} size={24} />
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {!isLoading &&
                                filteredCorporates?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((corporate) => (
                                    <TableRow key={corporate._id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                        <TableCell width={0} sx={{ textWrap: 'nowrap' }} component="th" scope="row">
                                            {startCase(corporate.name)}
                                        </TableCell>
                                        <TableCell>{startCase(corporate.streetAddress)}</TableCell>
                                        <TableCell sx={{ textTransform: 'lowercase' }}>{corporate.emailAddress}</TableCell>
                                        <TableCell>{corporate.contactNumber}</TableCell>
                                        <TableCell sx={{ pl: 0, py: 0, width: 0 }}>
                                            <UpdateDoctorModal
                                                initialValues={{
                                                    ...omit(corporate, '_id'),
                                                    contactNo: corporate?.contactNumber,
                                                    id: corporate._id
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
                        count={corporates?.length}
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

    if (!corporates || corporates.length === 0) {
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

export default CorporatesPage;
