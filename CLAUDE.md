# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## System Overview

This is the **MMG Albay POS System** monorepo — a point-of-sale system for Medical Mission Group Multipurpose Cooperative-Albay (a healthcare clinic cooperative in the Philippines).

| Directory | Role | Tech |
|---|---|---|
| `mmg-app/` | Frontend SPA | React 18, Vite, MUI v5 |
| `pos-api/` | REST API + hardware proxy + data sync | Flask 3.0, MongoDB, Python |
| `pos-helper-app/` | Hardware bridge (WebSocket server) | Python, websockets, ESC/POS |

---

## Architecture

### Request / Data Flow

```
Browser (mmg-app)
    │
    ├──[HTTP/Axios]──► pos-api (Flask, :5100)
    │                      └── MongoDB (local or remote)
    │
    └──[WebSocket ws://localhost:9999]──► pos-helper-app/helper/app.py
                                              ├── ESC/POS Printer (TCP/IP, default 192.168.192.168)
                                              └── VFD Customer Display (serial COM3)
```

### pos-helper-app/helper — `helper/app.py`

A standalone Python `asyncio` WebSocket server that bridges the browser to physical hardware. Runs on every cashier workstation — not in Docker.

- Listens on `ws://localhost:9999`
- Routes JSON messages by `{ "device": "printer"|"display"|"terminal", "device_type": "..." }`
  - Printer types: `receipt`, `report`, `test`
  - Display types: `message`, `item`, `total`, `next`
  - Terminal types: `info` — returns `{ MIN, SN, PTU_NO }` for the current workstation. `mmg-app` queries this fresh at checkout and sends `PTU_NO` with the transaction — pos-api uses it to scope the invoice-number sequence per terminal (see Invoice Number under Key Domain Concepts)
- All blocking hardware calls use `asyncio.to_thread` to keep the event loop responsive
- `ReceiptWriter` is a context manager that opens `ejournal.txt` once per transaction and writes to both the file and ESC/POS printer simultaneously — journals to file even when the physical printer is offline
- `ejournal.txt`, `config.json` and `helper.log` live in `C:\MMG-POS` (override with the `MMG_POS_DATA_DIR` env var), so every launch method resolves to the same files
- **Per-workstation config** (`config.json`, loaded by `helper/config.py`): BIR credentials (`MIN`, `SN`, `PTU_NO`), `printer_ip`, `display_port`, `display_baudrate`, `ws_port`. Created with defaults on first run; a legacy `terminal.json` is migrated. Not stored in the database — each workstation has its own file. BIR values are printed on every receipt and report header.
- **Tray app**: `helper/tray.py` owns the main thread (status icon, Test Print, one full-screen Settings + live log window); the WebSocket server runs on a background thread (`HelperServer`). `python app.py --no-tray` runs headless.
- **Logging**: `helper.log` records every request (`[REQ #n]` with payload) and response (`[RES #n]` with status/timing), printer online/offline changes, and errors. Payloads contain customer data.

### mmg-app — `src/`

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
2. `src/api/print.js` (`Print()`, `PrintReport()`) → HTTP to the proxy `/print` and `/print-report` (legacy, kept for compatibility)

### pos-api — root files + subdirectories

Flask 3.0 REST API backed by MongoDB (PyMongo).

