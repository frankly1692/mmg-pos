import { lazy } from 'react';

import Loadable from 'ui-component/Loadable';
import MinimalLayout from 'layout/MinimalLayout';

const Page404 = Loadable(lazy(() => import('views/pages/DefaultPages/Page404')));

const DefaultRoutes = {
    path: '/',
    element: <MinimalLayout />,
    children: [
        {
            path: '/404',
            element: <Page404 />
        },
        // Catches any URL that doesn't match a route in MainRoutes/PosRoutes/AuthRoutes (as
        // opposed to '/404', which AuthorizeRoute navigates to explicitly on a role mismatch) —
        // without this, an unknown URL falls through to react-router's default error boundary
        // instead of the app's own 404 page.
        {
            path: '*',
            element: <Page404 />
        }
    ]
};

export default DefaultRoutes;
