import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Card,
  Typography,
  Grid,
  TextField,
  Button,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Autocomplete,
  Chip
} from '@mui/material';
import { MdPersonAdd, MdHistory, MdFrontHand, MdLogout, MdAdd, MdList } from 'react-icons/md';
import Checkout from './Checkout';
import AddCustomerModal from './AddCustomerModal';
import moment from 'moment';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import packagelab from 'api/package';
import corporate from 'api/corporate';
import customer from 'api/customer';
import doctor from 'api/doctor';
import transaction from 'api/transaction';
import discount from 'api/discount';
import { FaPesoSign } from 'react-icons/fa6';
import { RiDeleteBack2Fill } from 'react-icons/ri';

// component import
import RightDrawer from 'ui-component/drawer/rightDrawer';
import TransactionsSlideBar from './TransactionsSideBar';
import { Box, useMediaQuery } from '@mui/system';
import { useTheme } from '@emotion/react';
import PackagesComponent from './PackagesComponent';
import DiscountComponent from './DiscountComponent';
import { useHotkeys } from 'react-hotkeys-hook';
import LabTestComponent from './LabTestComponent';
import ClearComponent from './ClearComponent';
import NewTransactionDialog from './NewTransactionDialog';
import HoldItems from './HoldComponent';
import ServicesPage from 'views/pages/ServicesPage';
import CashRegister from './CashRegister';
import { useAuth } from 'providers/AuthProvider';
import DailyReport from './DailyReport';
import CusCorSelect from './CusCorSelect';

const generateTransactionNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2); // Add leading zero
  const day = ('0' + date.getDate()).slice(-2); // Add leading zero
  const hours = ('0' + date.getHours()).slice(-2); // Add leading zero
  const minutes = ('0' + date.getMinutes()).slice(-2); // Add leading zero
  const seconds = ('0' + date.getSeconds()).slice(-2); // Add leading zero
  const randomComponent = Math.random().toString(36).substr(2, 5).toUpperCase(); // Generate a random string

  return `${randomComponent}-${year}${month}${day}${hours}${minutes}${seconds}`;
};

