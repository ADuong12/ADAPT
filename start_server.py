"""Start the ADAPT server persistently in the background.

Usage:
    python start_server.py          # start
    python start_server.py --stop   # stop
    python start_server.py --status # check
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PID_FILE = ROOT / ".server_pid"


def start() -> None:
    if PID_FILE.exists():
        pid = int(PID_FILE.read_text())
        try:
            proc = subprocess.Popen(["tasklist", "/FI", f"PID eq {pid}"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            proc.communicate()
            print(f"Server already running (PID {pid}). Use --stop to kill first.")
            return
        except Exception:
            PID_FILE.unlink(missing_ok=True)

    log_dir = ROOT
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"],
        stdout=open(log_dir / "server_stdout.log", "a"),
        stderr=open(log_dir / "server_stderr.log", "a"),
        cwd=ROOT,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
    )
    PID_FILE.write_text(str(proc.pid))

    # Wait for it to come up
    for _ in range(10):
        try:
            import requests
            r = requests.get("http://127.0.0.1:8000/api/health", timeout=2)
            if r.status_code == 200:
                print(f"Server started (PID {proc.pid}): http://localhost:8000")
                print(f"Frontend: http://localhost:8000/app/login.html")
                print(f"API docs: http://localhost:8000/docs")
                return
        except Exception:
            time.sleep(1)
    print("Server started but health check failed — check server_stderr.log")


def stop() -> None:
    if not PID_FILE.exists():
        print("No PID file found (server not running via this script)")
        return
    pid = int(PID_FILE.read_text())
    try:
        subprocess.run(["taskkill", "/F", "/PID", str(pid)], capture_output=True, timeout=5)
        print(f"Killed server (PID {pid})")
    except Exception:
        print(f"Could not kill PID {pid}")
    PID_FILE.unlink(missing_ok=True)


def status() -> None:
    if not PID_FILE.exists():
        print("Server not running (no PID file)")
        return
    pid = int(PID_FILE.read_text())
    try:
        proc = subprocess.run(["tasklist", "/FI", f"PID eq {pid}"], capture_output=True, text=True, timeout=5)
        if str(pid) in proc.stdout:
            print(f"Server running (PID {pid})")
            import requests
            try:
                r = requests.get("http://127.0.0.1:8000/api/health", timeout=3)
                print(f"Health: {r.json()}")
            except Exception:
                print("Health check failed (server may be starting up)")
        else:
            print(f"PID {pid} not found — server is dead")
            PID_FILE.unlink(missing_ok=True)
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--stop", action="store_true")
    parser.add_argument("--status", action="store_true")
    args = parser.parse_args()
    if args.stop:
        stop()
    elif args.status:
        status()
    else:
        start()