- Entry point: `app.py` — registers ~60+ Blueprints
- `app/routes/<domain>/<action>.py` — each CRUD action is its own file (e.g., `app/routes/transaction/create.py`)
- `app/blueprints/` — grouped blueprints for larger sub-systems
- `app/cas_app/` — Cooperative Accounting System sub-application (inventory, purchase orders, chart of accounts, journal entries) sharing the same Flask process
- `app/database/config.py` — imports all MongoDB collections as module-level globals; imported directly by route files
- `app/middlewares/token_validator.py` — JWT validation as `@app.before_request`; excluded paths include `/login`, `/booking/create`, `/branches`
- `app/config.py` — reads `APP_ENV`; valid values: `local-development`, `development`, `internal-production`, `production`
- `proxy/app.py` — Flask reverse proxy (port 5001) that forwards requests to the local server; also has legacy HTTP print/display endpoints
- `sync/app.py` — scheduled background process syncing MongoDB between local and remote (every 20s upstream, every 3 min downstream). **Will crash-loop on a fresh install if `REMOTE_DATABASE_URL` is a placeholder** — this is harmless and only affects cloud sync; the core POS stack works without it.
- `seed.py` — idempotent seeder: inserts default branch, admin role, and admin user; safe to re-run
- `docker-compose.yml` — five services: `app` (React, :8000), `server` (Flask, :8001), `proxy` (:8002), `sync`, `mongo` (:8003)

---

## Performance (pos-api server)

### Fix 1 — Gunicorn (replaces Flask dev server)
`pos-api/Dockerfile` runs Gunicorn with 4 workers instead of `python app.py`. This allows the server to handle concurrent requests from multiple cashier terminals in parallel. Set workers to `(2 × CPU cores) + 1` for the branch server machine.

### Fix 2 — MongoDB indexes (`app/database/indexes.py`)
`ensure_indexes()` is called at startup from `app/database/config.py`. It creates compound indexes on the collections that heavy report queries hit:
- `sales`: `(branch, date)` and `(cashierId, date)` — used by cashier sales reports and branch report generation
- `cashier_reports`: `(branchId, date)` — used by `generate_branch_report` aggregation
- `transactions`: `(status, cashierId, date)` and `(branchId, date)` — used by active transaction lookup and general queries
- `branch_reports`: `(branchId, date)` — used to check for existing daily report
- `audit_logs`: `userId` and `datetime` — used by audit log queries

`create_index` is idempotent — safe to call on every startup.

### Fix 3 — Pre-aggregation on write (Option C, already partially implemented)
The `sales` collection is the pre-aggregated write layer — one document is inserted per completed transaction in `app/routes/transaction/update.py`. Report queries (`generate_branch_report`, cashier sales reports) read from `sales` instead of re-aggregating raw `transactions`. This pattern must be maintained: **any new report that can be computed from `sales` should never touch the `transactions` collection directly.**

---

## Backend Code Architecture (pos-api)

### Rule: All new features use the feature-folder / CSR pattern

New features go under `app/features/<feature_name>/` with four files:

```
app/features/
  transaction/
    routes.py       ← Blueprint + HTTP handlers only (thin)
    service.py      ← all business logic; zero Flask imports
    repository.py   ← all MongoDB calls; zero Flask imports
    models.py       ← Pydantic models for request/response validation
```

**Layer rules — what belongs where:**

| Layer | Responsibility | Must NOT contain |
|---|---|---|
| `routes.py` | Parse request, call service, return response | Business logic, DB calls |
| `service.py` | Business rules, orchestration, calculations | Flask imports, direct DB calls |
| `repository.py` | MongoDB queries, aggregations, data mapping | Business logic, Flask imports |
| `models.py` | Pydantic `BaseModel` shapes for I/O validation | Side effects |

**Concrete example:**

```python
# routes.py — only HTTP concerns
@bp.post('/transaction/complete')
def complete_transaction():
    data = CompleteTransactionRequest(**request.get_json())
    result = service.complete(data, user_id=g.user_id)
    return jsonify(result), 200

# service.py — business logic, no Flask
def complete(data: CompleteTransactionRequest, user_id: str) -> dict:
    invoice_number = repo.get_next_invoice_number()
    transaction = repo.find_one(data.transaction_id)
    # ... discount calculation, sale record creation, etc.
    repo.update(transaction)
    audit_repo.log(AuditCode.TRANSACTION_CREATE, user_id)
    return transaction.to_dict()

# repository.py — DB only, no business logic
def get_next_invoice_number(self) -> int:
    result = db.counters.find_one_and_update(
        {'_id': 'invoiceNumber'},
        {'$inc': {'seq': 1}},
        upsert=True, return_document=True
    )
    return result['seq']
```

