# pos-helper-app

Windows tray app that bridges the POS browser (mmg-app) to physical hardware on each cashier workstation. Runs locally on every cashier PC — not in Docker.

## Architecture

```
Browser (mmg-app)
    └──[WebSocket ws://localhost:9999]──► helper/app.py
                                              ├── ESC/POS Printer (TCP/IP, port 9100)
                                              └── VFD Customer Display (serial, default COM3)
```

- `app.py` — WebSocket server (`HelperServer`, runs on a background thread), printing, display, e-journal.
- `tray.py` — system tray icon on the main thread: status colour, Test Print, Settings, Log viewer. Tk windows share one UI thread.
- `config.py` — loads, validates and saves `config.json`.
- `logsetup.py` — sends `print()` output to `helper.log` (the windowed exe has no console).
- `ReceiptWriter` — opens `ejournal.txt` once per transaction and writes to the file and the printer together. Journals even when the printer is offline; an offline printer is reported in the response.
- Blocking hardware calls use `asyncio.to_thread`, so the WebSocket stays responsive during long print jobs.

## Files on a workstation (`C:\MMG-POS`)

| File | Purpose |
|---|---|
| `mmg-helper.exe` | The helper |
| `config.json` | Per-workstation settings (below) |
| `ejournal.txt` | Append-only e-journal (BIR record — keep it) |
| `helper.log` | Requests, responses, errors, printer status. Rotates at 5 MB, keeps one previous file (`helper.log.1`) |

Override the folder with the `MMG_POS_DATA_DIR` environment variable (development).

## `config.json`

```json
{
  "MIN": "123-456789-0",
  "SN": "S/N0000012345",
  "PTU_NO": "PTU-000000000001",
  "printer_ip": "192.168.192.168",
  "display_port": "COM3",
  "display_baudrate": 9600,
  "ws_port": 9999
}
```

- `MIN`, `SN`, `PTU_NO` — BIR credentials, issued per terminal. Printed on every receipt and report. Never stored in the database.
- `printer_ip` — used unless the browser sends `settings.url` (the printer test does).
- `display_port` / `display_baudrate` — customer display serial port.
- `ws_port` — WebSocket port. The frontend connects to `9999`; do not change it unless you also change `PrinterProvider.jsx`.

Created with defaults on first run. A legacy `terminal.json` (MIN/SN/PTU_NO only) is migrated automatically if `config.json` does not exist. Edit via the tray **Settings and Logs...** window (validates, saves, restarts the server) or by hand, then choose **Restart** from the tray menu.

Bad or missing values never stop the helper starting: it falls back to defaults and logs why. The tray icon turns yellow while BIR credentials are still placeholders.

## Tray icon

| Colour | Meaning |
|---|---|
| Green | Server running, printer reachable, BIR credentials set |
| Yellow | Printer unreachable (receipts journal only), or BIR credentials not set |
| Red | Server not running (port in use, crash) |

Menu: Test Print · Settings and Logs... · Open Journal Folder · Restart · Quit.

**Settings and Logs...** (also the double-click action) opens one full-screen window: settings, live status, a Test Print box (free text, uses the printer IP in the field) and E-Journal buttons (Open in Notepad, Print E-Journal) on the left, the log on the right.

The log panel is a live viewer with filters (All / Requests / Errors and warnings / Status) and search. Every request is logged as `[REQ #n]` with its full payload and answered with `[RES #n]` with status, timing and response. Payloads can contain customer names and ID numbers — treat `helper.log` as sensitive.

## WebSocket API

All messages are JSON. Send to `ws://localhost:9999`, receive a JSON response.

### Printer

```json
{ "device": "printer", "device_type": "receipt", "transaction": { ... }, "settings": { "url": "192.168.192.168" } }
{ "device": "printer", "device_type": "report",  "type": "X_REPORT"|"Z_REPORT", ... }
{ "device": "printer", "device_type": "test",    "message": "TEST PRINT", "settings": { "url": "..." } }
```

### Display

```json
{ "device": "display", "device_type": "message" }
{ "device": "display", "device_type": "item",    "name": "...", "price": 0.00 }
{ "device": "display", "device_type": "total",   "total": 0.00 }
{ "device": "display", "device_type": "next" }
```

### Terminal info

```json
{ "device": "terminal", "device_type": "info" }
// returns: { "MIN": "123-456789-0", "SN": "S/N0000012345", "PTU_NO": "PTU-000000000001" }
```

### Responses

| Outcome | Response |
|---|---|
| Success | `{ "message": "Printed successfully" }` |
| Printer offline, journaled | `{ "message": "Journaled successfully (printer unavailable)", "error": "..." }` |
| Test print, printer offline | `{ "message": "Printer unavailable", "error": "..." }` |
| Error | `{ "error": "..." }` |

A failed request does not close the connection.

## Development

See [SETUP.md](SETUP.md) for the full guide.

```bash
cd pos-helper-app
python -m venv .venv
.venv\Scripts\activate
pip install -r helper/requirements.txt

cd helper
python app.py              # tray app + WebSocket server on ws://localhost:9999
python app.py --no-tray    # headless, logs to the console
```

Tests (from `pos-helper-app/`): `python helper/test_fix.py`, `python test_async.py`, `python test_journaling.py`, `python test_refactor.py`.

## Building and installing on workstations

Needs [Inno Setup 6](https://jrsoftware.org/isdl.php) on the build machine only.

```powershell
cd pos-helper-app
.\build-installer.ps1        # PyInstaller -> mmg-helper.exe, then Inno Setup
# Output: installer\Output\MMG-Helper-Setup.exe
```

Copy `MMG-Helper-Setup.exe` to each cashier PC and run it (administrator, one prompt). It installs for all users to `C:\MMG-POS`, asks for the workstation settings, starts the helper at every login, and appears in Add/Remove Programs.

Silent / scripted install:

```
MMG-Helper-Setup.exe /VERYSILENT /MIN="123-456789-0" /SN="S/N0000012345" /PTU="PTU-000000000001" /PRINTER=192.168.1.50 /COM=COM3
```

Put a `branch-defaults.ini` next to the installer to prefill shared fields:

```ini
[defaults]
printer_ip=192.168.1.50
display_port=COM3
```

Precedence per field: command-line switch > `branch-defaults.ini` > BIR values from an old `terminal.json` > built-in default. Log an install with `/LOG=C:\setup.log`.

- **Upgrade:** run the new installer. It stops the running helper, replaces the exe, and keeps `config.json` and `ejournal.txt`.
- **Old installs:** it stops the old Python-based helper, removes its `C:\MMG-POS\helper` folder, and deletes the per-user startup shortcuts made by the old `install.bat`.
- **Uninstall:** Add/Remove Programs. It asks whether to delete `ejournal.txt` and `config.json`; the default is to keep them.

## Hardware

- **Receipt printer:** Epson TM-series ESC/POS over TCP/IP. The tray status probes port 9100.
- **VFD customer display:** RS-232 serial, `display_port` in `config.json` (default `COM3`; `/dev/ttyACM1` on Linux). `\x0C` (form feed) clears the 2×20 display.
- Printer failure is non-fatal: the receipt is still journaled and the response says the printer was unavailable.
