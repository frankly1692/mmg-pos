# pos-helper-app Setup

Developer setup and troubleshooting. For what the helper does, its config and the installer, see [README.md](README.md).

## Development setup

```bash
cd pos-helper-app

# Fresh virtual environment (delete .venv first if you have an old one)
python -m venv .venv
.venv\Scripts\activate                  # PowerShell: .venv\Scripts\Activate.ps1 · Git Bash: source .venv/Scripts/activate

pip install --upgrade pip
pip install -r helper/requirements.txt

cd helper
python app.py                           # tray icon + WebSocket server
python app.py --no-tray                 # headless, output on the console
```

Expected startup output (also written to `helper.log`):

```
Config loaded from C:\MMG-POS — MIN: ---, SN: ---, PTU: ---
Printer: 192.168.192.168  Display: COM3  WS port: 9999
[CONFIG WARN] MIN is not set (receipts will show a placeholder)
...
[OK] WebSocket server listening on ws://127.0.0.1:9999
```

To keep development data out of `C:\MMG-POS`, point the helper at another folder:

```powershell
$env:MMG_POS_DATA_DIR = "$env:TEMP\mmg-dev"
python app.py
```

Starting the helper takes over port 9999: it stops whatever is already listening there (including an installed helper on the same PC).

## Build the workstation installer

```powershell
# Once: Inno Setup 6 (https://jrsoftware.org/isdl.php) or `choco install innosetup -y` in an administrator terminal
cd pos-helper-app
.\build-installer.ps1
```

This runs `pyinstaller mmg-helper.spec` (in `helper/`) and compiles `installer\mmg-helper.iss` to `installer\Output\MMG-Helper-Setup.exe`. Cashier PCs need only that file — no Python, no Inno Setup.

When adding a dependency, add it to `helper/requirements.txt` and to `hiddenimports` in `helper/mmg-helper.spec`.

## Files

```
pos-helper-app/
├── helper/
│   ├── app.py               # WebSocket server, printing, display, e-journal
│   ├── tray.py              # Tray icon, Settings + Logs window
│   ├── config.py            # config.json load / validate / save
│   ├── logsetup.py          # print() -> helper.log
│   ├── requirements.txt
│   └── mmg-helper.spec      # PyInstaller (windowed: console=False)
├── installer/
│   └── mmg-helper.iss       # Inno Setup script
├── build-installer.ps1      # Builds exe + installer
├── config.json.example      # Template for C:\MMG-POS\config.json
├── test_printer.py / .ps1   # Manual printer checks
└── test_websocket.py        # Manual WebSocket check
```

## Troubleshooting

Start with the tray icon (colour and tooltip) and **Settings and Logs...** (log panel on the right). The log shows every request and why it failed.

### Yellow icon: "Printer ... unreachable"
The helper still journals receipts. Check the printer is on, on the network, and that `printer_ip` in Settings is right. The check connects to TCP port 9100.

### Yellow icon: "BIR not set"
`MIN`, `SN` or `PTU_NO` in `config.json` are still placeholders. Open **Settings and Logs...** and enter the values BIR issued for this terminal.

### Red icon
The WebSocket server is not running. The tooltip and log give the reason — usually the port is held by another program, or `config.json` has an invalid `ws_port`.

### Browser cannot connect / nothing prints
The frontend connects to `ws://localhost:9999` (`mmg-app/src/providers/PrinterProvider.jsx`). Check the helper is running and `ws_port` is 9999.

### Test print says "Printer unavailable"
The printer did not accept a connection. The error text in the response and log names the address. A receipt in the same situation is journaled and reports "Journaled successfully (printer unavailable)".

### VFD display not responding
Check the cable, that `display_port` matches the port in Device Manager, and baudrate 9600. The display is optional; receipts still print.

### `config.json` problems
A malformed or unreadable file makes the helper use defaults and log the reason. Fix the JSON, or delete the file to regenerate it (an old `terminal.json` is migrated if present).

### `python: command not found` / `No module named ...` (development)
Install Python 3.10+ with "Add Python to PATH", activate `.venv`, and run `pip install -r helper/requirements.txt`.

### `ModuleNotFoundError` in the built exe
Add the module to `hiddenimports` in `helper/mmg-helper.spec` and rebuild.