**Models:** Use Pydantic `BaseModel` (see `app/new_models/AuditLog.py` as reference). Do not use the old plain-class models in `app/models/`.

**Repository base class:** Extend `app/repositories/base.py` (`BackupRepository`) for collections that need `_sync` support.

**Existing code:** The old pattern (`app/routes/<domain>/<action>.py`) is legacy. Do not extend it for new features — only bugfix in place when needed. Repositories in `app/repositories/` can be reused directly if they already cover your domain.

---

## Deployment Strategy

### Multi-Branch: One LAN Server Per Branch + One Shared Staging

```
┌─────────────────────────┐     ┌─────────────────────────┐
│  BRANCH A (LAN)         │     │  BRANCH B (LAN)         │
│  Server + Local MongoDB │     │  Server + Local MongoDB │
│  Cashiers on LAN        │     │  Cashiers on LAN        │
└──────────┬──────────────┘     └──────────┬──────────────┘
           │ upstream sync                  │ upstream sync
           │ (_sync: pending → synced)      │
           ▼                                ▼
┌──────────────────────────────────────────────────────────┐
│  STAGING / CLOUD                                         │
│  Cloud MongoDB  ◄── aggregate of all branches            │
│  Staging Flask API (read-only enforcement)               │
│  Staging mmg-app (same codebase, VITE_APP_ENV=staging)   │
│  — reports and backup only, no POS/cashier routes        │
└──────────────────────────────────────────────────────────┘
           │ downstream sync
           │ (lookup tables only — branches, users, products, etc.)
           ▼
    Each branch server
```

**Internal (LAN)** — each branch runs its own server (Flask API + MongoDB + sync service + proxy + helper app). Works fully offline. All sales/write operations happen here only.

**Staging/Cloud** — one shared cloud instance that aggregates data from all branch servers. Read-only for reporting and cloud backup. Never generates transactions.

**CAS (Computerized Accounting System)** is a separate project and is not in scope for this sync.

**Deployments:** Currently manual (SSH + `docker-compose up --build`). CI/CD via GitHub Actions is planned.

### Sync Strategy — Embedded `_sync` Field (Outbox Pattern)

Every write operation (create AND update) on upstream collections embeds a `_sync` field directly on the document:

```json
{
  "_id": "...",
  "invoiceNumber": 1234,
  "_sync": { "status": "pending", "synced_at": null, "attempts": 0 }
}
```

The sync service polls `{ "_sync.status": "pending" }`, pushes to cloud MongoDB (stripping `_sync` before upsert), then marks `synced` locally.

**Upstream collections** (branch → staging): `transactions`, `cashier_reports`, `branch_reports`, `sales`, `sales_deposits`, `audit_logs`, `bookings`

**Downstream collections** (staging → branch, lookup/config only): `branches`, `users`, `customers`, `discounts`, `packages`, `products`, `product_categories`, `doctors`, `roles`, `corporates`

**Multi-branch safety:** Each document has a globally unique MongoDB `ObjectId`. Multiple branch servers upserting by `_id` on staging is safe and idempotent — no ID collisions, no conflict resolution needed.

**Why embedded `_sync` over a separate `sync_queue` collection:**
Standalone MongoDB has no multi-collection transactions. A separate queue requires two writes (document + queue entry) — a crash between them silently drops the record from sync. Embedding `_sync` is a single atomic write.

**Known limitations:**
- **Stale staging window** — staging lags by up to the sync interval (~20s). Acceptable for end-of-day reports, not for real-time views.
- **Deletes are not propagated** — hard deletes on internal are invisible to staging. Always use status changes (`cancelled`, `refunded`) instead of deletes on upstream collections.
- **Downstream sync must preserve `_sync`** — when the sync service pulls lookup tables from staging → local, it must never overwrite the `_sync` field on existing local documents to avoid resetting pending sync state.

