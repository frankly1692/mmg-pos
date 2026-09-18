"""Provider password for the Settings and Logs window.

The password is chosen by the provider at install time. Only a salted scrypt hash is stored, in
<data dir>\\secure\\admin.json, a folder the installer restricts to administrators (cashiers, who
are standard users, can read it but cannot change or delete it). If that file exists the window
asks for the password; if it is missing the window is unlocked (install without a password).

Fails closed: a damaged admin.json keeps the window locked instead of silently unlocking it.
Recovery is by a Windows administrator: run the installer with /ADMINPW=<new password>.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time

MIN_LENGTH = 8
SCRYPT = {"n": 2 ** 14, "r": 8, "p": 1}
FAILS_BEFORE_LOCKOUT = 5
LOCKOUT_SECONDS = 30
MAX_LOCKOUT_SECONDS = 15 * 60


def _path(data_dir: str) -> str:
    return os.path.join(data_dir, "secure", "admin.json")


def is_enabled(data_dir: str) -> bool:
    return os.path.exists(_path(data_dir))


def _hash(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, n=n, r=r, p=p, dklen=32, maxmem=64 * 1024 * 1024)


def set_password(data_dir: str, password: str) -> None:
    """Create or replace the provider password. Raises ValueError if it is too short."""
    if len(password) < MIN_LENGTH:
        raise ValueError(f"password must be at least {MIN_LENGTH} characters")
    os.makedirs(os.path.dirname(_path(data_dir)), exist_ok=True)
    salt = secrets.token_bytes(16)
    record = {
        "v": 1, **SCRYPT,
        "salt": base64.b64encode(salt).decode("ascii"),
        "hash": base64.b64encode(_hash(password, salt, **SCRYPT)).decode("ascii"),
    }
    tmp = _path(data_dir) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(record, f)
    os.replace(tmp, _path(data_dir))   # atomic: never leaves a half-written file


def verify(data_dir: str, password: str) -> bool:
    """True only if the password matches. Missing or damaged file: False (fail closed)."""
    try:
        with open(_path(data_dir), "r", encoding="utf-8") as f:
            rec = json.load(f)
        salt = base64.b64decode(rec["salt"])
        expected = base64.b64decode(rec["hash"])
        actual = _hash(password, salt, int(rec["n"]), int(rec["r"]), int(rec["p"]))
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


class Gate:
    """Checks password attempts with an escalating lockout: after every 5 wrong tries in a row
    the window refuses attempts for 30 s, doubling each time up to 15 min. In memory only."""

    def __init__(self, data_dir: str, clock=time.monotonic):
        self.data_dir = data_dir
        self._clock = clock
        self.failures = 0
        self.lockouts = 0
        self.locked_until = 0.0

    def seconds_locked(self) -> int:
        return max(0, int(self.locked_until - self._clock() + 0.999))

    def check(self, password: str) -> tuple:
        """Returns (ok, message). The message is safe to show the user."""
        wait = self.seconds_locked()
        if wait:
            return False, f"Too many wrong attempts. Try again in {wait} s."
        if verify(self.data_dir, password):
            self.failures = self.lockouts = 0
            return True, ""
        self.failures += 1
        if self.failures % FAILS_BEFORE_LOCKOUT == 0:
            self.lockouts += 1
            delay = min(LOCKOUT_SECONDS * 2 ** (self.lockouts - 1), MAX_LOCKOUT_SECONDS)
            self.locked_until = self._clock() + delay
            return False, f"Wrong password. Locked for {delay} s."
        return False, "Wrong password."
