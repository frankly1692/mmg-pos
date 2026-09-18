"""Send print()/traceback output to helper.log.

The tray build has no console (sys.stdout is None), so without this every log
line and traceback would vanish. Output still goes to the console when there is
one (dev runs, --no-tray).
"""
import os
import sys

MAX_BYTES = 5_000_000  # full request payloads are logged, so leave room for a few days


class _Tee:
    def __init__(self, *streams):
        self._streams = [s for s in streams if s is not None]

    def write(self, text):
        for s in self._streams:
            try:
                s.write(text)
                s.flush()
            except Exception:
                pass  # logging must never take the helper down
        return len(text)

    def flush(self):
        for s in self._streams:
            try:
                s.flush()
            except Exception:
                pass

    def isatty(self):
        return False


def setup(data_dir: str) -> str:
    """Redirect stdout/stderr to <data_dir>/helper.log. Returns the log path."""
    path = os.path.join(data_dir, "helper.log")
    try:
        # Keep one previous log so a restart loop can't grow the file forever.
        if os.path.exists(path) and os.path.getsize(path) > MAX_BYTES:
            os.replace(path, path + ".1")
        log = open(path, "a", encoding="utf-8", buffering=1)
    except Exception:
        return path  # can't log to file; leave streams alone
    sys.stdout = _Tee(sys.stdout, log)
    sys.stderr = _Tee(sys.stderr, log)
    return path
