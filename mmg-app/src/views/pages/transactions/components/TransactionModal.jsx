import { useState } from "react";
import ReceiptModal from "views/pages/PosPage/components/ReceiptModal";
import WithPrintMutation from "views/utilities/Print";
import EditIcon from '@mui/icons-material/Edit';
import { Button } from "@mui/material";
import VisibilityIcon from '@mui/icons-material/Visibility';




export default function ({ transaction, }) {
    const [open, setOpen] = useState(false);


    const { services, ...rest } = transaction;

    const newData = {
        items: services,
        subTotal: transaction?.paymentDetails?.subTotal,
        discountApplied: transaction?.paymentDetails?.discountApplied,
        paymentDue: transaction?.paymentDetails?.paymentDue,
        branchName: transaction?.branch?.name,
        branchTIN: transaction?.branch?.tin,
        branchAddress: `${transaction?.branch?.streetAddress} ${transaction?.branch?.state}`,
        cashierName: `${transaction?.cashier?.first_name} ${transaction?.cashier?.last_name}`,
        ...rest
    };

    const renderButton = () => (

        <Button
            onClick={() => setOpen(true)}
            startIcon={<VisibilityIcon fontSize="small" />}
            variant="contained"
            size="small"
            color="primary"
        >
            View
        </Button>
    );

    if (!open) return renderButton();

    return (
        <>
            {renderButton()}
            <WithPrintMutation>
                {(props) => (
                    <ReceiptModal
                        {...props}
                        reprint
                        open={open}
                        onClose={() => setOpen(false)}
                        transaction={transaction}
                        disableCloseAfterPrinting
                    />
                )}
            </WithPrintMutation>
        </>
    )
}