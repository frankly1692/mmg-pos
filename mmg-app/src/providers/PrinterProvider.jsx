import { createContext, useContext, useEffect, useState } from "react";

export const PrinterContext = createContext()

const statuses = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']
const PrinterProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [printing, setPrinting] = useState(false)
    const [status, setStatus] = useState(statuses[3])

    console.log(status)

    useEffect(() => {
        const ws = connect()
        if (ws && ws.readyState === WebSocket.OPEN) {
            display('message')
        }

        return () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [])

    function connect() {
        const ws = new WebSocket('ws://localhost:9876');

        ws.onopen = () => {
            setSocket(ws)
            setStatus(statuses[ws.readyState])
        };

        ws.onclose = () => {
            setSocket(null)
            setStatus(statuses[ws.readyState])
        }

        ws.onmessage = (event) => {
            const response = JSON.parse(event.data);
            setPrinting(false)
        };

        setStatus(statuses[ws.readyState])
        return ws
    }

    function print(device, type, data) {
        let newSocket = socket
        if (newSocket == null || newSocket?.readyState != WebSocket.OPEN) {
            newSocket = connect()
        }

        if (newSocket && newSocket.readyState === WebSocket.OPEN) {
            setPrinting(true)
            newSocket.send(JSON.stringify({ device, device_type: type, ...data }));
        }
    }

    function display(type, data) {
        print("display", type, data)
    }

    return (
        <PrinterContext.Provider value={{ socket, printing, print, status, display }}>
            {children}
        </PrinterContext.Provider>
    )
}

export default PrinterProvider

export const usePrinter = () => {
    return useContext(PrinterContext)
}

export const PrinterWrapper = (Element, props) => () =>
    <PrinterProvider value={props}>
        <Element />
    </PrinterProvider>