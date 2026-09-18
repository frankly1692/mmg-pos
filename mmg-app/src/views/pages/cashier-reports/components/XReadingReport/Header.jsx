import { Box, Divider, Typography } from '@mui/material';
import { startCase } from 'lodash';
import PropTypes from 'prop-types';

function Header({ report }) {
    return (
        <>
            <Box mb={2}>
                <Typography variant="h3" align="center" mb={1}>
                    MMG ALBAY
                </Typography>
                <Typography variant="subtitle2" fontStyle='italic' align='center'>
                    Operated By:
                </Typography>
                <Typography variant="h5" align="center">
                    Medical Mission Group Multipurpose Cooperative-Albay
                </Typography>
                <Typography variant="subtitle2" align="center">
                    VAT REG TIN {report?.branch?.tin}
                </Typography>
                <Typography variant="subtitle2" align="center" mb={2}>
                    {/* {combinedData?.branchAddress} */}
                    BLDG. 216 ZIGA AVENUE TAYHI (POB.) 4511 CITY OF TABACO ALBAY
                </Typography>
                {/* <Typography variant="h3" textAlign="center">
                    {report?.branch?.name}
                </Typography>
                <Typography variant="h5" fontWeight="regular" color="grey.500" textAlign="center">
                    {startCase(`${report?.branch?.streetAddress}, ${report?.branch?.city} ${report?.branch?.state}`)}
                </Typography>
                <Typography variant="h5" fontWeight="regular" color="grey.500" textAlign="center">
                    #: {report?.branch?.contactNumber}
                </Typography>
                <Typography variant="h5" fontWeight="regular" color="grey.500" textAlign="center">
                    TIN: {report?.branch?.tin}
                </Typography> */}
            </Box>
            <Divider sx={{ mb: 2 }} />
        </>
    );
}

Header.propTypes = {
    report: PropTypes.object
};

export default Header;
