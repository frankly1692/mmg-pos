import { Box, Button, Dialog, DialogActions, DialogContent, Stack } from "@mui/material";
import Receipt from "./ReceiptV2";
import { usePDF } from "react-to-pdf";
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import { dvoteDetails } from "utils/mockData";
import SplitButton from "ui-component/buttons/SplitButton";
import { useEffect } from "react";
import { IoMdPrint } from 'react-icons/io';


const ReceiptModal = ({ open, disableCloseAfterPrinting, reprint, onClose, onPrint, receipt, transaction, forceShow }) => {

    const { toPDF, targetRef } = usePDF({ filename: `invoice-${transaction?.invoiceNumber}.pdf`, page: { format: 'letter' } });

    useEffect(() => {
        if (open) {
            console.warn('transaction', transaction)
        }
    }, [open])

    const handlePrint = async (index) => {
        try {
            await onPrint({
                ...receipt,
                reprint,
                transaction,
                dvoteDetails,
                companyCopy: index != 0
            })
            if (!disableCloseAfterPrinting) {
                onClose()
            }
        } catch {

        }
    }
    const handlePrint2 = async () => {
        try {
            await onPrint({
                ...receipt,
                reprint,
                transaction,
                dvoteDetails,
            })
            await onPrint({
                ...receipt,
                reprint,
                transaction,
                dvoteDetails,
                companyCopy: true
            })
            // await onPrint({ 
            //     ...receipt, 
            //     reprint,
            //     transaction,
            //     dvoteDetails,
            //     companyCopy: true
            // })
            if (!disableCloseAfterPrinting) {
                onClose()
            }
        } catch {

        }
    }
    const printLabel = reprint ? 'Reprint' : 'Print'

    return (
        <Dialog open={open} onClose={!forceShow ? onClose : null} maxWidth="sm" fullWidth>
            <DialogContent >
                <Box ref={targetRef} p={2} pr={1}>
                    <Receipt transaction={transaction} />
                </Box>
            </DialogContent>
            <DialogActions>
                <Stack direction="row" justifyContent="flex-end" spacing={1}>
                    <Button variant="outlined" color="primary" onClick={onClose}>
                        Back
                    </Button>
                    <Button startIcon={<DownloadIcon />} variant="contained" color="primary" onClick={() => toPDF({ resolution: 0.5 })}>
                        Download
                    </Button>
                    <Button startIcon={<IoMdPrint />} variant="contained" color="primary" onClick={handlePrint2}>
                        Print
                    </Button>
                    {/* <SplitButton 
                        onClick={handlePrint} 
                        options={[`${printLabel} Customer\'s`, `${printLabel} Company\'s`]}
                    /> */}
                </Stack>
            </DialogActions>
        </Dialog>
    )
}

export default ReceiptModal