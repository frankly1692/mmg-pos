import { Box, Stack, Typography } from '@mui/material';
import DvoteLogo from './DvoteLogo';
import BirLogo from './BirLogo';

export default () => {
    return (
        <Box position="fixed" bottom={20} right={20} sx={{ pointerEvents: 'none' }}>
            <Stack direction="row" alignItems="center" sx={{ opacity: 0.5 }}>
                <Typography variant="h5" color="grey.600">
                    Powered by
                </Typography>
                <DvoteLogo height={60} width={60} bgcolor="transparent" />
                <BirLogo height={60} width={60} bgcolor="transparent" />
            </Stack>
        </Box>
    );
};
