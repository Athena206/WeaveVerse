import os
import secrets
from pathlib import Path

import pymysql
from dotenv import dotenv_values

BASE_DIR = Path(__file__).resolve().parent
DATABASE = "first_saree_centre"
ENV_FILE = BASE_DIR / ".env"
settings = dotenv_values(ENV_FILE)
host = settings.get("MYSQL_HOST") or "127.0.0.1"
port = int(settings.get("MYSQL_PORT") or "3306")
root_password = settings.get("MYSQL_ROOT_PASSWORD") or ""
if root_password.startswith("change-me-after-"):
    root_password = ""
app_user = "fsc_app"
app_password = settings.get("MYSQL_PASSWORD")
if not app_password or app_password == "change-me":
    app_password = secrets.token_urlsafe(36)
secret_key = settings.get("SECRET_KEY")
if not secret_key or secret_key.startswith("replace-with-"):
    secret_key = secrets.token_urlsafe(48)

try:
    connection = pymysql.connect(
        host=host,
        port=port,
        user="root",
        password=root_password,
        charset="utf8mb4",
        autocommit=True,
    )
except pymysql.MySQLError as error:
    raise SystemExit(
        f"Could not connect to local MySQL at {host}:{port}. "
        "Start it with backend\\run_mysql.ps1 and check MYSQL_ROOT_PASSWORD in backend\\.env."
    ) from error

try:
    with connection.cursor() as cursor:
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS `{DATABASE}` "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
        cursor.execute(f"USE `{DATABASE}`")

        cursor.execute(
            """
            SELECT COLUMN_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'sarees'
            """,
            (DATABASE,),
        )
        existing_columns = {row[0] for row in cursor.fetchall()}
        migrations = {
            "image_credit": "VARCHAR(180) NOT NULL DEFAULT 'First Saree Centre'",
            "image_license": "VARCHAR(80) NOT NULL DEFAULT 'Project photography'",
            "image_source": "VARCHAR(1000) NOT NULL DEFAULT ''",
        }
        for name, declaration in migrations.items():
            if existing_columns and name not in existing_columns:
                cursor.execute(f"ALTER TABLE sarees ADD COLUMN {name} {declaration}")

        if existing_columns:
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'sarees'
                  AND INDEX_NAME = 'uq_sarees_name'
                """,
                (DATABASE,),
            )
            if cursor.fetchone()[0] == 0:
                cursor.execute(
                    "ALTER TABLE sarees ADD UNIQUE KEY uq_sarees_name (saree_name)"
                )

        for sql in (BASE_DIR / "schema.sql").read_text(encoding="utf-8").split(";"):
            if sql.strip():
                cursor.execute(sql)

        for account_host in ("localhost", "127.0.0.1"):
            cursor.execute(
                f"CREATE USER IF NOT EXISTS '{app_user}'@'{account_host}' "
                "IDENTIFIED BY %s",
                (app_password,),
            )
            cursor.execute(
                f"ALTER USER '{app_user}'@'{account_host}' IDENTIFIED BY %s",
                (app_password,),
            )
            cursor.execute(
                f"GRANT SELECT, INSERT, UPDATE, DELETE ON `{DATABASE}`.* "
                f"TO '{app_user}'@'{account_host}'"
            )

        if not root_password:
            root_password = secrets.token_urlsafe(36)
            cursor.execute(
                "ALTER USER 'root'@'localhost' IDENTIFIED BY %s",
                (root_password,),
            )
        cursor.execute("SELECT COUNT(*) FROM sarees WHERE is_active = TRUE")
        product_count = cursor.fetchone()[0]
finally:
    connection.close()

ENV_FILE.write_text(
    "\n".join(
        [
            f"MYSQL_HOST={host}",
            f"MYSQL_PORT={port}",
            f"MYSQL_USER={app_user}",
            f"MYSQL_PASSWORD={app_password}",
            f"MYSQL_ROOT_PASSWORD={root_password}",
            f"MYSQL_DATABASE={DATABASE}",
            f"SECRET_KEY={secret_key}",
            "FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173",
            "UPLOAD_FOLDER=uploads",
            "JWT_TTL_HOURS=12",
            "",
        ]
    ),
    encoding="utf-8",
)
if os.name != "nt":
    os.chmod(ENV_FILE, 0o600)

print(
    f"MySQL `{DATABASE}` is ready with {product_count} sarees. "
    "Generated root and app credentials are saved in the ignored backend\\.env file."
)