### Staging mmg-app
Same codebase as internal, deployed as a second instance with `VITE_APP_ENV=staging`. This flag disables POS/cashier routes and all write operations — only dashboard and report routes are accessible. Points to the cloud MongoDB via its own `pos-api` instance.

### Cashier Workstation Deployment (pos-helper-app)

pos-helper-app is distributed as a single Windows installer, `MMG-Helper-Setup.exe`, built by `pos-helper-app/build-installer.ps1` (PyInstaller exe wrapped by Inno Setup; Inno Setup is needed on the build machine only). Each cashier PC needs it for receipt printing and VFD display.

**What the installer does** (administrator, all users):
1. Installs `mmg-helper.exe` to `C:\MMG-POS\` (writable by standard users)
2. Wizard asks for BIR credentials (MIN, SN, PTU No), printer IP and display COM port, and writes `C:\MMG-POS\config.json`. Silent installs take `/MIN= /SN= /PTU= /PRINTER= /COM=`; a `branch-defaults.ini` next to the installer prefills shared fields
3. Creates a common Startup shortcut — helper starts for every user at login
4. Removes the old install: stops a running old helper (including the Python variant), deletes its `C:\MMG-POS\helper` folder and the old per-user startup shortcuts, and prefills the wizard from an old `terminal.json`
5. Upgrades keep `config.json` and `ejournal.txt`; uninstall (Add/Remove Programs) asks before deleting them

**BIR terminal credentials** are per-workstation, stored only in `C:\MMG-POS\config.json`. They are never stored in MongoDB. Update them from the tray icon's Settings form (or edit the file and choose Restart) after BIR approval.

```json
{ "MIN": "123-456789-0", "SN": "S/N0000012345", "PTU_NO": "PTU-000000000001",
  "printer_ip": "192.168.192.168", "display_port": "COM3", "display_baudrate": 9600, "ws_port": 9999 }
```

**Receipt fields and their source:**

| Field | Source |
|---|---|
| MIN, SN, PTU No (header) | `config.json` on workstation |
| Accred No, Supplier PTU (footer) | `dvoteDetails` from DB |

---

## Commands

### Docker (full stack — run from monorepo root)
```bash
# First-time setup: copy the example env and fill in secrets
cp .env.example pos-api/.env

# Internal LAN deployment (local MongoDB, all services)
docker-compose up --build

# Seed the database (run once after first-time startup)
docker-compose exec server python seed.py

# Production / cloud deployment (remote MongoDB)
docker-compose -f docker-compose.prod.yml up --build

# Rebuild a single service
docker-compose up --build server

# View logs
docker-compose logs -f server
docker-compose logs -f proxy
```

Port map when using `docker-compose.yml`:
| Service | Host port | Purpose |
|---|---|---|
| app (frontend) | 8000 | Browser entry point |
| proxy | 8002 | API entry point for browser |
| server (Flask) | 8001 | Direct API (debug) |
| mongo | 8003 | MongoDB (debug) |

### mmg-app (local dev)
```bash
cd mmg-app
npm install
npm start            # dev server (env-cmd + vite) on :5173
npm run build
npm run lint
npm run lint:fix
npm run prettier
```

### pos-api (local dev)
```bash
cd pos-api
python -m venv .venv
source .venv/Scripts/activate   # Windows; use .venv/bin/activate on Linux
pip install -r requirements.txt
python app.py                   # Flask dev server on :5100

# Seed default branch + admin role + admin user (fresh DB only)
python seed.py
# Override default password: SEED_PASSWORD=mypassword python seed.py
```

### pos-helper-app (always runs locally — not in Docker)
```bash
cd pos-helper-app/helper
python -m venv ../.venv
source ../.venv/Scripts/activate
pip install -r requirements.txt
python app.py                   # WebSocket server on ws://localhost:9999

# Tests (from pos-helper-app/)
python test_fix.py
python test_async.py
python test_journaling.py
python test_refactor.py
```

### pos-helper-app (build Windows executable for cashier workstations)
```bash
cd pos-helper-app
.\build-installer.ps1           # PyInstaller exe + Inno Setup -> installer\Output\MMG-Helper-Setup.exe

