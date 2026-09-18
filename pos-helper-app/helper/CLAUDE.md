# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## System Overview

This workspace contains three tightly related projects that together form the **MMG Albay POS System** — a point-of-sale system built for Medical Mission Group Multipurpose Cooperative-Albay (a healthcare clinic cooperative in the Philippines).

| Project | Path | Role |
|---|---|---|
| `pos-helper-app/helper` | (this repo) | Python WebSocket hardware bridge |
| `mmg-app` | `../../mmg-app` (also open in workspace) | React + Vite frontend |
| `pos-api` | `C:/Users/UNC/source/repos/pos-api` | Flask Python REST API + sync + proxy |

---

## Architecture

### Request / Data Flow

```
Browser (mmg-app)
    │
    ├──[HTTP/Axios]──► pos-api (Flask, :5100)
    │                      └── MongoDB (local or remote)
    │
    └──[WebSocket ws://localhost:9999]──► pos-helper-app (this repo)
                                              ├── ESC/POS Printer (TCP/IP, default 192.168.192.168)
                                              └── VFD Customer Display (serial COM3)
```

### pos-helper-app (this repo) — `helper/app.py`

A standalone Python `asyncio` WebSocket server that bridges the browser to physical hardware.

- Listens on `ws://localhost:9999`
- Receives JSON messages routed by `{ "device": "printer"|"display", "device_type": "..." }`
- Printer device types: `receipt`, `report`, `test`
- Display device types: `message`, `item`, `total`, `next`
- All blocking hardware calls are offloaded with `asyncio.to_thread` to keep the event loop responsive
- `ReceiptWriter` is a context manager that opens `ejournal.txt` once per transaction and writes to both the file and the ESC/POS printer simultaneously — journals to file even when the physical printer is offline
- `ejournal.txt` (in `C:\MMG-POS`, or `MMG_POS_DATA_DIR`) is the electronic transaction log; never opened more than once per print job
- **Tray app** — `app.py` runs `HelperServer` (the WebSocket server) on a background thread; `tray.py` owns the main thread (pystray icon with green/yellow/red status, Test Print, one full-screen Settings + live log window). `python app.py --no-tray` runs headless.
- **Config** — `config.py` reads `C:\MMG-POS\config.json` (MIN, SN, PTU_NO, printer_ip, display_port, display_baudrate, ws_port). Created on first run; a legacy `terminal.json` is migrated. Never stored in the database.
- **Logging** — `logsetup.py` writes everything to `helper.log` (5 MB rotation). Every request is logged as `[REQ #n]` with its payload and `[RES #n]` with status and timing. Payloads contain customer data.
- **Install** — `build-installer.ps1` builds `installer\Output\MMG-Helper-Setup.exe` (Inno Setup: all-users, wizard + silent switches). The old `install.bat` scripts are gone.

### mmg-app — `../../mmg-app/src/`

React 18 + Vite SPA. Key structural layers:

- **`src/api/`** — one Axios module per domain (`transaction.js`, `auth.js`, `print.js`, etc.) using a shared `server` axios instance from `api/index.js` that injects the JWT from `TokenStorage`
- **`src/providers/`** — three React Context providers:
  - `AuthProvider` — JWT auth, user object, selected branch (persisted in `localStorage`)
  - `PrinterProvider` — manages the WebSocket connection to `ws://localhost:9999`; exposes `usePrinter()` hook
  - `CashierReportProvider` — cashier shift state
- **`src/routes/`** — React Router v6; four route groups: `MainRoutes` (dashboard/admin), `PosRoutes` (cashier POS screen), `AuthRoutes` (login), `DefaultRoutes` (root redirect). All protected routes use `<AuthorizeRoute roles={[...]}>`.
- **`src/views/pages/PosPage/`** — the active transaction/cashier screen; most hardware interaction happens here via `usePrinter()`
- **`src/store/`** — Redux is used **only** for UI customization (theme). Server state is managed by React Query.
- All pages are lazy-loaded via `Loadable(lazy(...))`.

**Two print paths exist** — know which one you are touching:
1. `usePrinter()` from `PrinterProvider` → WebSocket to helper app (current approach for POS screen)
2. `src/api/print.js` (`Print()`, `PrintReport()`) → HTTP to the proxy `/print` and `/print-report` endpoints (legacy, kept for compatibility)

### pos-api — `C:/Users/UNC/source/repos/pos-api/`

Flask 3.0 REST API backed by MongoDB (PyMongo).

