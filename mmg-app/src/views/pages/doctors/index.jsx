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
    CircularProgress,
    Checkbox,
    TablePagination
} from '@mui/material';
import CreateDoctorModal from './components/CreateDoctorModal';
import { useQuery } from 'react-query';
import { startCase } from 'lodash';
import doctor from 'api/doctor';
import UpdateDoctorModal from './components/UpdateDoctorModal';
import MainCard from 'ui-component/cards/MainCard';

function DoctorsPage() {
    const { data: doctors, isLoading, isRefetching } = useQuery('doctors', () => 
        doctor.GetAllDoctor().then(data => 
            data.sort((a, b) => {
                const fullNameA = `${a.firstName} ${a.lastName}`.toLowerCase();
                const fullNameB = `${b.firstName} ${b.lastName}`.toLowerCase();
                return fullNameA.localeCompare(fullNameB);
            })
        )
    );

    const [searchQuery, setSearchQuery] = useState('');

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

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

    const filteredDoctors = useMemo(() => {
        const lowercaseSearchQuery = searchQuery.toLowerCase();
        return doctors?.filter(
          (doctor) =>
            doctor.firstName.toLowerCase().includes(lowercaseSearchQuery) ||
            doctor.lastName.toLowerCase().includes(lowercaseSearchQuery) 
        );
      }, [doctors, searchQuery]);      

    const renderTable = (children) => (
        <MainCard title="Doctors">
            <Stack
                mb={2}
                gap={1}
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
            >
                <TextField size="small" label="Search..." onChange={handleSearch} sx={{ minWidth: 300 }} />
                <CreateDoctorModal />
            </Stack>

            <div sx={{ borderRadius: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <TableContainer component={Paper}>
                    <Table sx={{ minWidth: 650, borderBottom: 1, borderColor: 'grey.100' }}>
                        <TableHead>
                            <TableRow>
                                <TableCell width={0} sx={{ textWrap: 'nowrap' }}>
                                    Name
                                </TableCell>
                                <TableCell>Age</TableCell>
                                <TableCell>Gender</TableCell>
                                <TableCell>Address</TableCell>
                                <TableCell>Member</TableCell>
                                <TableCell sx={{ pl: 0, py: 0 }}>
                                    <Stack alignItems="end">
                                        <CircularProgress sx={{ visibility: isRefetching ? 'visible' : 'hidden' }} size={24} />
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {!isLoading &&
                                filteredDoctors?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((doctor) => (
                                    <TableRow key={doctor._id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                        <TableCell width={0} sx={{ textWrap: 'nowrap' }} component="th" scope="row">
                                            {startCase(`${doctor.firstName} ${doctor.middleName} ${doctor.lastName}`)}
                                        </TableCell>
                                        <TableCell>{doctor.age}</TableCell>
                                        <TableCell>{doctor.gender === 'M' ? 'Male' : 'Female'}</TableCell>
                                        <TableCell>{doctor.address}</TableCell>
                                        <TableCell>
                                            <Checkbox checked={doctor.isMember} readOnly disableRipple />
                                        </TableCell>
                                        <TableCell sx={{ pl: 0, py: 0, width: 0 }}>
                                            <UpdateDoctorModal initialValues={{ ...doctor, id: doctor._id }} />
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
                        count={doctors?.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                    />
                </div>
            </div>
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

    if (!doctors || doctors.length === 0) {
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

export default DoctorsPage;