# Then distribute MMG-Helper-Setup.exe (and optional branch-defaults.ini) to USB / network share
# Run it once on each cashier workstation
```

---

## Environment Variables

### pos-api `.env`
```
APP_ENV=local-development        # local-development | development | internal-production | production
JWT_SECRET_KEY=...
LOCAL_DATABASE_URL=mongodb://localhost:27017
REMOTE_DATABASE_URL=mongodb+srv://...
DATABASE=pos
PORT=5100
HOST=0.0.0.0
LOCAL_SERVER_URL=http://server:5100    # used by proxy container (injected by docker-compose, not needed in .env)
CLOUD_SERVER_URL=...                   # used by proxy (currently unused)
```

### mmg-app `.env`
```
VITE_APP_ENV=development               # development | production | internal-production
VITE_APP_SERVER_PORT=5100              # used in dev; builds baseURL from window.location.hostname
VITE_APP_SERVER_URL=http://...         # used in production mode only
VITE_APP_BASE_NAME=/
```

---

## Key Domain Concepts

- **Transaction** — a sale with items, discounts, tender, and status (`completed`, `cancelled`, `refunded`, `on-hold`)
- **Invoice Number** — sequential counter stored in `counters` collection, zero-padded to 6 digits on receipts. **Unique per accredited terminal (PTU), not per branch or per cashier** — this is a BIR compliance requirement: each accredited machine must issue its own continuous, gap-free series. The counter document is keyed by `{ type: "INVOICE_NUMBER", ptuNumber }`; `ptuNumber` comes from the completing terminal's `terminal.json`/`config.json` (`PTU_NO`), fetched fresh from the helper app (`{ device: "terminal", device_type: "info" }`) at the moment a sale is completed (`Checkout.jsx`) — never cached across a session, since the file can change if the terminal is re-accredited mid-shift. **If the helper app can't be reached, checkout is blocked** rather than falling back to a shared/default series — the backend rejects a `completed` transaction with no `ptuNumber` (`app/new_models/Transaction.py: CreateTransaction.requirePtuNumberWhenCompleted`). Cancel/refund serial numbers (`CANCEL_NUMBER` / `REFUND_NUMBER`) follow the identical rule, scoped by the PTU of the terminal performing the cancel/refund (not the terminal that issued the original invoice) — see `app/blueprints/transaction.py: v3_create_transaction` / `v3_cancel_transaction`.
- **X-Report** — per-cashier shift summary (time-in to time-out)
- **Z-Report** — end-of-day summary across all cashiers; includes accumulated sales, discount breakdown, cash drawer count
- **Electronic Journal** (`ejournal.txt`) — append-only flat-file log of every non-reprint receipt; written by the helper app even when printer is offline
- **Member Discounts** — tied to `memberType` (`senior_citizen`, `pwd`, `naac`, `solo_parent`); triggers the ID/Signature block on receipts
- **Branch** — selected per user session in `localStorage`; scopes data throughout the frontend
- **Role names** — must match the constants in `mmg-app/src/utils/Role.js` (case-insensitive): `admin`, `cashier`, `manager`. A user with any other role name will be bounced to /404 by `AuthorizeRoute`.
- **CAS** — Cooperative Accounting System within `pos-api`; separate concern from POS (inventory, suppliers, purchase orders, accounting)

---

## Hardware

- **Receipt Printer**: Epson TM-series ESC/POS over TCP/IP. IP is configurable via the `settings.url` field in the WebSocket message (default: `192.168.192.168`).
- **VFD Customer Display**: RS-232 serial, `COM3` on Windows / `/dev/ttyACM1` on Linux. Uses `\x0C` (form feed) to clear the 2×20 character display.
- Printer failure is non-fatal — `ReceiptWriter` catches errors and completes the journal write; response returns `"message": "Journaled successfully (printer unavailable)"`.