- Entry point: `app.py` — registers ~60+ Blueprints and route functions
- `app/routes/<domain>/<action>.py` — each CRUD action is its own file (e.g., `app/routes/transaction/create.py`)
- `app/blueprints/` — grouped blueprints for larger sub-systems (cashier reports, branch reports, transactions)
- `app/cas_app/` — Cooperative Accounting System (CAS) sub-application sharing the same Flask process: inventory, purchase orders, chart of accounts, journal entries
- `app/database/config.py` — imports all MongoDB collections as module-level globals; imported directly by route files
- `app/middlewares/token_validator.py` — JWT validation runs as `@app.before_request`; excluded paths include `/login`, `/booking/create`, `/branches`, `/v2/reports`
- `app/config.py` — reads `APP_ENV` env var; valid values: `local-development`, `development`, `internal-production`, `production`
- `proxy/app.py` — Flask reverse proxy (port 5001) that forwards all requests to the local server; also handles legacy HTTP print and display endpoints
- `sync/app.py` — scheduled background process that syncs MongoDB collections between local and remote every 20 seconds (upstream) and 3 minutes (downstream); lookup tables (users, branches, products, etc.) flow downstream only

### Deployment (Docker)

`pos-api/docker-compose.yml` runs five services: `app` (React), `server` (Flask API), `proxy` (Flask proxy), `sync` (data sync), `mongo` (MongoDB). Internal network is `pos-network`. Port map: app→8000, server→8001, proxy→8002, mongo→8003.

---

## Environment Variables

### pos-api `.env`
```
APP_ENV=local-development   # local-development | development | internal-production | production
JWT_SECRET_KEY=...
LOCAL_DATABASE_URL=mongodb://localhost:27017
REMOTE_DATABASE_URL=mongodb+srv://...
DATABASE=pos
PORT=5100
HOST=0.0.0.0
LOCAL_SERVER_URL=http://server:5000   # used by proxy
CLOUD_SERVER_URL=...                  # used by proxy (currently unused)
```

### mmg-app `.env`
```
VITE_APP_ENV=development              # development | production | internal-production
VITE_APP_SERVER_PORT=5100             # used in dev; builds baseURL from window.location.hostname
VITE_APP_SERVER_URL=http://...        # used in production mode only
VITE_APP_BASE_NAME=/
```

---

## Commands

### pos-helper-app (this repo)
```bash
# Setup (run from helper/)
python -m venv ../.venv
source ../.venv/Scripts/activate      # Windows Git Bash
pip install -r requirements.txt

# Run WebSocket server
python app.py                         # listens on ws://localhost:9999

# Tests
python test_fix.py
python test_async.py
python test_journaling.py
python test_refactor.py
```

### mmg-app
```bash
cd ../../mmg-app
npm install
npm start            # dev server via env-cmd + vite
npm run build
npm run lint
npm run lint:fix
npm run prettier
```

### pos-api
```bash
cd C:/Users/UNC/source/repos/pos-api
source .venv/Scripts/activate         # Windows
pip install -r requirements.txt
python app.py                         # Flask dev server on :5100

# Docker (internal-production)
docker-compose up --build
```

---

## Key Domain Concepts

- **Transaction** — a sale with items, discounts, tender, and status (`completed`, `cancelled`, `refunded`, `on-hold`)
- **Invoice Number** — sequential counter stored in `counters` collection; zero-padded to 6 digits on receipts
- **X-Report** — per-cashier shift summary (time-in to time-out); triggers when cashier clocks out
- **Z-Report** — end-of-day summary across all cashiers; includes accumulated sales, discount breakdown, cash drawer count
- **Electronic Journal** (`ejournal.txt`) — append-only flat-file log of every printed receipt; written by the helper app even when the physical printer is offline
- **Member Discounts** — discounts tied to `memberType` (e.g., `senior_citizen`, `pwd`, `naac`, `solo_parent`); trigger the ID/Signature block at the bottom of the receipt
- **Branch** — the operating location; selected per user session and stored in `localStorage`; drives data scoping throughout the frontend
- **CAS** — Cooperative Accounting System within `pos-api`; separate concern from POS transactions (inventory, suppliers, purchase orders, accounting entries)

---

## Hardware

- **Receipt Printer**: Epson TM-series ESC/POS, connected via TCP/IP. IP comes from `settings.url` in the WebSocket message if sent (the printer test does), otherwise `printer_ip` in `config.json` (default `192.168.192.168`).
- **VFD Customer Display**: Serial RS-232, `display_port` in `config.json` (default `COM3`; `/dev/ttyACM1` on Linux). Uses `\x0C` (form feed) to clear the 2×20 character display.
- Printer failure is non-fatal — python-escpos connects lazily, so `ReceiptWriter` records the first printer error, stops using the printer, and still completes the journal write; the response includes `"message": "Journaled successfully (printer unavailable)"`.


https://support.clickpos.com/hc/en-us/articles/205723945-Web-POS-Epson-TM-Series-Intelligent-Printer-Setup-Slave-Ethernet