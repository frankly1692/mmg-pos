import print from "api/print"
import { PrinterWrapper, usePrinter } from "providers/PrinterProvider";
import { useState } from "react";
import { useMutation } from "react-query"


const WithPrintMutation = ({ children }) => {
    const { print } = usePrinter()
    // const { mutateAsync: printAsync } = useMutation(print.Print)
    // let printer;
    
    // const ePosDev = new epson.ePOSDevice(); 
    // function connect() { 
    //     const ipAddress = '192.168.192.168'; var port = '9100'; 
    //     ePosDev.connect(ipAddress, port, callback_connect); 
    // }
    
    // function callback_connect(resultConnect){ 
    //     var deviceId = 'local_printer'; 
    //     var options = {'crypto' : false, 'buffer' : false}; 
    //     if ((resultConnect == 'OK') || (resultConnect == 'SSL_CONNECT_OK')) { //Retrieves the Printer object 
    //         ePosDev.createDevice(deviceId, ePosDev.DEVICE_TYPE_PRINTER, options, callback_createDevice);
    //     } 
    //     else { 
    //         //Displays error messages 
    //         alert('cant connect')
    //     } 
    // }

    // function callback_createDevice(deviceObj, errorCode){ 
    //     if (deviceObj === null) { //Displays an error message if the system fails to retrieve the Printer object 
    //         alert('deviceObj is null')

    //         return; 
    //     } 
    //     printer = deviceObj; //Registers the print complete event 
    //     printer.onreceive = function(response){ 
    //         if (response.success) { 
    //             alert(ePosDev.isConnected)
    //             // alert(JSON.stringify(printer))
    //             // printer.addTextAlign(printer.ALIGN_CENTER); 
    //             // printer.addText('Hello World\n');
    //             // printer.send()
    //             //Displays the successful print message 
    //         } else { 
                
    //             //Displays error messages } 
    //         }; 
    //     }
    // }

    // const onPrint2 = async(data) => {
    //     const builder = new epson.ePOSBuilder();  
       

    //     builder.addText('Hello, World!\n');  
    //     builder.addCut();  
    //     const request = builder.toString();   
    //     const address = 'http://192.168.192.168:9100/cgi-bin/epos/service.cgi?devid=local_printer';  
    //     const epos = new epson.ePOSPrint(address);  
    //     epos.onreceive = function (res) {    
    //         if (res.success) {
    //             alert('received ', res.printjobid) 
    //         } 
    //     }  
    //     epos.onerror = function (err) { 
    //         alert(JSON.stringify(err)); 
    //     };  
    //     epos.send(request);
        
    // }

    // const onPrint3 = () => {
    //     connect()
    // }
       
    const onPrint = async(data) => {
        try {
            const trialMode = JSON.parse(localStorage.getItem('printerTrialMode') || 'false')

            // Print once in trial mode, 3 times in normal mode
            const printCount = trialMode ? 1 : 3

            for (let i = 0; i < printCount; i++) {
                const result = await print("printer", "receipt", data)
                // Another print is running, or the printer is unavailable: the remaining copies
                // would only fail the same way (and each waits out the helper's connection retry).
                if (result?.busy || result?.error) break
            }
        } catch (e) {
            throw e
        }
    }

    return children({ onPrint: onPrint })
}


export default WithPrintMutation