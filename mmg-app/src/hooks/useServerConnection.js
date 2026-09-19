import { useEffect, useRef, useState } from 'react';
import branch from 'api/branch';

// ==============================|| SERVER CONNECTION STATUS HOOK ||============================== //
// navigator.onLine only reflects the device's own network interface, not whether the local
// POS server is actually reachable — this app runs on a LAN where the browser can report
// "online" while the branch's Flask server is down. Pings a lightweight, auth-free GET
// (/branches) on an interval to verify real reachability, and reacts instantly to the
// browser's own online/offline events so a pulled network cable doesn't wait for the next poll.
const PING_INTERVAL_MS = 10000;

const useServerConnection = () => {
    const [isConnected, setIsConnected] = useState(navigator.onLine);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        const checkServer = () => {
            if (!navigator.onLine) {
                if (mounted.current) setIsConnected(false);
                return;
            }

            branch
                .GetAllBranch()
                .then(() => {
                    if (mounted.current) setIsConnected(true);
                })
                .catch(() => {
                    if (mounted.current) setIsConnected(false);
                });
        };

        const handleOffline = () => setIsConnected(false);
        const handleOnline = () => checkServer();

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        checkServer();
        const interval = setInterval(checkServer, PING_INTERVAL_MS);

        return () => {
            mounted.current = false;
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
            clearInterval(interval);
        };
    }, []);

    return isConnected;
};

export default useServerConnection;
