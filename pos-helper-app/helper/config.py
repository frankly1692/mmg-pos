"""Helper configuration: one config.json per workstation.

Lives in the data dir (C:\\MMG-POS by default, override with MMG_POS_DATA_DIR)
next to ejournal.txt. Created with defaults on first run. A legacy
terminal.json (MIN/SN/PTU_NO only) is still read and migrated.
"""
import json
import os
import re
import sys

DEFAULTS = {
    "MIN": "---",
    "SN": "---",
    "PTU_NO": "---",
    "printer_ip": "192.168.192.168",
    "display_port": "COM3",
    "display_baudrate": 9600,
    "ws_port": 9999,
}

# Values that mean "BIR credentials were never filled in"
_PLACEHOLDERS = {"", "---", "000-000000-0", "S/N0000000000", "PTU-000000000000"}

_BASE_DIR = (
    os.path.dirname(sys.executable)
    if getattr(sys, "frozen", False)
    else os.path.dirname(os.path.abspath(__file__))
)


def resolve_data_dir() -> str:
    fixed_dir = os.environ.get("MMG_POS_DATA_DIR", r"C:\MMG-POS")
    try:
        os.makedirs(fixed_dir, exist_ok=True)
        return fixed_dir
    except Exception as e:
        print(f"[WARN] Could not use {fixed_dir} ({e}), falling back to {_BASE_DIR}")
        return _BASE_DIR


def _read_json(path: str):
    try:
        with open(path, "r", encoding="utf-8-sig") as f:  # utf-8-sig tolerates a BOM
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError("top level must be a JSON object")
        return data, None
    except FileNotFoundError:
        return None, None
    except Exception as e:
        return None, f"could not read {path}: {e}"


def is_placeholder(value) -> bool:
    return str(value).strip() in _PLACEHOLDERS


def unset_credentials(cfg: dict) -> list:
    """Names of BIR fields that still hold placeholder values."""
    return [k for k in ("MIN", "SN", "PTU_NO") if is_placeholder(cfg[k])]


def errors(cfg: dict) -> list:
    """Problems that make the config wrong (as opposed to merely incomplete)."""
    problems = []
    ip = str(cfg["printer_ip"]).strip()
    if not ip:
        problems.append("printer_ip is empty")
    elif not re.fullmatch(r"[A-Za-z0-9.\-]+", ip):
        problems.append(f"printer_ip '{ip}' is not a valid IP or hostname")
    if not re.fullmatch(r"COM\d+|/dev/\S+", str(cfg["display_port"]), re.IGNORECASE):
        problems.append(f"display_port '{cfg['display_port']}' should look like COM3")
    for key in ("ws_port", "display_baudrate"):
        if not isinstance(cfg[key], int) or isinstance(cfg[key], bool) or cfg[key] <= 0:
            problems.append(f"{key} must be a positive number")
    if isinstance(cfg["ws_port"], int) and not (1 <= cfg["ws_port"] <= 65535):
        problems.append("ws_port must be between 1 and 65535")
    for key in ("MIN", "SN", "PTU_NO"):
        if len(str(cfg[key])) > 40:
            problems.append(f"{key} is too long")
    return problems


def validate(cfg: dict) -> list:
    """Return human-readable problems. Empty list means the config is usable."""
    problems = [f"{k} is not set (receipts will show a placeholder)" for k in unset_credentials(cfg)]
    return problems + errors(cfg)


def save(data_dir: str, cfg: dict) -> None:
    """Write config.json atomically (temp file + replace) so a crash can't truncate it."""
    path = os.path.join(data_dir, "config.json")
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({k: cfg[k] for k in DEFAULTS}, f, indent=2)
    os.replace(tmp, path)


def load(data_dir: str) -> tuple:
    """Load config, returning (config, warnings).

    Never raises: a broken file falls back to defaults and reports why, so the
    helper still starts and can journal receipts.
    """
    config_path = os.path.join(data_dir, "config.json")
    legacy_path = os.path.join(data_dir, "terminal.json")
    warnings = []
    cfg = dict(DEFAULTS)

    data, err = _read_json(config_path)
    if err:
        warnings.append(err + " — using defaults")
    if data is None and err is None:
        # No config.json yet: migrate legacy terminal.json if present, then create the file.
        legacy, lerr = _read_json(legacy_path)
        if lerr:
            warnings.append(lerr)
        data = legacy or {}
        cfg.update({k: v for k, v in data.items() if k in DEFAULTS})
        try:
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(cfg, f, indent=2)
            print(f"[INFO] Created {config_path}" + (" (migrated from terminal.json)" if legacy else ""))
        except Exception as e:
            warnings.append(f"could not create {config_path}: {e}")
    elif data:
        unknown = sorted(set(data) - set(DEFAULTS))
        if unknown:
            warnings.append(f"ignoring unknown keys: {', '.join(unknown)}")
        cfg.update({k: v for k, v in data.items() if k in DEFAULTS})

    # A JSON typo like "ws_port": "9999" (string) is common when hand-editing
    for key in ("ws_port", "display_baudrate"):
        if isinstance(cfg[key], str) and cfg[key].strip().isdigit():
            cfg[key] = int(cfg[key].strip())

    warnings.extend(validate(cfg))
    return cfg, warnings
