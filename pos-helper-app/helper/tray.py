"""System tray front-end for the helper.

Owns the main thread (pystray). The WebSocket server runs on a background
thread (app.HelperServer). Menu: status, Test Print, Settings and Logs, Open Journal
Folder, Restart, Quit. Settings and Logs opens one full-screen window
(settings on the left, live log on the right).

Icon colour:
  green  - server running, printer reachable, BIR credentials set
  yellow - running, but the printer is unreachable (receipts journal only)
           or BIR credentials are still placeholders
  red    - server not running (bad port, crash, or config file unreadable)
"""
import os
import queue
import socket
import subprocess
import threading

import pystray
from PIL import Image, ImageDraw

import config as helper_config

GREEN, YELLOW, RED = (46, 160, 67), (227, 168, 20), (207, 34, 46)
POLL_SECONDS = 10
PRINTER_TCP_PORT = 9100  # ESC/POS raw printing (python-escpos Network default)


def probe_printer(host: str, port: int = PRINTER_TCP_PORT, timeout: float = 1.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def make_icon(color) -> Image.Image:
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((4, 4, 60, 60), fill=color + (255,), outline=(255, 255, 255, 255), width=3)
    d.rectangle((20, 24, 44, 40), fill=(255, 255, 255, 255))   # printer body
    d.rectangle((25, 16, 39, 24), fill=(255, 255, 255, 255))   # paper in
    d.rectangle((25, 38, 39, 48), fill=(255, 255, 255, 255))   # paper out
    return img


def compute_status(app, server):
    """Return (colour, one-line text). Cheap enough to call from a poll thread."""
    cfg = app.CONFIG
    if server.state == "retrying":
        # No countdown in the text: it would change every poll and flood the log with [STATUS] lines.
        return RED, f"Server failed, retrying (attempt {server.attempt}): {server.error}"
    if server.state != "running":
        return RED, "Server not running"
    unset = helper_config.unset_credentials(cfg)
    if not probe_printer(cfg["printer_ip"]):
        return YELLOW, f"Printer {cfg['printer_ip']} unreachable (journal only)"
    if unset:
        return YELLOW, f"Running - BIR not set: {', '.join(unset)}"
    return GREEN, f"Running on port {server.port} - printer OK"


class Ui:
    """One Tk thread for every window. Tk misbehaves with several roots on different threads,
    so windows are Toplevels of a hidden root and other threads hand work over via a queue."""

    def __init__(self):
        self._q = queue.Queue()
        self._thread = None
        self._lock = threading.Lock()
        self.root = None
        self.windows = {}

    def _loop(self):
        import tkinter as tk
        self.root = tk.Tk()
        self.root.withdraw()
        self.root.after(100, self._pump)
        self.root.mainloop()

    def _pump(self):
        try:
            while True:
                self._q.get_nowait()()
        except queue.Empty:
            pass
        except Exception as e:  # a broken window must not kill the UI thread
            print(f"[tray] UI error: {e}")
        self.root.after(100, self._pump)

    def call(self, fn):
        with self._lock:
            if self._thread is None:
                self._thread = threading.Thread(target=self._loop, name="tk-ui", daemon=True)
                self._thread.start()
        self._q.put(fn)

    def open_once(self, name, factory):
        """Show window `name`, raising the existing one instead of opening a duplicate."""
        def show():
            win = self.windows.get(name)
            if win is not None and win.winfo_exists():
                win.deiconify()
                win.lift()
                win.focus_force()
                return
            self.windows[name] = factory(self.root)
        self.call(show)


def _hex(color) -> str:
    return "#%02x%02x%02x" % tuple(color)


def _settings_panel(parent, app, on_saved, get_status):
    """Left column: live status + the config form. Saving restarts the server in place."""
    import tkinter as tk
    from tkinter import messagebox, ttk

    frame = ttk.Frame(parent, padding=16)
    frame.columnconfigure(0, weight=1)

    ttk.Label(frame, text="Settings", font=("Segoe UI", 15, "bold")).grid(row=0, column=0, sticky="w")

    status = ttk.Frame(frame)
    status.grid(row=1, column=0, sticky="ew", pady=(8, 14))
    dot = tk.Label(status, width=2, bg=_hex(RED))
    dot.pack(side="left", padx=(0, 8))
    status_var = tk.StringVar()
    ttk.Label(status, textvariable=status_var, wraplength=300, justify="left").pack(side="left", fill="x")

    fields = [
        ("MIN", "Machine Identification Number (MIN)"),
        ("SN", "Serial Number (SN)"),
        ("PTU_NO", "Permit to Use No (PTU No)"),
        ("printer_ip", "Receipt printer IP address"),
        ("display_port", "Customer display COM port"),
        ("ws_port", "Helper port (change only if told to)"),
    ]
    vars_ = {}
    row = 2
    for key, label in fields:
        ttk.Label(frame, text=label).grid(row=row, column=0, sticky="w", pady=(6, 0))
        var = tk.StringVar(value=str(app.CONFIG[key]))
        entry = ttk.Entry(frame, textvariable=var, width=38)
        entry.grid(row=row + 1, column=0, sticky="ew")
        entry.bind("<Return>", lambda _e: save())
        vars_[key] = var
        row += 2

    msg_var = tk.StringVar()

    def revert():
        for key, var in vars_.items():
            var.set(str(app.CONFIG[key]))
        msg_var.set("")

    def save():
        new = dict(app.CONFIG)
        for key, var in vars_.items():
            new[key] = var.get().strip()
        for key in ("MIN", "SN", "PTU_NO"):
            new[key] = new[key] or "---"
        new["display_port"] = new["display_port"].upper()
        if not new["ws_port"].isdigit():
            messagebox.showerror("Invalid setting", "Helper port must be a number.", parent=frame)
            return
        new["ws_port"] = int(new["ws_port"])
        problems = helper_config.errors(new)
        if problems:
            messagebox.showerror("Invalid setting", "\n".join(problems), parent=frame)
            return
        try:
            helper_config.save(app._DATA_DIR, new)
        except Exception as e:
            messagebox.showerror("Could not save", f"{app._DATA_DIR}\\config.json:\n{e}", parent=frame)
            return
        msg_var.set("Saved. Restarting the helper...")
        frame.after(4000, lambda: msg_var.set(""))
        # Restarting the server blocks for a moment; keep it off the UI thread.
        threading.Thread(target=on_saved, daemon=True).start()

    buttons = ttk.Frame(frame)
    buttons.grid(row=row, column=0, sticky="ew", pady=(16, 0))
    ttk.Button(buttons, text="Save and Restart", command=save).pack(side="left")
    ttk.Button(buttons, text="Revert", command=revert).pack(side="left", padx=(8, 0))

    # --- Printer: test print with free text ---
    ttk.Separator(frame, orient="horizontal").grid(row=row + 1, column=0, sticky="ew", pady=(18, 10))
    ttk.Label(frame, text="Test Print", font=("Segoe UI", 12, "bold")).grid(row=row + 2, column=0, sticky="w")
    test_var = tk.StringVar(value="TEST PRINT")
    test_row = ttk.Frame(frame)
    test_row.grid(row=row + 3, column=0, sticky="ew", pady=(8, 0))
    test_row.columnconfigure(0, weight=1)
    test_entry = ttk.Entry(test_row, textvariable=test_var)
    test_entry.grid(row=0, column=0, sticky="ew")
    ttk.Label(frame, text="Prints this text on the receipt printer, using the printer IP in the field above.",
              wraplength=320, justify="left").grid(row=row + 4, column=0, sticky="w", pady=(4, 0))

    def test_print():
        ip = vars_["printer_ip"].get().strip()
        if not ip or helper_config.errors({**app.CONFIG, "printer_ip": ip}):
            msg_var.set(f"'{ip}' is not a valid printer IP address.")
            return
        text = test_var.get().strip() or "TEST PRINT"
        unsaved = ip != str(app.CONFIG["printer_ip"])
        run_job(test_btn, f"Printing to {ip}...",
                lambda: app.print_test({"message": text, "settings": {"url": ip}}),
                suffix=" (unsaved IP: Save to keep it)" if unsaved else "")

    test_btn = ttk.Button(test_row, text="Test Print", command=test_print)
    test_btn.grid(row=0, column=1, padx=(8, 0))
    test_entry.bind("<Return>", lambda _e: test_print())

    # --- E-Journal ---
    ttk.Separator(frame, orient="horizontal").grid(row=row + 5, column=0, sticky="ew", pady=(18, 10))
    ttk.Label(frame, text="E-Journal", font=("Segoe UI", 12, "bold")).grid(row=row + 6, column=0, sticky="w")
    journal_btns = ttk.Frame(frame)
    journal_btns.grid(row=row + 7, column=0, sticky="ew", pady=(8, 0))

    def run_job(button, busy_text, fn, suffix=""):
        """Run a blocking print call off the Tk thread, then show its outcome in the message line."""
        msg_var.set(busy_text)
        button.state(["disabled"])
        result = {}

        def work():
            try:
                result["r"] = fn()
            except Exception as e:
                result["r"] = {"message": "Print failed", "error": f"{type(e).__name__}: {e}"}

        def check():  # poll from the Tk thread; worker threads must not touch widgets
            if "r" not in result:
                frame.after(300, check)
                return
            r = result["r"]
            text = f"{r.get('message', '')}: {r['error']}" if r.get("error") else r.get("message", "Done.")
            msg_var.set(text + suffix if not r.get("error") else text)
            button.state(["!disabled"])

        threading.Thread(target=work, daemon=True).start()
        frame.after(300, check)

    def journal_info():
        """(exists, size_bytes) of the e-journal."""
        try:
            return True, os.path.getsize(app.EJOURNAL_PATH)
        except OSError:
            return False, 0

    def open_journal():
        exists, _ = journal_info()
        if not exists:
            msg_var.set(f"No e-journal yet: {app.EJOURNAL_PATH} has not been created.")
            return
        try:
            subprocess.Popen(["notepad.exe", app.EJOURNAL_PATH])
        except OSError as e:
            msg_var.set(f"Could not open Notepad: {e}")

    def print_journal():
        exists, size = journal_info()
        if not exists or size == 0:
            msg_var.set("The e-journal is empty. Nothing to print.")
            return
        if not messagebox.askyesno(
            "Print e-journal",
            f"Print the entire e-journal ({size / 1024:.0f} KB) on the receipt printer?\n\n"
            "A long journal uses a lot of paper and takes a while.",
            parent=frame,
        ):
            return
        run_job(print_btn, "Printing e-journal...", lambda: app.print_ejournal({}))

    ttk.Button(journal_btns, text="Open in Notepad", command=open_journal).pack(side="left")
    print_btn = ttk.Button(journal_btns, text="Print E-Journal", command=print_journal)
    print_btn.pack(side="left", padx=(8, 0))

    ttk.Label(frame, textvariable=msg_var, wraplength=320, justify="left").grid(row=row + 8, column=0, sticky="w", pady=(12, 0))

    def refresh_status():
        if not frame.winfo_exists():
            return
        color, text = get_status()
        dot.configure(bg=_hex(color))
        status_var.set(text)
        frame.after(2000, refresh_status)

    refresh_status()
    frame.controller = {"vars": vars_, "save": save, "status": status_var, "msg": msg_var,
                        "open_journal": open_journal, "print_journal": print_journal,
                        "test_print": test_print, "test_text": test_var, "vars_": vars_}
    return frame


def _main_window(root, app, on_saved, log_path, get_status):
    """Full-screen window: settings on the left, live log on the right."""
    import tkinter as tk
    from tkinter import ttk

    win = tk.Toplevel(root)
    win.title("MMG POS Helper")
    try:
        win.state("zoomed")
    except tk.TclError:
        win.geometry("1280x720")
    win.columnconfigure(1, weight=1)
    win.rowconfigure(0, weight=1)

    left = _settings_panel(win, app, on_saved, get_status)
    left.grid(row=0, column=0, sticky="ns")
    ttk.Separator(win, orient="vertical").grid(row=0, column=0, sticky="nse")
    right = ttk.Frame(win)
    right.grid(row=0, column=1, sticky="nsew")
    _log_panel(right, log_path)

    win.controller = {"settings": left.controller, "log": right.controller}
    win.focus_force()
    return win


# ---- log viewer -----------------------------------------------------------------------------

FILTERS = ("All", "Requests", "Errors and warnings", "Status")
MAX_LINES = 5000
INITIAL_TAIL_BYTES = 300_000
LOG_POLL_MS = 1000


def classify(line: str, previous: str) -> str:
    """Category of a log line. Continuation lines (tracebacks etc.) inherit the previous one."""
    if "[ERR" in line or "FAILED" in line or "[WARN" in line or "[CONFIG WARN" in line:
        return "error"
    if "[REQ" in line or "[RES" in line:
        return "request"
    if "[STATUS]" in line:
        return "status"
    if line.startswith("["):
        return "other"
    return previous


def _log_panel(parent, log_path):
    """Right column: live-tailing log with filter and search."""
    import tkinter as tk
    from tkinter import ttk

    win = parent

    state = {"pos": 0, "entries": [], "last_cat": "other"}   # entries: (category, text)
    filter_var = tk.StringVar(value=FILTERS[0])
    search_var = tk.StringVar()
    follow_var = tk.BooleanVar(value=True)

    bar = ttk.Frame(win, padding=(8, 8, 8, 4))
    bar.pack(fill="x")
    ttk.Label(bar, text="Show:").pack(side="left")
    combo = ttk.Combobox(bar, textvariable=filter_var, values=FILTERS, state="readonly", width=20)
    combo.pack(side="left", padx=(4, 12))
    ttk.Label(bar, text="Search:").pack(side="left")
    ttk.Entry(bar, textvariable=search_var, width=28).pack(side="left", padx=(4, 12))
    ttk.Checkbutton(bar, text="Follow new lines", variable=follow_var).pack(side="left")

    body = ttk.Frame(win)
    body.pack(fill="both", expand=True, padx=8)
    text = tk.Text(body, wrap="none", font=("Consolas", 9), state="disabled", undo=False)
    ys = ttk.Scrollbar(body, orient="vertical", command=text.yview)
    xs = ttk.Scrollbar(body, orient="horizontal", command=text.xview)
    text.configure(yscrollcommand=ys.set, xscrollcommand=xs.set)
    ys.pack(side="right", fill="y")
    xs.pack(side="bottom", fill="x")
    text.pack(side="left", fill="both", expand=True)
    text.tag_configure("error", foreground="#cf222e")
    text.tag_configure("status", foreground="#0969da")
    text.tag_configure("request", foreground="#57606a")

    footer = ttk.Frame(win, padding=8)
    footer.pack(fill="x")
    count_var = tk.StringVar()
    ttk.Label(footer, textvariable=count_var).pack(side="left")

    def matches(entry):
        cat, line = entry
        wanted = filter_var.get()
        if wanted == "Requests" and cat != "request":
            return False
        if wanted == "Errors and warnings" and cat != "error":
            return False
        if wanted == "Status" and cat != "status":
            return False
        term = search_var.get().strip().lower()
        return not term or term in line.lower()

    def insert(entries):
        text.configure(state="normal")
        for cat, line in entries:
            text.insert("end", line + "\n", cat if cat in ("error", "status", "request") else ())
        text.configure(state="disabled")

    def update_count():
        shown = int(text.index("end-1c").split(".")[0]) - 1
        count_var.set(f"{shown} of {len(state['entries'])} lines shown")

    def render():
        text.configure(state="normal")
        text.delete("1.0", "end")
        text.configure(state="disabled")
        insert([e for e in state["entries"] if matches(e)])
        update_count()
        if follow_var.get():
            text.see("end")

    def read_new():
        try:
            size = os.path.getsize(log_path)
        except OSError:
            return []
        if size < state["pos"]:          # log was rotated: start over
            state["pos"] = 0
            state["entries"].clear()
            state["reset"] = True
        try:
            with open(log_path, "rb") as f:
                if state["pos"] == 0 and size > INITIAL_TAIL_BYTES:
                    f.seek(size - INITIAL_TAIL_BYTES)
                    f.readline()         # drop the partial first line
                else:
                    f.seek(state["pos"])
                data = f.read()
                state["pos"] = f.tell()
        except OSError:
            return []
        return data.decode("utf-8", "replace").splitlines()

    def poll():
        if not win.winfo_exists():
            return
        lines = read_new()
        if lines:
            new = []
            for line in lines:
                cat = classify(line, state["last_cat"])
                state["last_cat"] = cat
                new.append((cat, line))
            state["entries"].extend(new)
            if len(state["entries"]) > MAX_LINES or state.pop("reset", False):
                del state["entries"][:max(0, len(state["entries"]) - MAX_LINES)]
                render()
            else:
                insert([e for e in new if matches(e)])
                update_count()
                if follow_var.get():
                    text.see("end")
        win.after(LOG_POLL_MS, poll)

    def copy_visible():
        win.clipboard_clear()
        win.clipboard_append(text.get("1.0", "end-1c"))

    ttk.Button(footer, text="Copy", command=copy_visible).pack(side="right", padx=(8, 0))
    ttk.Button(footer, text="Open file", command=lambda: os.startfile(log_path)).pack(side="right", padx=(8, 0))
    ttk.Button(footer, text="Clear view", command=lambda: (state["entries"].clear(), render())).pack(side="right")

    combo.bind("<<ComboboxSelected>>", lambda _e: render())
    search_var.trace_add("write", lambda *_: render())
    poll()
    win.controller = {"render": render, "text": lambda: text.get("1.0", "end-1c"),
                      "filter": filter_var, "search": search_var}
    return win


def run(app, server):
    state = {"color": RED, "text": "Starting..."}
    ui = Ui()
    icon = pystray.Icon("mmg-helper", make_icon(RED), "MMG POS Helper")

    def refresh():
        color, text = compute_status(app, server)
        if text != state["text"]:
            # One line per change, so helper.log shows when the printer dropped or came back.
            print(f"[{app.get_local_time()}] [STATUS] {text}")
        state["color"], state["text"] = color, text
        icon.icon = make_icon(color)
        icon.title = f"MMG POS Helper - {text}"[:127]  # Windows tooltip limit
        icon.update_menu()

    def poll():
        while not stop.is_set():
            try:
                refresh()
            except Exception as e:
                print(f"[tray] status refresh failed: {e}")
            stop.wait(POLL_SECONDS)

    def notify(msg):
        try:
            icon.notify(msg, "MMG POS Helper")
        except Exception:
            pass

    def test_print(_icon=None, _item=None):
        def work():
            result = app.print_test({"message": "TEST PRINT"})
            notify(result.get("error") and f"Test print failed: {result['error']}" or "Test print sent.")
        threading.Thread(target=work, daemon=True).start()

    def on_saved():
        app.apply_config(server)
        notify("Settings saved. Helper restarted.")
        threading.Thread(target=refresh, daemon=True).start()

    def open_main(_icon=None, _item=None):
        ui.open_once("main", lambda root: _main_window(
            root, app, on_saved, app.LOG_PATH, lambda: (state["color"], state["text"])))

    def open_path(path):
        try:
            os.startfile(path)
        except Exception as e:
            notify(f"Could not open {path}: {e}")

    def restart(_icon=None, _item=None):
        def work():
            app.apply_config(server)
            notify("Helper restarted.")
            refresh()
        threading.Thread(target=work, daemon=True).start()

    def quit_(_icon=None, _item=None):
        stop.set()
        server.stop()
        icon.stop()

    stop = threading.Event()
    icon.menu = pystray.Menu(
        pystray.MenuItem(lambda _i: state["text"], None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Test Print", test_print),
        pystray.MenuItem("Settings and Logs...", open_main, default=True),
        pystray.MenuItem("Open Journal Folder", lambda *_: open_path(app._DATA_DIR)),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Restart", restart),
        pystray.MenuItem("Quit", quit_),
    )

    server.start()

    def setup(_icon):
        _icon.visible = True
        threading.Thread(target=poll, name="tray-poll", daemon=True).start()
        if helper_config.unset_credentials(app.CONFIG):
            notify("BIR credentials are not set. Right-click the tray icon > Settings and Logs.")

    icon.run(setup)
