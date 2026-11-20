import atexit
import os
import socket
import subprocess
import threading
import time
from pathlib import Path
from typing import IO

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
MYSQL_BASEDIR = (
    BASE_DIR / "mysql-portable" / "PFiles64" / "MySQL" / "MySQL Server 8.4"
)
MYSQLD_PATH = MYSQL_BASEDIR / "bin" / "mysqld.exe"
MYSQLADMIN_PATH = MYSQL_BASEDIR / "bin" / "mysqladmin.exe"
DATA_DIR = BASE_DIR / "mysql-data"
LOG_FILE = BASE_DIR / "mysql-server.log"
ERR_LOG_FILE = BASE_DIR / "mysql-server.err.log"

_lock = threading.Lock()
_managed_process: subprocess.Popen[bytes] | None = None
_managed_port: int | None = None
_log_handles: list[IO[bytes]] = []


def _is_port_open(host: str, port: int, timeout: float = 1.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def stop_managed_mysql() -> None:
    global _managed_process, _managed_port
    process = _managed_process
    port = _managed_port
    _managed_process = None
    _managed_port = None

    if process is not None and process.poll() is None:
        if port is not None and MYSQLADMIN_PATH.exists():
            load_dotenv(ENV_FILE, override=True)
            env = os.environ.copy()
            root_password = os.getenv("MYSQL_ROOT_PASSWORD", "")
            if root_password:
                env["MYSQL_PWD"] = root_password
            try:
                subprocess.run(
                    [
                        str(MYSQLADMIN_PATH),
                        "--protocol=TCP",
                        "-h",
                        "127.0.0.1",
                        "-P",
                        str(port),
                        "-u",
                        "root",
                        "shutdown",
                    ],
                    env=env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=10,
                    check=False,
                )
            except Exception:
                pass

        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()

    while _log_handles:
        handle = _log_handles.pop()
        try:
            handle.close()
        except Exception:
            pass


def ensure_mysql_running(timeout: float = 30.0) -> bool:
    """Ensure the local portable MySQL server is running on the configured port.

    Returns True if this process started MySQL, or False if it was already
    running (or configured for a remote host).
    """
    global _managed_process, _managed_port

    load_dotenv(ENV_FILE, override=True)
    host = os.getenv("MYSQL_HOST", "127.0.0.1").strip()
    port = int(os.getenv("MYSQL_PORT", "3307"))

    if host not in ("127.0.0.1", "localhost"):
        return False

    if _is_port_open("127.0.0.1", port):
        return False

    with _lock:
        if _is_port_open("127.0.0.1", port):
            return False

        if not MYSQLD_PATH.exists():
            raise RuntimeError(
                f"Local MySQL server binary not found at {MYSQLD_PATH}. "
                "Run backend\\install_mysql.ps1 first."
            )

        DATA_DIR.mkdir(parents=True, exist_ok=True)
        if not (DATA_DIR / "auto.cnf").exists():
            init_result = subprocess.run(
                [
                    str(MYSQLD_PATH),
                    "--no-defaults",
                    f"--basedir={MYSQL_BASEDIR}",
                    f"--datadir={DATA_DIR}",
                    "--initialize-insecure",
                    "--console",
                ],
                cwd=str(MYSQL_BASEDIR),
                capture_output=True,
                text=True,
                check=False,
            )
            if init_result.returncode != 0:
                raise RuntimeError(
                    f"MySQL data initialization failed (exit {init_result.returncode}): "
                    f"{init_result.stderr.strip()}"
                )

        stdout_handle = open(LOG_FILE, "wb")
        stderr_handle = open(ERR_LOG_FILE, "wb")
        _log_handles.extend([stdout_handle, stderr_handle])

        creationflags = 0
        if os.name == "nt":
            creationflags = (
                getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
                | getattr(subprocess, "CREATE_NO_WINDOW", 0)
            )

        process = subprocess.Popen(
            [
                str(MYSQLD_PATH),
                "--no-defaults",
                f"--basedir={MYSQL_BASEDIR}",
                f"--datadir={DATA_DIR}",
                "--bind-address=127.0.0.1",
                f"--port={port}",
                "--mysqlx=0",
                "--console",
            ],
            cwd=str(MYSQL_BASEDIR),
            stdout=stdout_handle,
            stderr=stderr_handle,
            creationflags=creationflags,
        )

        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if process.poll() is not None:
                err_tail = ""
                try:
                    stderr_handle.flush()
                    err_lines = ERR_LOG_FILE.read_text(
                        encoding="utf-8", errors="replace"
                    ).splitlines()
                    err_tail = " ".join(err_lines[-20:])
                except Exception:
                    pass
                stop_managed_mysql()
                raise RuntimeError(
                    f"MySQL exited during startup (exit {process.returncode}). {err_tail}"
                )
            if _is_port_open("127.0.0.1", port, timeout=0.5):
                _managed_process = process
                _managed_port = port
                atexit.register(stop_managed_mysql)
                print(
                    f"MySQL database started automatically on 127.0.0.1:{port} "
                    f"(PID {process.pid})."
                )
                return True
            time.sleep(0.5)

        process.terminate()
        stop_managed_mysql()
        raise RuntimeError(
            f"MySQL did not accept connections on 127.0.0.1:{port} within {timeout:.0f}s."
        )
