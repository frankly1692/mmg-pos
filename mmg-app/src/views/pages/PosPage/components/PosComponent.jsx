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
  Chip,
  CircularProgress,
  Tooltip,
  Box
} from '@mui/material';
import { MdPersonAdd, MdHistory, MdFrontHand, MdLogout, MdAdd, MdList } from 'react-icons/md';
import { BiSolidExit } from 'react-icons/bi';
import { TiHome } from 'react-icons/ti';
import Checkout from './Checkout';
import AddCustomerModal from './AddCustomerModal';
import AddDoctorModal from './AddDoctorModal';
import moment from 'moment';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import packagelab from 'api/package';
import customer from 'api/customer';
import doctor from 'api/doctor';
import transaction from 'api/transaction';
import discount from 'api/discount';
import { FaPesoSign } from 'react-icons/fa6';
import { RiDeleteBack2Fill } from 'react-icons/ri';
import PackageContainer from './PackageContainer';
import PromoContainer from './PromoContainer';
import LabTestContainer from './LabTestContainer';

// component import
import RightDrawer from 'ui-component/drawer/rightDrawer';
import TransactionsSlideBar from './TransactionsSideBar';
import { useMediaQuery } from '@mui/system';
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
import { useCashierReport } from '..';
import { useNavigate } from 'react-router-dom';
import print from 'api/print';
import { usePrinter } from 'providers/PrinterProvider';

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

const calculatePackagePrice = (packageItem) => {
  const packageLabTestPrice = packageItem.labTest.reduce((acc, labTest) => acc + labTest.price, 0);

  let discountedPrice;
  let originalPrice = packageLabTestPrice;

  // Apply discount based on type (if applicable)
  if (packageItem.discount) {
    const discountValue = packageItem.discount.value;
    switch (packageItem.discount.type) {
      case 'percentage':
        discountedPrice = originalPrice - (originalPrice * discountValue) / 100;
        break;
      case 'fixed':
        discountedPrice = originalPrice - discountValue;
        break;
      default:
        console.error('Invalid discount type:', packageItem.discount.type);
        break;
    }
  }

  return {
    discountedPrice: discountedPrice || originalPrice, // Use discountedPrice if available, otherwise originalPrice
    originalPrice
  };
};