const PosComponent = () => {
  const { control, reset, setValue } = useForm({
    defaultValues: {
      customer: null,
      requestedBy: null,
      referredBy: null
    }
  });

  const { branch } = useAuth();

  const [openNewTransDialog, setNewTransDialog] = useState(false);
  const [isNewTrans, setIsNewTrans] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [subTotal, setSubTotal] = useState(0);
  const [checkout, setCheckout] = useState(false);
  const [ifLogout, setIfLogout] = useState(false);
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  const [referredBy, setReferredBy] = useState({ id: null, name: null });
  const [requestedBy, setRequestedBy] = useState({ id: null, name: null });
  const [companyData, setCompanyData] = useState([]);
  const [customerData, setCustomerData] = useState([]);
  const [employeeData, setEmployeeData] = useState([]);
  const [referenceNumber, setReferenceNumber] = useState(null);
  const [transactionDate, setTransactionDate] = useState(moment().format('MMMM Do YYYY, h:mm a'));
  const [appliedDiscount, setAppliedDiscount] = useState({ type: null, value: null, totalDiscount: null });
  const [reason, setReason] = useState('');
  const [sessionItems, setSessionItems] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState();
  const [isPackageOrPromoAdded, setIsPackageOrPromoAdded] = useState(false);
  const [discountApplied, setDiscountApplied] = useState(false);

  const { data: activeTrans } = useQuery('activeTrans', transaction.GetActiveTransaction);
  const { data: corporates } = useQuery('corporates', corporate.GetAllCorporate);
  const { data: customerslist } = useQuery('customers', customer.GetAllCustomers);
  const { data: packages } = useQuery('packages', packagelab.GetAllPackages);
  const { data: doctorlist } = useQuery('doctors', doctor.GetAllDoctor);
  const { data: discountsData } = useQuery('discounts', discount.GetAllDiscounts);
  const { data: totalSales } = useQuery(
    ['transaction', sessionItems?._id, branch?.id],
    () => transaction.GetSales(sessionItems?._id, branch?.id),
    {
      enabled: !!sessionItems?._id // Only run the query if a transaction ID is set
    }
  );

  const [combinedCustomerData, setCombinedCustomerData] = useState([]);
  const [combinedDoctorData, setCombinedDoctorData] = useState([]);
  const [selectedPackages, setSelectedPackages] = useState([]);
  const [selectedLabTest, setSelectedlabTest] = useState([]);
  const [transactionData, setTransactionData] = useState([]);

  useEffect(() => {
    const dataSession = JSON.parse(localStorage.getItem('session'));
    console.log('dataSession', dataSession);
    if (dataSession) {
      setSessionItems(dataSession);
    }
  }, []);

  const queryClient = useQueryClient();

  const createTransactionMutation = useMutation(transaction.CreateTransaction, {
    onMutate: async (newTransaction) => {
      await queryClient.cancelQueries('transactions');
      const previousTransaction = queryClient.getQueryData('transactions');

      // Check if the previous services data is empty or undefined
      if (!previousTransaction || previousTransaction.length === 0) {
        // If empty, proceed with creating the new service
        queryClient.setQueryData('transactions', [newTransaction]);
      } else {
        // If not empty, append the new service to the existing list
        queryClient.setQueryData('transactions', (old) => [...old, newTransaction]);
      }

      return { previousTransaction };
    },
    onError: (err, newTransaction, context) => {
      queryClient.setQueryData('transactions', context.previousTransaction);
      toast.error('Error creating transaction.');
    },
    onSuccess: (data) => {
      // toast.success('Lab Test created successfully.', {
      //     onClose: handleNavigation
      // });
      setTransactionData(data);
    },
    onSettled: () => {
      queryClient.invalidateQueries('transactions');
    }
  });

  const editTransactionMutation = useMutation(transaction.UpdateTransaction, {
    onMutate: async (updatedTransaction) => {
      await queryClient.cancelQueries('transactions');
      const previousTransaction = queryClient.getQueryData('transactions');
      queryClient.setQueryData('transactions', (old) =>
        old?.map((cat) => (cat._id === updatedTransaction._id ? updatedTransaction : cat))
      );
      return { previousTransaction };
    },
    onError: (err, updatedService, context) => {
      queryClient.setQueryData('transactions', context.previousTransaction);
      toast.error('Error canceling the transaction.');
    },
    onSuccess: () => {
      reset();
      setRequestedBy([]);
      setReferredBy([]);
      setCustomerData([]);
      setTransactionData([]);
      setSelectedPackages([]);
      setSelectedlabTest([]);
      setItems([]);
      setTotal(0);
      setSubTotal(0);
      setReferenceNumber(null);
      setAppliedDiscount({ type: null, value: null, totalDiscount: null });
      setIsNewTrans(false);
      setIsPackageOrPromoAdded(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries('transactions');
    }
  });

  useEffect(() => {
    // This effect runs whenever `customerData` changes
    console.log('Customer data has changed:', customerData);
  }, [customerData]);

  useEffect(() => {
    if (customerslist) {
      const combinedData = customerslist.map((customer) => ({
        id: customer._id,
        fullName: `${customer.firstName} ${customer.middleName ? customer.middleName + ' ' : ''}${customer.lastName}`,
        address: `${customer.address.street} ${customer.address.barangay} ${customer.address.barangay} ${customer.address.cityMunicipality} ${customer.address.province} ${customer.address.country} `,
        contactNumber: customer?.contactNumber
      }));
      setCombinedCustomerData(combinedData);
    }
  }, [customerslist]);

  useEffect(() => {
    if (doctorlist) {
      const combinedDoctorData = doctorlist.map((doctor) => ({
        id: doctor._id,
        fullName: `${doctor.firstName} ${doctor.middleName ? doctor.middleName + ' ' : ''}${doctor.lastName}`,
        isMember: doctor?.isMember
      }));
      setCombinedDoctorData(combinedDoctorData);
    }
  }, [doctorlist]);

  useEffect(() => {
    if (requestedBy) {
      setValue('requestedBy', combinedDoctorData.find((doctor) => doctor.id === requestedBy.id) || null);
    }
  }, [requestedBy, setValue, combinedDoctorData]);

  useEffect(() => {
    if (referredBy) {
      setValue('referredBy', combinedDoctorData.find((doctor) => doctor.id === referredBy.id) || null);
    }
  }, [referredBy, setValue, combinedDoctorData]);

  const handleAddItem = async (item) => {
    // Prompt for manual price input if the item is under the "Others" category
    let itemPrice = item.price;

    console.log('item', item);

    // Find the relevant discount for packages
    const packageDiscount = discountsData?.find((discount) => discount.name === 'Packages');
    const discountValue = packageDiscount ? packageDiscount.value : 0;

    if (packages && packages.some((pkg) => pkg.name === item.name)) {
      setIsPackageOrPromoAdded(true);

      // Map labTest items from the package to your items state
      const packageItems = {
        _id: item?._id,
        source: 'package',
        items: item?.labTest.map((test) => ({
          _id: test.id,
          qty: 1, // Ensure quantity is always 1
          price: test.price,
          amount: test.price,
          name: item?.name,
          ...test
        }))
      };
      // Add packageItems to items state
      const updatedItems = [...items, packageItems];
      setItems((prevItems) => [...prevItems, packageItems]);

      const packageSubTotal = updatedItems
        .filter((item) => item.source === 'package')
        .reduce((acc, item) => {
          const itemTotal = item.items.reduce((subAcc, subItem) => {
            return subAcc + (subItem.price || 0);
          }, 0);
          return acc + itemTotal;
        }, 0);

      const labTestSubTotal = items.filter((item) => item.source === 'labTest').reduce((acc, item) => acc + item.price, 0);

      // Calculate subTotal and total without discount
      const newSubTotal = packageSubTotal + labTestSubTotal;

      const totalDiscount = packageSubTotal * (discountValue / 100);
      const newTotal = newSubTotal - totalDiscount; // Apply net total discount

      setSubTotal(newSubTotal);
      setTotal(newTotal);
      setAppliedDiscount({
        type: 'package',
        value: discountValue,
        totalDiscount
      });

      setSelectedPackages([...selectedPackages, item._id]);
    } else {
      // Check if the lab test is already included in a package
      const isLabTestInPackage = items.some((i) => i.source === 'package' && i.items.some((itemObj) => itemObj.name === item?.name));

      if (isLabTestInPackage) {
        alert(`${item.name} is already included in a package.`);
        return;
      }

      if (item.category.name === 'Others' && item.no_price) {
        itemPrice = parseFloat(prompt(`Enter the price for ${item.name}:`, item.price));
        if (isNaN(itemPrice) || itemPrice <= 0) {
          alert('Invalid price entered. Item will not be added.');
          return;
        }
      }

      // Handle adding standalone lab tests here
      const existingItemIndex = items.findIndex((i) => i.name === item.name);
      if (existingItemIndex !== -1) {
        alert(`${item.name} is already added.`);
        return;
      }

      const amount = itemPrice;
      const updatedItems = [...items, { ...item, qty: 1, amount, price: itemPrice, source: 'labTest' }];

      setItems(updatedItems);

      const packageSubTotal = updatedItems
        .filter((item) => item.source === 'package')
        .reduce((acc, item) => {
          const itemTotal = item.items.reduce((subAcc, subItem) => {
            return subAcc + (subItem.price || 0);
          }, 0);
          return acc + itemTotal;
        }, 0);
      const labTestSubTotal = updatedItems.filter((item) => item.source === 'labTest').reduce((acc, item) => acc + item.price, 0);

      const newSubTotal = packageSubTotal + labTestSubTotal;
      let newTotal = 0;
      let totalDiscount = 0;

      if (appliedDiscount.length !== 0) {
        if (appliedDiscount.type === 'percentage') {
          newTotal = newSubTotal - appliedDiscount?.totalDiscount;
        } else {
          totalDiscount = appliedDiscount?.totalDiscount;
          newTotal = newSubTotal - totalDiscount;
        }
      } else {
        newTotal = newSubTotal;
      }

      setSubTotal(newSubTotal);
      setTotal(newTotal);
      setSelectedlabTest([...selectedLabTest, item.name]);
    }

    setDiscountApplied(false);
  };

  const handleRemoveItem = (index) => {
    const itemToRemove = items[index];

    if (itemToRemove.source === 'package') {
      const remainingItems = items.filter((item) => item.source !== 'package' || item.packageId !== itemToRemove.packageId);

      const newSubTotal = remainingItems.reduce((acc, item) => acc + item.amount, 0);
      let newTotal = newSubTotal;
      let newAppliedDiscount = appliedDiscount;

      if (appliedDiscount && remainingItems.length === 0) {
        // Reset applied discount if no items are left
        newAppliedDiscount = [];
      } else if (appliedDiscount) {
        const totalDiscount = 0;
        newTotal = newSubTotal - totalDiscount;
        newAppliedDiscount = {
          ...appliedDiscount,
          value: 0,
          totalDiscount
        };
      }

      setItems(remainingItems);
      setSubTotal(newSubTotal);
      setTotal(newTotal);
      setAppliedDiscount(newAppliedDiscount);
      setSelectedPackages([]);
      setIsPackageOrPromoAdded(false);
    } else {
      const updatedItems = [...items];
      updatedItems.splice(index, 1);

      const newSubTotal = updatedItems
        .filter((item) => item.source === 'package' || item.source === 'labTest')
        .reduce((acc, item) => {
          let itemAmount = 0;

          if (item.source === 'package') {
            // Calculate amount for package items (assuming a structure for package items)
            itemAmount = item.items?.reduce((sum, subItem) => sum + (subItem.price ?? 0), 0) ?? 0;
          } else if (item.source === 'labTest') {
            // Calculate amount for labTest items (assuming a different structure for labTest items)
            itemAmount = item.price ?? 0; // example: use labTestAmount for labTest items
          }

          return acc + itemAmount;
        }, 0);

      let newTotal = newSubTotal;
      let newAppliedDiscount = appliedDiscount;

      if (updatedItems.length === 0) {
        newAppliedDiscount = [];
        setSelectedlabTest([]);
      } else {
        const totalDiscount = appliedDiscount.totalDiscount;
        if (appliedDiscount) {
          newTotal = newSubTotal - totalDiscount;
        } else {
          newTotal = newSubTotal;
        }

        newAppliedDiscount = {
          ...appliedDiscount,
          totalDiscount
        };

        setSelectedlabTest(selectedLabTest.filter((item) => item !== itemToRemove.name));
      }

      setItems(updatedItems);
      setSubTotal(newSubTotal);
      setTotal(newTotal);
      setAppliedDiscount(newAppliedDiscount);
      setDiscountApplied(false);
    }
  };

  const handleClearItems = async (id) => {
    reset();
    setCustomerName(null);
    setRequestedBy([]);
    setReferredBy([]);
    setCustomerData([]);
    setTransactionData([]);
    setSelectedPackages([]);
    setSelectedlabTest([]);
    setItems([]);
    setTotal(0);
    setSubTotal(0);
    setReferenceNumber(null);
    setAppliedDiscount({ type: null, value: null, totalDiscount: null });
    setIsNewTrans(false);
    setIsPackageOrPromoAdded(false);
    setDiscountApplied(false);

    const newMapData = {
      id: id,
      customerId: customerData.id,
      referredBy: requestedBy.id,
      requestedBy: referredBy.id,
      transactionNo: transactionData?.transactionNo,
      transactionDate: transactionData?.transactionDate,
      invoiceNo: referenceNumber,
      services: items,
      total: subTotal,
      paymentDue: total,
      discountApplied: appliedDiscount,
      status: 'Cancelled',
      reason: reason
    };

    if (newMapData != null) {
      await editTransactionMutation.mutateAsync(newMapData);
    }
  };

  const handleHoldTransaction = async (onHold) => {
    if (onHold === false) {
      console.log('Hold action was canceled.');
    } else if (onHold === true) {
      const combinedData = {
        id: transactionData?._id,
        customerData: customerData,
        requestedById: requestedBy.id,
        referredById: referredBy.id,
        transactionNo: transactionData?.transactionNo,
        transactionDate: transactionData?.transactionDate,
        invoiceNo: referenceNumber,
        discountApplied: appliedDiscount,
        subTotal: subTotal,
        paymentDue: total,
        services: items,
        paymentDetails: {
          subTotal: subTotal,
          paymentDue: total,
          tenderAmount: 0,
          change: 0,
          tenderType: '',
        },
        status: 'Hold'
      };

      if (combinedData != null) {
        await editTransactionMutation.mutateAsync(combinedData);
      }

      setDiscountApplied(false);
    }
  };

  const handleRestoreTransaction = (selectedTransaction) => {
    console.log('selectedTransaction', selectedTransaction);

    if (selectedTransaction) {
      const restoredRequestedBy = combinedDoctorData.find((doctor) => doctor.id === selectedTransaction?.requestedBy?._id);
      const restoredReferredBy = combinedDoctorData.find((doctor) => doctor.id === selectedTransaction?.referredBy?._id);

      setCustomerData(selectedTransaction?.customerData);

      setRequestedBy({
        id: restoredRequestedBy?.id,
        name: restoredRequestedBy?.fullName
      });

      setReferredBy({
        id: restoredReferredBy?.id,
        name: restoredReferredBy?.fullName
      });

      setTransactionData({
        id: selectedTransaction?._id
      });

      setReferenceNumber(selectedTransaction?.invoiceNo);

      // Refactor to handle both array and single item cases for items
      const services = selectedTransaction?.services;

      console.log('services', services);

      if (Array.isArray(services)) {
        // Set items directly if services is an array
        setItems(services);

        // Set selected packages if services is an array
        const labTests = services.filter((service) => service.source === 'package').map((service) => service._id);

        const labTestsForLabTests = services
          .filter((service) => service.source === 'labTest')
          .map((service) => ({
            id: service._id,
            name: service.name
          }));

        setSelectedPackages(labTests);
        setSelectedlabTest(labTestsForLabTests);
      } else {
        // Handle the case where services is undefined or null
        setItems([]);
        setSelectedLabTest([]);
      }

      setTransactionDate(moment(selectedTransaction?.transactionDate).format('MMMM Do YYYY, h:mm a'));
      setSubTotal(selectedTransaction?.paymentDetails?.subTotal);
      setTotal(selectedTransaction?.paymentDetails?.paymentDue);
      setAppliedDiscount({
        type: selectedTransaction?.discountApplied?.type,
        value: selectedTransaction?.discountApplied?.value,
        totalDiscount: selectedTransaction?.discountApplied?.totalDiscount
      });

      setDrawerOpen(false);
      setIsNewTrans(true);
    }
  };

  const handleSelectDiscount = (discount) => {
    let totalDiscount = 0;
    const newSubTotal = items.reduce((acc, item) => acc + item.price * item.qty, 0);
    // Update the applied discount state
    if (discount?.type === 'fixed') {
      totalDiscount = discount?.value;
    } else {
      totalDiscount = newSubTotal * (discount?.value / 100);
    }
    const discountedTotal = newSubTotal - totalDiscount;
    setAppliedDiscount({
      type: discount?.type,
      value: discount?.value,
      totalDiscount
    });
    setSubTotal(newSubTotal);
    setTotal(discountedTotal);
    setDiscountApplied(true);
  };

  const handleOpenDrawer = (id) => {
    setDrawerOpen(true);
    setDrawerContent(id);
  };

  const handleAddDialolgTrans = () => {
    setNewTransDialog(true);
  };

  const handleDialogClose = () => {
    setNewTransDialog(false);
  };

  const handleDialogConfirm = () => {
    // Logic to create a new transaction
    createTransactionMutation.mutate({ branchId: branch?.id });
    setReason('');
    setNewTransDialog(false);
    setIsNewTrans(true);
    setReferenceNumber(generateTransactionNumber);
  };

  const handleBackPos = (param) => {
    if (param === 'success') {
      reset();
      setRequestedBy([]);
      setReferredBy([]);
      setCustomerData([]);
      setTransactionData([]);
      setSelectedPackages([]);
      setSelectedlabTest([]);
      setItems([]);
      setTotal(0);
      setSubTotal(0);
      setReferenceNumber(null);
      setAppliedDiscount([]);
      setIsNewTrans(false);
      setIsPackageOrPromoAdded(false);
      setDiscountApplied(false);
      setCheckout(false);
    } else {
      setCheckout(false);
    }
  };

  useHotkeys('f1', handleAddDialolgTrans, { preventDefault: true });
  useHotkeys('f2', () => setAddCustomerModalOpen(true), { preventDefault: true });
  useHotkeys('f3', () => handleOpenDrawer('history'), { preventDefault: true });
  useHotkeys('f4', () => handleOpenDrawer('services'), { preventDefault: true });
  useHotkeys('f6', handleHoldTransaction, { preventDefault: true });
  useHotkeys('f8', () => handleOpenDrawer('dreport'), { preventDefault: true });

  const renderGridItem = (label, value, highlight = false) => (
    <>
      <Grid item xs={5}>
        <Typography fontSize="1.05rem" variant="h4" fontWeight="regular" color={theme.palette.grey[500]}>
          {label}
        </Typography>
      </Grid>
      <Grid item xs={7} sx={{ textWrap: 'wrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <Typography
          fontSize="1.05rem"
          sx={highlight ? { color: 'success.dark' } : {}}
          textAlign="end"
          variant="h4"
          textWrap="pretty"
        >
          {value}
        </Typography>
      </Grid>
    </>
  );

  const theme = useTheme();
  const smallScreenSize = useMediaQuery(theme.breakpoints.down('xl'));

  const combinedData = {
    id: transactionData?._id,
    customerData: customerData,
    requestedById: requestedBy.id,
    requestedByName: requestedBy.name,
    referredById: referredBy.id,
    referredByName: referredBy.name,
    transactionNumber: transactionData?.transactionNo,
    transactionDate: transactionData?.transactionDate,
    cashierId: sessionItems?._id,
    cashierName: `${sessionItems?.firstName} ${sessionItems?.lastName}`,
    branchName: branch?.name,
    branchTIN: branch?.tin,
    branchAddress: `${branch?.streetAddress} ${branch?.state}`,
    invoiceNo: referenceNumber,
    discountApplied: appliedDiscount,
    subTotal: subTotal,
    paymentDue: total,
    items
  };

  if (checkout) {
    console.log('checout', combinedData)
    return <Checkout combinedData={combinedData} handleBack={handleBackPos} ar={'ar'} />;
  }

  if (ifLogout) {
    return <CashRegister isEndingBalanceFlag={ifLogout} handleBack={() => setIfLogout(false)} />;
  }

  console.log('customerData', customerData);

  return (
    <Box bgcolor={theme.palette.primary.light} sx={{ p: 2.5, pb: 1, height: '100dvh' }}>
      <Grid container spacing={1.5} sx={{ height: '100%', zoom: smallScreenSize ? '70%' : '100%' }}>
        <Grid item xs={2.5} sx={{ overflow: 'hidden' }}>
          <Stack direction="column" spacing={1.5} sx={{ height: '100%' }}>
            <Stack direction="row-reverse" spacing={1}>
              <Card sx={{ px: 3, py: 2, flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Stack>
                  <Typography variant="h4">{`${sessionItems?.firstName} ${sessionItems?.lastName}`}</Typography>
                  <Typography variant="h5" fontWeight="regular">
                    Cashier
                  </Typography>
                </Stack>
                <IconButton>
                  <MdLogout onClick={() => setIfLogout(true)} />
                </IconButton>
              </Card>
            </Stack>
            {/* <Stack direction="row-reverse" spacing={1}>
              <Card sx={{ px: 3, py: 2, flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Stack justifyContent="center" flex={1}>
                  <Typography variant="subtitle2">Drawer Balance</Typography>
                  <Typography variant="h1" fontWeight="bold">
                    <FaPesoSign style={{ fontSize: '0.85rem' }} />
                    {totalSales?.total !== undefined
                      ? new Intl.NumberFormat().format(parseFloat(totalSales.total))
                      : '0.00'}
                  </Typography>
                </Stack>
              </Card>
            </Stack> */}
            <Card sx={{ p: 3 }}>
              <Stack direction="column" spacing={1.8}>
                <Typography variant="h4">Customer</Typography>
                <Controller
                  name="corporate"
                  control={control}
                  disabled={!isNewTrans}
                  render={({ field }) => (
                    <Autocomplete
                      {...field}
                      blurOnSelect
                      options={corporates}
                      getOptionLabel={(option) => option.name}
                      onChange={(e, value) => {
                        field.onChange(value); // Update react-hook-form
                        const newData = {
                          id: value?._id,
                          name: value?.name,
                          address: `${value?.streetAddress} ${value?.city} ${value?.state}`,
                          tin: value?.tin,
                          contactNumber: value.contactNumber,
                          type: 'corporate'
                        };
                        setCompanyData(newData);
                      }}
                      value={
                        field.value || corporates?.find((corporate) => corporate?.id === customerData?.id) || null
                      } // Use field.value or find the customer by ID
                      renderInput={(params) => (
                        <TextField {...params} label="Search Corporate" variant="outlined" fullWidth />
                      )}
                    />
                  )}
                />
                <Controller
                  name="customer"
                  control={control}
                  disabled={!isNewTrans}
                  render={({ field }) => (
                    <Autocomplete
                      {...field}
                      blurOnSelect
                      options={combinedCustomerData}
                      getOptionLabel={(option) => option.fullName}
                      onChange={(e, value) => {
                        field.onChange(value); // Update react-hook-form
                        setEmployeeData({
                          id: value?.id,
                          name: value?.fullName,
                          address: value?.address,
                          contactNumber: value?.contactNumber
                        });
                      }}
                      value={
                        field.value ||
                        combinedCustomerData.find((customer) => customer.id === customerData.id) ||
                        null
                      } // Use field.value or find the customer by ID
                      renderInput={(params) => (
                        <TextField {...params} label="Search employee" variant="outlined" fullWidth />
                      )}
                    />
                  )}
                />
                <Controller
                  name="payee"
                  control={control}
                  disabled={!isNewTrans}
                  render={({ field }) => (
                    <Autocomplete
                      {...field}
                      blurOnSelect
                      options={corporates}
                      getOptionLabel={(option) => option.name}
                      onChange={(e, value) => {
                        field.onChange(value); // Update react-hook-form
                        const newData = {
                          id: value?._id,
                          name: value?.name,
                          address: `${value?.streetAddress} ${value?.city} ${value?.state}`,
                          tin: value?.tin,
                          contactNumber: value.contactNumber,
                          type: 'corporate'
                        };
                        setCustomerData(newData);
                      }}
                      value={
                        field.value || corporates?.find((corporate) => corporate?.id === customerData?.id) || null
                      } // Use field.value or find the customer by ID
                      renderInput={(params) => (
                        <TextField {...params} label="Search Payee" variant="outlined" fullWidth />
                      )}
                    />
                  )}
                />
                {/* <Controller
                  name="requestedBy"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      {...field}
                      blurOnSelect
                      options={combinedDoctorData.filter((doctor) => doctor.isMember === true)}
                      getOptionLabel={(option) => option.fullName}
                      onChange={(e, value) => {
                        field.onChange(value); // Update react-hook-form
                        setRequestedBy({ id: value?.id, name: value?.fullName }); // Update customer data
                      }}
                      value={field.value || combinedDoctorData.find((doctor) => doctor.id === requestedBy?.id) || null} // Use field.value or find the doctor by ID
                      disabled={!isNewTrans}
                      renderInput={(params) => <TextField {...params} label="Requested By" variant="outlined" fullWidth />}
                    />
                  )}
                />
                <Controller
                  name="referredBy"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      {...field}
                      blurOnSelect
                      options={combinedDoctorData}
                      getOptionLabel={(option) => option.fullName}
                      onChange={(e, value) => {
                        field.onChange(value); // Update react-hook-form
                        setReferredBy({ id: value?.id, name: value?.fullName }); // Update customer data
                      }}
                      value={field.value || combinedDoctorData.find((doctor) => doctor.id === referredBy?.id) || null} // Use field.value or find the doctor by ID
                      disabled={!isNewTrans}
                      renderInput={(params) => <TextField {...params} label="Referred By" variant="outlined" fullWidth />}
                    />
                  )}
                /> */}
              </Stack>
            </Card>
            <Card sx={{ p: 3, flex: 1 }}>
              <Typography mb={1} variant="h4">
                Actions
              </Typography>
              <Grid container spacing={0.5}>
                {[
                  { label: 'New Trans (F1)', icon: <MdAdd />, onclick: handleAddDialolgTrans },
                  // { label: 'Hold (F3)', icon: <MdFrontHand />, onclick: handleHoldTransaction },
                  { label: 'New Cust (F2)', icon: <MdPersonAdd />, onclick: () => setAddCustomerModalOpen(true) }
                  // { label: 'History (F3)', icon: <MdHistory />, onclick: () => handleOpenDrawer('history') },
                  // { label: 'Services (F4)', icon: <MdList />, onclick: () => handleOpenDrawer('services') },
                  // { label: 'Report (F8)', icon: <MdList />, onclick: () => handleOpenDrawer('dreport') }
                ]?.map((item) => {
                  return (
                    <Grid item xs={item?.grid ?? 12} lg={6}>
                      <Button
                        variant="contained"
                        color="dark"
                        fullWidth
                        startIcon={item.icon}
                        sx={{
                          py: 2,
                          height: '100%',
                          textWrap: 'nowrap',
                          overflow: 'hidden'
                        }}
                        onClick={item.onclick}
                      >
                        {item.label}
                      </Button>
                    </Grid>
                  );
                })}
                {/* <Grid item xs={12} lg={6}>
                  <DiscountComponent
                    disabled={!customerData?.name || items?.length === 0 || isPackageOrPromoAdded}
                    onSelectDiscount={handleSelectDiscount}
                    discountsData={discountsData}
                  />
                </Grid> */}
                <Grid item xs={12} lg={6}>
                  <HoldItems
                    transaction={combinedData}
                    onHold={(onHold) => handleHoldTransaction(onHold)}
                    onSuccess={() => handleBackPos('success')}
                    disabled={!customerData?.name}
                  />
                </Grid>
                <Grid item xs={12} lg={6}>
                  <ClearComponent
                    onClear={(transactionId) => handleClearItems(transactionId)}
                    disabled={!customerData?.name}
                    transactionId={transactionData?._id}
                    setReason={setReason}
                  />
                </Grid>
              </Grid>
            </Card>
          </Stack>
        </Grid>
        <Grid item xs={6.5}>
          <Stack direction="column-reverse" spacing={1.5} width="100%" height="100%">
            <Card
              sx={{
                flex: 1.2,
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <Typography mb={2} variant="h4">
                Transaction Items
              </Typography>
              <TableContainer
                component={Paper}
                sx={{
                  flex: 1,
                  flexBasis: 0.75,
                  opacity: !customerData?.name || items?.length === 0 ? 0.5 : 1
                }}
              >
                <Table sx={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow
                      sx={{
                        '& .MuiTableCell-root': {
                          py: 2,
                          border: 1,
                          borderColor: theme.palette.grey[200]
                        }
                      }}
                    >
                      <TableCell sx={{ width: '40%' }}>Name</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell align="center">Qty</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell sx={{ width: 0 }} align="center"></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No items added yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      items?.map((item, index) => (
                        <React.Fragment key={index}>
                          {index === 0 || items[index - 1].source !== item.source ? (
                            <TableRow
                              key={`separator-${index}`}
                              sx={{
                                '& .MuiTableCell-root': {
                                  py: 2,
                                  backgroundColor: 'white !important'
                                }
                              }}
                            >
                              <TableCell
                                colSpan={4}
                                sx={{
                                  fontSize: '1.05rem',
                                  fontWeight: 'bold',
                                  borderRight: '0 !important',
                                  borderLeft: 3,
                                  borderColor: theme.palette.primary.main,
                                  borderBottom: 0
                                }}
                              >
                                {item.source === 'package' ? 'Package Items' : 'Items'}
                              </TableCell>
                              <TableCell
                                sx={{
                                  borderLeft: '0 !important',
                                  borderRight: 1,
                                  borderColor: theme.palette.grey[200]
                                }}
                              >
                                <Stack alignItems="center">
                                  {item.source === 'package' && (index === 0 || items[index - 1].source !== 'package') ? (
                                    <IconButton size="small" onClick={() => handleRemoveItem(index)}>
                                      <RiDeleteBack2Fill />
                                    </IconButton>
                                  ) : null}
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ) : null}
                          {item.items ? (
                            item.items.map((subItem, subIndex) => (
                              <TableRow
                                key={`${index}-${subIndex}`}
                                sx={{
                                  '& .MuiTableCell-root': {
                                    backgroundColor: theme.palette.grey[50],
                                    py: 0.6,
                                    border: 1,
                                    borderColor: theme.palette.grey[200]
                                  }
                                }}
                              >
                                <TableCell
                                  sx={{
                                    pl: '60px !important',
                                    textWrap: 'nowrap',
                                    textOverflow: 'ellipsis',
                                    overflow: 'hidden',
                                    fontSize: '1.08rem'
                                  }}
                                >
                                  {subItem.name}
                                </TableCell>
                                <TableCell>
                                  <FaPesoSign style={{ marginLeft: '3px', fontSize: '0.85rem' }} />{' '}
                                  {new Intl.NumberFormat().format(subItem.price)}
                                </TableCell>
                                <TableCell align="center">({subItem.qty})</TableCell>
                                <TableCell>
                                  <FaPesoSign style={{ marginLeft: '3px', fontSize: '0.85rem' }} />{' '}
                                  {new Intl.NumberFormat().format(subItem.amount)}
                                </TableCell>
                                <TableCell>
                                  <Stack alignItems="center">
                                    {item.source !== 'package' ? (
                                      <IconButton size="small" onClick={() => handleRemoveItem(index, subIndex)}>
                                        <RiDeleteBack2Fill />
                                      </IconButton>
                                    ) : null}
                                  </Stack>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow
                              sx={{
                                '& .MuiTableCell-root': {
                                  backgroundColor: theme.palette.grey[50],
                                  py: 0.6,
                                  border: 1,
                                  borderColor: theme.palette.grey[200]
                                }
                              }}
                            >
                              <TableCell
                                sx={{
                                  pl: '60px !important',
                                  textWrap: 'nowrap',
                                  textOverflow: 'ellipsis',
                                  overflow: 'hidden',
                                  fontSize: '1.08rem'
                                }}
                              >
                                {item.name}
                              </TableCell>
                              <TableCell>
                                <FaPesoSign style={{ marginLeft: '3px', fontSize: '0.85rem' }} /> {new Intl.NumberFormat().format(item.price)}
                              </TableCell>
                              <TableCell align="center">({item.qty})</TableCell>
                              <TableCell>
                                <FaPesoSign style={{ marginLeft: '3px', fontSize: '0.85rem' }} /> {new Intl.NumberFormat().format(item.amount)}
                              </TableCell>
                              <TableCell>
                                <Stack alignItems="center">
                                  <IconButton size="small" onClick={() => handleRemoveItem(index)}>
                                    <RiDeleteBack2Fill />
                                  </IconButton>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
            <Card
              sx={{
                flexBasis: '40%',
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                gap: 2
              }}
            >
              <PackagesComponent
                disabled={!customerData?.name}
                selectedPackages={selectedPackages}
                handleAddItem={handleAddItem}
                discountApplied={discountApplied}
              />
              {/* <LabTestComponent
                packageTests={items}
                selectedLabTest={selectedLabTest}
                handleAddItem={handleAddItem}
                disabled={!customerData?.name}
              /> */}
            </Card>
          </Stack>
        </Grid>
        <Grid item xs={3} alignSelf="stretch">
          <Stack direction="column" spacing={1.5} height="100%">
            <Card sx={{ p: 3, display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
              <Grid container rowSpacing={0.5} sx={!companyData?.name || items?.length === 0 ? { opacity: 0.5 } : {}}>
                {renderGridItem('Invoice No.:', referenceNumber ?? '---')}
                {renderGridItem('Date:', transactionDate)}
                {renderGridItem(
                  'Status:',
                  <Chip sx={{ backgroundColor: 'success.light', color: 'green' }} label="Active" />
                )}
                <Grid my={1.5} item xs={12}>
                  <Divider />
                </Grid>
                {renderGridItem('Customer Name:', companyData?.name ?? '---')}
                {renderGridItem('Address:', companyData?.address ?? '---')}
                {renderGridItem('Mobile No.:', companyData?.contactNumber ?? '---')}
                {renderGridItem('TIN No.:', companyData?.tin ?? '---')}
                <Grid my={1.5} item xs={12}>
                  <Divider />
                </Grid>
                {renderGridItem('Employee Name:', employeeData?.name ?? '---')}
                {renderGridItem('Address:', employeeData?.address ?? '---')}
                {renderGridItem('Mobile No.:', employeeData?.contactNumber ?? '---')}
                <Grid my={1.5} item xs={12}>
                  <Divider />
                </Grid>
                <>
                  {renderGridItem(
                    'Discount Applied:',
                    `${(appliedDiscount?.value || 0).toFixed(2)} (${appliedDiscount?.type === 'package' || appliedDiscount?.type === 'percentage' ? '%' : 'Fixed'})`,
                    true
                  )}
                  {renderGridItem(
                    'Discount Total:',
                    <>
                      - <FaPesoSign style={{ marginLeft: '3px', fontSize: '0.85rem' }} />
                      {new Intl.NumberFormat().format(appliedDiscount?.totalDiscount || 0)}
                    </>,
                    true
                  )}
                  <Grid my={1.5} item xs={12}>
                    <Divider />
                  </Grid>
                </>
                {renderGridItem('Total items:', `(${items?.length})`)}
                {renderGridItem(
                  'Subtotal:',
                  <>
                    <FaPesoSign style={{ marginLeft: '6px', fontSize: '0.85rem' }} />
                    {new Intl.NumberFormat().format(subTotal?.toFixed(2))}
                  </>
                )}
                {renderGridItem(
                  'Total:',
                  <>
                    <FaPesoSign style={{ marginLeft: '6px', fontSize: '0.85rem' }} />
                    {new Intl.NumberFormat().format(total?.toFixed(2))}
                  </>
                )}
                {renderGridItem(
                  'Tax:',
                  <>
                    <FaPesoSign style={{ marginLeft: '6px', fontSize: '0.85rem' }} />
                    0.00
                  </>
                )}
              </Grid>
              <Button
                sx={{ py: 1.5 }}
                fullWidth
                variant="contained"
                size="large"
                disabled={!customerData?.name || items?.length === 0}
                onClick={() => setCheckout(true)}
              >
                CHECKOUT <FaPesoSign style={{ marginLeft: '10px', fontSize: '0.85rem' }} />
                {new Intl.NumberFormat().format(total?.toFixed(2))}
              </Button>
            </Card>
          </Stack>
        </Grid>
        <AddCustomerModal
          open={addCustomerModalOpen}
          onClose={() => setAddCustomerModalOpen(false)}
        // onAddCustomer={handleAddCustomer}
        />
        <RightDrawer open={drawerOpen} setOpen={setDrawerOpen}>
          {drawerContent === 'history' && (
            <TransactionsSlideBar
              cashierId={sessionItems?._id}
              branch={branch}
              role={sessionItems?.role?.name}
              onRestoreTransaction={handleRestoreTransaction}
            />
          )}
          {drawerContent === 'services' && <ServicesPage />}
          {drawerContent === 'dreport' && <DailyReport cashierId={sessionItems?._id} branchId={branch?.id} />}
        </RightDrawer>

        <NewTransactionDialog open={openNewTransDialog} handleClose={handleDialogClose} handleConfirm={handleDialogConfirm} />
      </Grid>
    </Box>
  );
};

export default PosComponent;
