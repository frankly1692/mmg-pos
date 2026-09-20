// assets
import {
    MdDashboard,
    MdMedicalServices,
    MdCategory,
    MdDiscount,
    MdAccountTree,
    MdAddBox,
    MdPeople,
    MdCorporateFare,
    MdCalendarMonth
} from 'react-icons/md';
import { FaUserDoctor, FaArrowRightArrowLeft } from 'react-icons/fa6';
import Role from 'utils/Role';

// constant
const icons = {
    MdDashboard,
    MdMedicalServices,
    MdCategory,
    MdDiscount,
    MdAccountTree,
    MdAddBox,
    MdPeople,
    FaUserDoctor,
    MdCorporateFare,
    FaArrowRightArrowLeft,
    MdCalendarMonth
};

// ==============================|| DASHBOARD MENU ITEMS ||============================== //

const dashboard = {
    id: 'dashboard',
    title: 'Dashboard',
    type: 'group',
    roles: [Role.ADMIN],
    children: [
        {
            id: 'default',
            title: 'Dashboard',
            type: 'item',
            url: '/dashboard/home',
            icon: icons.MdDashboard,
            roles: [Role.CASHIER],
            breadcrumbs: false
        },
        {
            id: 'bookings',
            title: 'Bookings',
            type: 'item',
            url: '/dashboard/bookings',
            icon: icons.MdCalendarMonth,
            breadcrumbs: false
        },
        {
            id: 'customers',
            title: 'Customers',
            type: 'item',
            url: '/dashboard/customers',
            icon: icons.MdPeople,
            breadcrumbs: false
        },
        {
            id: 'packages',
            title: 'Packages',
            type: 'item',
            url: '/dashboard/packages',
            icon: icons.MdAddBox,
            breadcrumbs: false
        },
        ,
        {
            id: 'labtest',
            title: 'Diagnostics',
            type: 'item',
            url: '/dashboard/labtest',
            icon: icons.MdMedicalServices,
            breadcrumbs: false
        },
        {
            id: 'labtest-categories',
            title: 'Diagnostics Categories',
            type: 'item',
            url: '/dashboard/labtest-categories',
            icon: icons.MdCategory,
            breadcrumbs: false
        },
        {
            id: 'discounts',
            title: 'Discounts',
            type: 'item',
            url: '/dashboard/discounts',
            icon: icons.MdDiscount,
            breadcrumbs: false
        },
        {
            id: 'branches',
            title: 'Branches',
            type: 'item',
            url: '/dashboard/branches',
            icon: icons.MdAccountTree,
            breadcrumbs: false
        },
        {
            id: 'doctors',
            title: 'Doctors',
            type: 'item',
            url: '/dashboard/doctors',
            icon: icons.FaUserDoctor,
            breadcrumbs: false
        },
        {
            id: 'corporates',
            title: 'Corporates',
            type: 'item',
            url: '/dashboard/corporates',
            icon: icons.MdCorporateFare,
            breadcrumbs: false
        },
        {
            id: 'transactions',
            title: 'Transactions',
            type: 'item',
            url: '/dashboard/transactions',
            icon: icons.FaArrowRightArrowLeft,
            breadcrumbs: false,
            roles: [Role.CASHIER]
        }
    ]
};

export default dashboard;