const PosComponent = () => {
  const { status: printerStatus, display: showCustomerDisplay } = usePrinter()

  const { control, reset, setValue } = useForm({
    defaultValues: {
      customer: null,
      requestedBy: null,
      referredBy: null
    }
  });

  const { branch } = useAuth();
  const { getDrawerBalance, isRefetching: isReportRefetching } = useCashierReport();

  const [openNewTransDialog, setNewTransDialog] = useState(false);
  const [isNewTrans, setIsNewTrans] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [subTotal, setSubTotal] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [checkout, setCheckout] = useState(false);
  const [ifLogout, setIfLogout] = useState(false);
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  const [addDoctorModalOpen, setAddDoctorModalOpen] = useState(false);
  const [referredBy, setReferredBy] = useState({ id: null, name: null });
  const [requestedBy, setRequestedBy] = useState({ id: null, name: null });
  const [customerData, setCustomerData] = useState([]);
  const [referenceNumber, setReferenceNumber] = useState(null);
  const [transactionDate, setTransactionDate] = useState(moment().format('MMMM Do YYYY, h:mm a'));
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [sessionItems, setSessionItems] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState();
  const [regDiscount, setRegularDiscount] = useState(0);
  const [regDiscountType, setRegularDiscountType] = useState();

  // do be deleted
  const [isPackageOrPromoAdded, setIsPackageOrPromoAdded] = useState(false);
  const [discountApplied, setDiscountApplied] = useState(false);
  //

  // const { data: packages } = useQuery('packages', packagelab.GetAllPackages);
  const { data: doctorlist } = useQuery('doctors', doctor.GetAllDoctor);
  const { data: discountsData } = useQuery('discounts', discount.GetAllDiscounts);

  // const { data: totalSales } = useQuery(
  //   ['transaction', sessionItems?._id, branch?.id],
  //   () => transaction.GetSales(sessionItems?._id, branch?.id),
  //   {
  //     enabled: !!sessionItems?._id // Only run the query if a transaction ID is set
  //   }
  // );

  const [combinedDoctorData, setCombinedDoctorData] = useState([]);
  const [selectedPackages, setSelectedPackages] = useState([]);
  const [selectedLabTest, setSelectedlabTest] = useState([]);
  const [transactionData, setTransactionData] = useState([]);

  const [selectedPackagesX, setSelectedPackagesX] = useState({
    packages: [],
    promos: [],
    labtests: []
  });

  const navigate = useNavigate();

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
      queryClient.setQueryData('transactions', (old) => old?.map((cat) => (cat._id === updatedTransaction._id ? updatedTransaction : cat)));
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
      setAppliedDiscount(null);
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

  useEffect(() => {
    let totalPackagePrice = { discountedPrice: 0, originalPrice: 0 };
    let totalPromoPrice = { discountedPrice: 0, originalPrice: 0 };
    let totalLabTestPrice = selectedPackagesX?.labtests?.reduce((acc, labTest) => acc + labTest.price, 0);
    let totalLabTestDiscountedPrice = totalLabTestPrice;

    // Case: Packages and promos
    if (selectedPackagesX.packages.length > 0) {
      totalPackagePrice = selectedPackagesX.packages.reduce(
        (acc, packageItem) => {
          const packagePrices = calculatePackagePrice(packageItem);
          return {
            discountedPrice: acc.discountedPrice + packagePrices.discountedPrice,
            originalPrice: acc.originalPrice + packagePrices.originalPrice
          };
        },
        { discountedPrice: 0, originalPrice: 0 }
      );
    }

    if (selectedPackagesX.promos.length > 0) {
      totalPromoPrice = selectedPackagesX.promos.reduce(
        (acc, promoItem) => {
          const promoPrices = calculatePackagePrice(promoItem);
          return {
            discountedPrice: acc.discountedPrice + promoPrices.discountedPrice,
            originalPrice: acc.originalPrice + promoPrices.originalPrice
          };
        },
        { discountedPrice: 0, originalPrice: 0 }
      );
    }

    // Case: Apply discount to lab tests with package discount
    if (selectedPackagesX.packages.length > 0 && selectedPackagesX.packages[0].discount) {
      const packageDiscount = selectedPackagesX.packages[0].discount;
      if (packageDiscount.type === 'percentage') {
        totalLabTestDiscountedPrice = totalLabTestPrice - totalLabTestPrice * (selectedPackagesX.packages[0].discount.value / 100);
      }
    }


    // Combine prices (packages, promos, lab tests)
    const grandPackagePrice = {
      originalPrice: totalPackagePrice.originalPrice + totalLabTestPrice,
      discountedPrice: totalPackagePrice.discountedPrice + totalLabTestDiscountedPrice
    };

    // Calculate the grand total (includes promos if any)
    const grandTotalOriginalPrice = grandPackagePrice.originalPrice + totalPromoPrice.originalPrice;
    const grandTotalDiscountedPrice = grandPackagePrice.discountedPrice + totalPromoPrice.discountedPrice;

    // Set subtotal and total
    setSubTotal(grandTotalOriginalPrice);
    setTotal(grandTotalDiscountedPrice);

    console.log('customerData', customerData)
    console.log('selectedPackagesX.packages', selectedPackagesX.packages)

    // Apply discount logic
    if (
      selectedPackagesX.packages.length > 0 &&
      selectedPackagesX.packages[0].discount &&
      customerData?.customerType === 'seniorcitizenpwd'
    ) {
      setAppliedDiscount({
        type: 'percentage',
        value: selectedPackagesX.packages[0].discount.value,
        name: selectedPackagesX.packages[0].discount.name,
        totalDiscount: (totalPackagePrice.originalPrice + totalLabTestPrice) * (selectedPackagesX.packages[0].discount.value / 100)
      });
    } else if (
      selectedPackagesX.packages.length > 0 &&
      selectedPackagesX.packages[0].discount &&
      customerData?.customerType !== 'seniorcitizenpwd'
    ) {
      setAppliedDiscount({
        type: 'percentage',
        value: selectedPackagesX.packages[0].discount.value,
        name: selectedPackagesX.packages[0].discount.name,
        totalDiscount: (totalPackagePrice.originalPrice + totalLabTestPrice) * (selectedPackagesX.packages[0].discount.value / 100)
      });
    } else if (regDiscount) {
      setAppliedDiscount({
        type: regDiscountType,
        value: regDiscount,
        totalDiscount: totalLabTestPrice ? (totalLabTestPrice * regDiscount) / 100 : totalLabTestPrice
      });
    } else if (selectedPackagesX.packages.length === 0 && selectedPackagesX.promos.length === 0) {
      setAppliedDiscount(null);
    }

    // Count total items (lab tests and packages)
    const totalPackageLabTests = selectedPackagesX.packages.reduce((acc, packageItem) => acc + packageItem.labTest.length, 0);
    const totalPromoLabTests = selectedPackagesX.promos.reduce((acc, promoItem) => acc + promoItem.labTest.length, 0);
    const totalLabTests = selectedPackagesX.labtests.length;

    const grandTotalItems = totalPackageLabTests + totalPromoLabTests + totalLabTests;
    setTotalItems(grandTotalItems);
  }, [selectedPackagesX]);

  const handleAddItem = async (item) => {
    console.warn('transaction-item', item);

    switch (item?.packageType) {
      case 'package':

        const packageItems = {
          ...item,
          _id: item?._id,
          source: 'package',
          labTest: item?.labTest.map((test) => ({
            qty: 1, // Ensure quantity is always 1
            price: test.price,
            amount: test.price * 1,
            ...test
          }))
        };

        setSelectedPackagesX((prev) => ({
          ...prev,
          packages: [...prev.packages, packageItems]
        }));

        break;
      case 'promo':
        if (selectedPackagesX.promos.length > 0) {
          // You can show an error message here or handle it differently
          console.error('Only one promo can be added at a time.');
          alert('Only one promo can be added at a time.');
          return; // Stop further execution
        }
        const promoItems = {
          ...item,
          _id: item?._id,
          source: 'promo',
          labTest: item?.labTest.map((test) => ({
            qty: 1, // Ensure quantity is always 1
            price: test.price,
            amount: test.price * 1,
            ...test
          }))
        };

        setSelectedPackagesX((prev) => ({
          ...prev,
          promos: [...prev.promos, promoItems]
        }));
        break;
      default:
        // Handle unexpected package types here (e.g., log an error)

        item = {
          source: 'labTest',
          qty: 1,
          price: item?.price,
          amount: item?.price,
          ...item
        };

        setSelectedPackagesX((prev) => ({
          ...prev,
          labtests: [...prev.labtests, item]
        }));
        break;
    }

    if (['package', 'promo'].includes(item.packageType)) {
      await showCustomerDisplay('item', { ...item, price: item.totalDiscountedPrice })
    } else {
      await showCustomerDisplay('item', { ...item })
    }
  };

  console.log('selectedPackagesX', selectedPackagesX);
  // console.log('totalPackagePrice', totalPackagePrice)
  // console.log('totalPromoPrice', totalPromoPrice)
  // console.log('totalLabTestPrice', totalLabTestPrice)

  const handleRemovePackageItem = (item) => {
    console.log('remove', item);
    setSelectedPackagesX((prev) => ({
      ...prev,
      packages: prev.packages.filter((packageItem) => packageItem._id !== item._id)
    }));
    setIsPackageOrPromoAdded(false);
    setSelectedPackages([]);
  };

  const handleRemovePromoItem = (item) => {
    setSelectedPackagesX((prev) => ({
      ...prev,
      promos: prev.promos.filter((promoItem) => promoItem._id !== item._id)
    }));
    setIsPackageOrPromoAdded(false);
  };

  const handleRemoveLabTestItem = (item) => {
    setSelectedPackagesX((prev) => ({
      ...prev,
      labtests: prev.labtests.filter((labTest) => labTest._id !== item._id)
    }));

    // Check if labtests array is empty after removing the item
    if (selectedPackagesX.labtests.length === 1) {
      setRegularDiscount(0);
    }
  };

  const handleClearItems = async (id, reason) => {

    const combinedDataX = [...selectedPackagesX.packages, ...selectedPackagesX.promos, ...selectedPackagesX.labtests];
    const newMapData = {
      id: id,
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
      discountApplied: appliedDiscount,
      promoDiscount: selectedPackagesX.promos[0]?.discount?.value || 0,
      subTotal: subTotal,
      paymentDue: total,
      services: combinedDataX,
      status: 'Cancelled',
      reason
    };

    await editTransactionMutation.mutateAsync(newMapData);

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
    setAppliedDiscount(null);
    setIsNewTrans(false);
    setIsPackageOrPromoAdded(false);
    setDiscountApplied(false);
  };

  const handleClearTransItem = async () => {

    setItems([]);
    setAppliedDiscount(null);
    setIsPackageOrPromoAdded(false);
    setDiscountApplied(false);
    setSelectedPackages([]);
    setSelectedlabTest([]);
    setRegularDiscount(0);
    setSelectedPackagesX(() => ({
      packages: [],
      promos: [],
      labtests: []
    }));

    await showCustomerDisplay('item')

  };

  const handleRestoreTransaction = (selectedTransaction) => {
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
        id: selectedTransaction?._id,
        invoiceNumber: selectedTransaction?.invoiceNumber
      });

      setReferenceNumber(selectedTransaction?.invoiceNumber);

      // Refactor to handle both array and single item cases for items
      const services = selectedTransaction?.services;

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
    // Calculate total original price for packages and lab tests
    const totalPackageOriginalPrice = selectedPackagesX.packages.reduce((acc, item) => acc + calculatePackagePrice(item).originalPrice, 0);
    const totalPromoPrice = selectedPackagesX.promos.reduce(
      (acc, promoItem) => {
        const promoPrices = calculatePackagePrice(promoItem);
        return {
          discountedPrice: acc.discountedPrice + promoPrices.discountedPrice,
          originalPrice: acc.originalPrice + promoPrices.originalPrice
        };
      },
      { discountedPrice: 0, originalPrice: 0 }
    );
    const totalLabTestPrice = selectedPackagesX.labtests.reduce((acc, item) => acc + item.price * item.qty, 0);

    // Calculate total discount amount
    let totalAmountWDiscount = 0;
    let totalDiscount = 0;

    console.log('xxx', totalPackageOriginalPrice, totalLabTestPrice);

    if (discount?.type === 'fixed') {
      totalDiscount = discount?.value;
      totalAmountWDiscount = totalPackageOriginalPrice + totalLabTestPrice - discount?.value + totalPromoPrice?.discountedPrice;
    } else {
      totalDiscount = (totalPackageOriginalPrice + totalLabTestPrice) * discount?.value / 100
      totalAmountWDiscount = (totalPackageOriginalPrice + totalLabTestPrice) - ((totalPackageOriginalPrice + totalLabTestPrice) * discount?.value / 100) + totalPromoPrice?.discountedPrice;
    }

    // Calculate new total price
    const newTotal = totalPackageOriginalPrice + totalLabTestPrice + totalPromoPrice?.originalPrice;

    // Check if there's an existing discount and if the new discount is lower
    if (appliedDiscount?.value && ((discount.type === 'percentage' && discount.value < appliedDiscount.value) || (discount.type === 'fixed' && discount.value < appliedDiscount.totalDiscount))) {
      alert('There is already a higher discount applied.');
      return; // Don't apply the new discount
    }

    // Update state variables
    setAppliedDiscount({
      type: discount?.type,
      value: discount?.value,
      name: discount?.name,
      totalDiscount: totalDiscount,
      ...discount,
    });

    setSubTotal(newTotal);
    setTotal(totalAmountWDiscount);
    setRegularDiscount(discount?.value); // Consider if this is still necessary
    setRegularDiscountType(discount?.type);
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
      setReferenceNumber(null);
      setAppliedDiscount(null);
      setIsNewTrans(false);
      setIsPackageOrPromoAdded(false);
      setDiscountApplied(false);
      setCheckout(false);
      handleClearTransItem().then()
    } else {
      setCheckout(false);
    }
  };

  const handleSuccessTrans = (param) => {
    if (param === 'success') {
      queryClient.invalidateQueries(['transaction', sessionItems?._id, branch?.id]);
    }
  };

  const handleSelectedDataChange = (data) => {
    console.log('data', data);
    setCustomerData(data);
  };

  useHotkeys('f1', handleAddDialolgTrans, { preventDefault: true });
  useHotkeys('f2', () => setAddCustomerModalOpen(true), { preventDefault: true });
  useHotkeys('f3', () => setAddDoctorModalOpen(true), { preventDefault: true });
  useHotkeys('f4', () => handleOpenDrawer('history'), { preventDefault: true });
  useHotkeys('f5', () => handleOpenDrawer('services'), { preventDefault: true });
  useHotkeys('f6', () => handleOpenDrawer('dreport'), { preventDefault: true });

  const renderGridItem = (label, value, highlight = false) => (
    <>
      <Grid item xs={5}>
        <Typography fontSize="1.05rem" variant="h4" fontWeight="regular" color={theme.palette.grey[500]}>
          {label}
        </Typography>
      </Grid>
      <Grid item xs={7} sx={{ textWrap: 'wrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <Typography fontSize="1.05rem" sx={highlight ? { color: 'success.dark' } : {}} textAlign="end" variant="h4" textWrap="pretty">
          {value}
        </Typography>
      </Grid>
    </>
  );

  const theme = useTheme();
  const smallScreenSize = useMediaQuery(theme.breakpoints.down('xl'));

  // Separate doctors into members and non-members
  const members = combinedDoctorData.filter((doctor) => doctor.isMember);
  const nonMembers = combinedDoctorData.filter((doctor) => !doctor.isMember);

  // Combine them into a single array with a type property
  const optionsD = [
    ...nonMembers.map((doctor) => ({ ...doctor, type: 'Non-Members' })),
    ...members.map((doctor) => ({ ...doctor, type: 'Members' }))
  ];

  const combinedDataX = [...selectedPackagesX.packages, ...selectedPackagesX.promos, ...selectedPackagesX.labtests];

  const combinedData = {
    id: transactionData?.id,
    invoiceNumber: transactionData?.invoiceNumber,
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
    discountApplied: appliedDiscount,
    promoDiscount: selectedPackagesX.promos[0]?.discount?.value || 0,
    subTotal: subTotal,
    paymentDue: total,
    items: combinedDataX
  };

  if (checkout) {
    return <Checkout combinedData={combinedData} handleBack={handleBackPos} handleSuccessTrans={handleSuccessTrans} />;
  }

  if (ifLogout) {
    return <CashRegister isEndingBalanceFlag={ifLogout} handleBack={() => setIfLogout(false)} />;
  }

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
                <Tooltip title="Go To Dashboard">
                  <IconButton>
                    <TiHome onClick={() => navigate('/dashboard/home')} />
                  </IconButton>
                </Tooltip>
              </Card>
            </Stack>
            <Stack direction="row-reverse" spacing={1}>
              <Card sx={{ px: 3, py: 2, flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Stack sx={{ opacity: isReportRefetching ? 0.5 : 1 }} justifyContent="center" flex={1}>
                  <Typography variant="subtitle2">Drawer Balance</Typography>
                  <Typography variant="h1" fontWeight="bold">
                    <FaPesoSign style={{ fontSize: '0.85rem' }} />
                    {getDrawerBalance() !== undefined ? new Intl.NumberFormat().format(parseFloat(getDrawerBalance())) : '0.00'}
                  </Typography>
                </Stack>
                {isReportRefetching ? (
                  <CircularProgress size="2rem" />
                ) : (
                  <Tooltip title="Time Out">
                    <IconButton>
                      <BiSolidExit onClick={() => setIfLogout(true)} />
                    </IconButton>
                  </Tooltip>
                )}
              </Card>
            </Stack>
            <Card sx={{ p: 3 }}>
              <Stack direction="column" spacing={1.8}>
                <Typography variant="h4">Customer</Typography>
                <CusCorSelect
                  name="selection"
                  control={control}
                  isNewTrans={isNewTrans}
                  onSelectedDataChange={handleSelectedDataChange}
                  customerData={customerData}
                  label="Search"
                />
                {/* {customerData?.customerType === 'corporate' && (
                  <Controller
                    name="employee"
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
                )} */}
                <Controller
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
                      options={optionsD}
                      getOptionLabel={(option) => option.fullName}
                      onChange={(e, value) => {
                        field.onChange(value); // Update react-hook-form
                        setReferredBy({ id: value?.id, name: value?.fullName }); // Update customer data
                      }}
                      value={field.value || combinedDoctorData.find((doctor) => doctor.id === referredBy?.id) || null} // Use field.value or find the doctor by ID
                      disabled={!isNewTrans}
                      groupBy={(option) => option.type} // Group by the type added
                      renderInput={(params) => <TextField {...params} label="Referred By" variant="outlined" fullWidth />}
                    />
                  )}
                />
              </Stack>
            </Card>
            <Card sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography mb={1} variant="h4">
                Actions
              </Typography>
              <Grid container spacing={0.5}>
                {[
                  { label: 'New Trans (F1)', icon: <MdAdd />, onclick: handleAddDialolgTrans },
                  // { label: 'Hold (F3)', icon: <MdFrontHand />, onclick: handleHoldTransaction },
                  { label: 'New Cust (F2)', icon: <MdPersonAdd />, onclick: () => setAddCustomerModalOpen(true) },
                  { label: 'New Doctor (F3)', icon: <MdPersonAdd />, onclick: () => setAddDoctorModalOpen(true) },
                  { label: 'History (F4)', icon: <MdHistory />, onclick: () => handleOpenDrawer('history') },
                  { label: 'Services (F5)', icon: <MdList />, onclick: () => handleOpenDrawer('services') },
                  { label: 'Report (F6)', icon: <MdList />, onclick: () => handleOpenDrawer('dreport') }
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
                <Grid item xs={12} lg={6}>
                  <DiscountComponent
                    disabled={!customerData?.name}
                    onSelectDiscount={handleSelectDiscount}
                    discountsData={discountsData}
                  />
                </Grid>
                <Grid item xs={12} lg={6}>
                  <HoldItems
                    transaction={combinedData}
                    onSuccess={() => handleBackPos('success')}
                    disabled={!customerData?.name}
                  />
                </Grid>
                <Grid item xs={12} lg={6}>
                  <ClearComponent />
                </Grid>
              </Grid>
              <div style={{ flex: 1 }}></div>
              <Typography variant="h5" fontWeight="regular">
                Printer: {printerStatus}
              </Typography>
              <Typography variant="h5" fontWeight="regular">
                {import.meta.env.VITE_APP_VERSION}
              </Typography>
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
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                <Typography mb={2} variant="h4">
                  Transaction Items
                </Typography>
                <Button variant="outlined" color="error" onClick={() => handleClearTransItem()}>
                  Clear
                </Button>
              </Stack>
              <TableContainer
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  flexBasis: 0.75,
                  opacity:
                    selectedPackagesX?.packages?.length === 0 &&
                      selectedPackagesX?.promos?.length === 0 &&
                      selectedPackagesX?.labtests?.length === 0
                      ? 0.5
                      : 1,
                  mt: 2,
                  gap: 2
                }}
              >
                {selectedPackagesX?.packages?.length === 0 &&
                  selectedPackagesX?.promos?.length === 0 &&
                  selectedPackagesX?.labtests?.length === 0 && (
                    <Table>
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
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            No items added yet
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                {selectedPackagesX?.packages?.length !== 0 && (
                  <PackageContainer items={selectedPackagesX.packages} onRemoveItem={handleRemovePackageItem} />
                )}
                {selectedPackagesX?.promos?.length !== 0 && (
                  <PromoContainer items={selectedPackagesX.promos} onRemoveItem={handleRemovePromoItem} />
                )}
                {selectedPackagesX?.labtests?.length !== 0 && (
                  <LabTestContainer
                    items={selectedPackagesX.labtests}
                    onRemoveItem={handleRemoveLabTestItem}
                    regDiscount={regDiscount}
                    regDiscountType={regDiscountType}
                  />
                )}
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
                customer={customerData}
                disabled={!customerData?.name}
                selectedPackages={selectedPackages}
                handleAddItem={handleAddItem}
                setIsPackageOrPromoAdded={setIsPackageOrPromoAdded}
              />
              <LabTestComponent
                packageTests={selectedPackagesX.packages}
                selectedLabTest={selectedLabTest}
                handleAddItem={handleAddItem}
                disabled={!customerData?.name}
              />
            </Card>
          </Stack>
        </Grid>
        <Grid item xs={3} alignSelf="stretch">
          <Stack direction="column" spacing={1.5} height="100%">
            <Card sx={{ p: 3, display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
              <Grid
                container
                rowSpacing={0.5}
                sx={
                  !customerData?.name ||
                    (selectedPackagesX?.packages?.length === 0 &&
                      selectedPackagesX?.promos?.length === 0 &&
                      selectedPackagesX?.labtests?.length === 0)
                    ? { opacity: 0.5 }
                    : {}
                }
              >
                {renderGridItem('Invoice No.:', referenceNumber ?? '---')}
                {renderGridItem('Date:', transactionDate)}
                {renderGridItem('Status:', <Chip sx={{ backgroundColor: 'success.light', color: 'green' }} label="Active" />)}
                <Grid my={1.5} item xs={12}>
                  <Divider />
                </Grid>
                {renderGridItem('Customer Name:', customerData?.name ?? '---')}
                {renderGridItem('Address:', customerData?.address ?? '---')}
                {customerData?.type === 'customer' && (
                  <>
                    {renderGridItem('Age:', customerData?.age ?? '---')}
                    {renderGridItem('Birth Date:', customerData?.birthDate ?? '---')}
                  </>
                )}
                {renderGridItem('Mobile No.:', customerData?.contactNumber ?? '---')}
                {renderGridItem('TIN No.:', customerData?.tin ?? '---')}
                <Grid my={1.5} item xs={12}>
                  <Divider />
                </Grid>
                {renderGridItem('Requested By:', requestedBy?.name ?? '---')}
                {renderGridItem('Referred By:', referredBy?.name ?? '---')}
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
                  {renderGridItem(
                    'Promo Discount:',
                    <>
                      - <FaPesoSign style={{ marginLeft: '3px', fontSize: '0.85rem' }} />
                      {new Intl.NumberFormat().format(selectedPackagesX.promos[0]?.discount?.value || 0)}
                    </>,
                    true
                  )}
                  <Grid my={1.5} item xs={12}>
                    <Divider />
                  </Grid>
                </>
                {renderGridItem('Total items:', `(${totalItems})`)}
                {renderGridItem(
                  'Subtotal:',
                  <>
                    <FaPesoSign style={{ marginLeft: '6px', fontSize: '0.85rem' }} />
                    {subTotal?.toFixed(2)}
                  </>
                )}
                {renderGridItem(
                  'Total:',
                  <>
                    <FaPesoSign style={{ marginLeft: '6px', fontSize: '0.85rem' }} />
                    {total?.toFixed(2)}
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
                disabled={
                  !customerData?.name ||
                  (selectedPackagesX?.packages?.length === 0 &&
                    selectedPackagesX?.promos?.length === 0 &&
                    selectedPackagesX?.labtests?.length === 0)
                }
                onClick={() => setCheckout(true)}
              >
                CHECKOUT <FaPesoSign style={{ marginLeft: '10px', fontSize: '0.85rem' }} />
                {total?.toFixed(2)}
              </Button>
            </Card>
          </Stack>
        </Grid>
        <AddCustomerModal
          open={addCustomerModalOpen}
          onClose={() => setAddCustomerModalOpen(false)}
        // onAddCustomer={handleAddCustomer}
        />
        <AddDoctorModal open={addDoctorModalOpen} onClose={() => setAddDoctorModalOpen(false)}></AddDoctorModal>
        <RightDrawer open={drawerOpen} setOpen={setDrawerOpen}>
          {drawerContent === 'history' && (
            <TransactionsSlideBar
              cashierId={sessionItems?._id}
              branch={branch}
              role={sessionItems?.role?.name}
              onRestoreTransaction={handleRestoreTransaction}
            />
          )}
          {drawerContent === 'services' && <ServicesPage mode="view" />}
          {drawerContent === 'dreport' && <DailyReport cashierId={sessionItems?._id} branchId={branch?.id} />}
        </RightDrawer>

        <NewTransactionDialog open={openNewTransDialog} handleClose={handleDialogClose} handleConfirm={handleDialogConfirm} />
      </Grid>
    </Box>
  );
};

export default PosComponent;
