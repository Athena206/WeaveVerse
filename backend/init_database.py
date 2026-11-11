import os
from pathlib import Path

import pymysql
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

database = "first_saree_centre"
connection = pymysql.connect(
    host="127.0.0.1",
    port=int(os.getenv("MYSQL_PORT", "3306")),
    user="root",
    password=os.getenv("MYSQL_ROOT_PASSWORD", ""),
    charset="utf8mb4",
    autocommit=True,
)

try:
    with connection.cursor() as cursor:
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS `{database}` "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
        cursor.execute(f"USE `{database}`")
        cursor.execute(
            """
            SELECT COLUMN_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'sarees'
            """,
            (database,),
        )
        existing_columns = {row[0] for row in cursor.fetchall()}
        migrations = {
            "image_credit": "VARCHAR(180) NOT NULL DEFAULT 'First Saree Centre'",
            "image_license": "VARCHAR(80) NOT NULL DEFAULT 'Project photography'",
            "image_source": "VARCHAR(1000) NOT NULL DEFAULT ''",
        }
        if existing_columns:
            for name, declaration in migrations.items():
                if name not in existing_columns:
                    cursor.execute(
                        f"ALTER TABLE sarees ADD COLUMN {name} {declaration}"
                    )
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'sarees'
                  AND INDEX_NAME = 'uq_sarees_name'
                """,
                (database,),
            )
            if cursor.fetchone()[0] == 0:
                cursor.execute(
                    "ALTER TABLE sarees ADD UNIQUE KEY uq_sarees_name (saree_name)"
                )

        schema = (BASE_DIR / "schema.sql").read_text(encoding="utf-8")
        for statement in schema.split(";"):
            if statement.strip():
                cursor.execute(statement)

        cursor.execute(
            "SELECT COUNT(*) FROM sarees WHERE is_active = TRUE"
        )
        product_count = cursor.fetchone()[0]
finally:
    connection.close()

print(f"MySQL database `{database}` is ready with {product_count} sarees.")
