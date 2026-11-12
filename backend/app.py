import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from functools import wraps
from pathlib import Path
from typing import Any, Callable

import jwt
import pymysql
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from pymysql.cursors import DictCursor
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
UPLOAD_FOLDER = Path(os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "uploads")))
if not UPLOAD_FOLDER.is_absolute():
    UPLOAD_FOLDER = BASE_DIR / UPLOAD_FOLDER
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

app = Flask(
    __name__,
    static_folder=str(FRONTEND_DIR),
    static_url_path="",
)
app.config["UPLOAD_FOLDER"] = str(UPLOAD_FOLDER)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "")


@app.get("/")
def storefront() -> Any:
    return app.send_static_file("index.html")


def get_connection() -> pymysql.Connection:
    return pymysql.connect(
        host=os.getenv("MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("MYSQL_PORT", "3306")),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "first_saree_centre"),
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,
    )


def json_body() -> dict[str, Any]:
    body = request.get_json()
    if not isinstance(body, dict):
        raise ValueError("A JSON object is required.")
    return body


def issue_token(customer_id: int) -> str:
    lifetime = int(os.getenv("JWT_TTL_HOURS", "12"))
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": str(customer_id), "iat": now, "exp": now + timedelta(hours=lifetime)},
        app.config["SECRET_KEY"],
        algorithm="HS256",
    )


def token_required(handler: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(handler)
    def wrapped(*args: Any, **kwargs: Any) -> Any:
        authorization = request.headers.get("Authorization", "")
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return jsonify({"error": "A bearer token is required."}), 401
        try:
            claims = jwt.decode(
                token, app.config["SECRET_KEY"], algorithms=["HS256"]
            )
            request.customer_id = int(claims["sub"])
        except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
            return jsonify({"error": "The authentication token is invalid or expired."}), 401
        return handler(*args, **kwargs)

    return wrapped


@app.errorhandler(ValueError)
def handle_value_error(error: ValueError) -> tuple[Any, int]:
    return jsonify({"error": str(error)}), 400


@app.errorhandler(HTTPException)
def handle_http_error(error: HTTPException) -> tuple[Any, int]:
    return jsonify({"error": error.description}), error.code or 500


@app.errorhandler(pymysql.err.IntegrityError)
def handle_integrity_error(error: pymysql.err.IntegrityError) -> tuple[Any, int]:
    app.logger.info("A database uniqueness or integrity constraint was rejected.")
    return jsonify({"error": "The request conflicts with existing data."}), 409


@app.errorhandler(pymysql.MySQLError)
def handle_database_error(error: pymysql.MySQLError) -> tuple[Any, int]:
    app.logger.exception("MySQL request failed.")
    return jsonify({"error": "Database is unavailable. Check MySQL service and configuration."}), 503


@app.get("/api/health")
def health() -> Any:
    return jsonify({"status": "ok"})


@app.post("/api/auth/register")
def register() -> Any:
    body = json_body()
    first_name = str(body.get("first_name", "")).strip()
    last_name = str(body.get("last_name", "")).strip()
    email = str(body.get("email", "")).strip().lower()
    password = body.get("password")

    if not first_name or len(first_name) > 80:
        raise ValueError("First name is required and must be at most 80 characters.")
    if not last_name or len(last_name) > 80:
        raise ValueError("Last name is required and must be at most 80 characters.")
    if len(email) > 254 or "@" not in email:
        raise ValueError("A valid email address is required.")
    if not isinstance(password, str) or not 8 <= len(password) <= 128:
        raise ValueError("Password must contain between 8 and 128 characters.")
    password_confirm = body.get("password_confirm")
    if password_confirm is not None and password != password_confirm:
        raise ValueError("Passwords do not match.")

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM customers WHERE email = %s", (email,))
            if cursor.fetchone():
                return jsonify({"error": "An account with this email already exists."}), 409
            cursor.execute(
                """
                INSERT INTO customers (first_name, last_name, email, password_hash)
                VALUES (%s, %s, %s, %s)
                """,
                (first_name, last_name, email, generate_password_hash(password)),
            )
            customer_id = cursor.lastrowid
        connection.commit()

    return jsonify(
        {
            "token": issue_token(customer_id),
            "customer": {
                "id": customer_id,
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
            },
        }
    ), 201


@app.post("/api/auth/login")
def login() -> Any:
    body = json_body()
    email = str(body.get("email", "")).strip().lower()
    password = body.get("password")
    if not email or not isinstance(password, str):
        raise ValueError("Email and password are required.")

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, first_name, last_name, email, password_hash
                FROM customers
                WHERE email = %s AND is_active = TRUE
                """,
                (email,),
            )
            customer = cursor.fetchone()

    if not customer or not check_password_hash(customer["password_hash"], password):
        return jsonify({"error": "Email or password is incorrect."}), 401
    return jsonify(
        {
            "token": issue_token(customer["id"]),
            "customer": {
                "id": customer["id"],
                "first_name": customer["first_name"],
                "last_name": customer["last_name"],
                "email": customer["email"],
            },
        }
    )


@app.get("/api/auth/me")
@token_required
def current_customer() -> Any:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, first_name, last_name, email
                FROM customers
                WHERE id = %s AND is_active = TRUE
                """,
                (request.customer_id,),
            )
            customer = cursor.fetchone()
    if not customer:
        return jsonify({"error": "This customer account is no longer active."}), 401
    return jsonify({"customer": customer})


def serialize_product(product: dict[str, Any]) -> dict[str, Any]:
    product["price"] = str(product["price"])
    product["average_rating"] = float(product["average_rating"])
    if product["image_url"].startswith("/uploads/"):
        product["image_url"] = f"{request.host_url.rstrip('/')}{product['image_url']}"
    return product


@app.get("/api/products")
def list_products() -> Any:
    filters = {
        "q": request.args.get("q", "").strip(),
        "category": request.args.get("category", "").strip(),
        "fabric": request.args.get("fabric", "").strip(),
        "region": request.args.get("region", "").strip(),
        "occasion": request.args.get("occasion", "").strip(),
    }
    clauses = ["s.is_active = TRUE"]
    values: list[str] = []
    if filters["q"]:
        clauses.append(
            "(s.saree_name LIKE %s OR s.description LIKE %s OR s.weave LIKE %s "
            "OR s.fabric LIKE %s OR s.region LIKE %s)"
        )
        search_term = f"%{filters['q']}%"
        values.extend([search_term] * 5)
    for field in ("category", "fabric", "region", "occasion"):
        if filters[field]:
            clauses.append(f"s.{field} = %s")
            values.append(filters[field])

    sort_options = {
        "newest": "s.created_at DESC, s.product_id DESC",
        "price-asc": "s.price ASC, s.product_id DESC",
        "price-desc": "s.price DESC, s.product_id DESC",
        "name": "s.saree_name ASC",
    }
    ordering = sort_options.get(request.args.get("sort", "newest"), sort_options["newest"])
    query = f"""
        SELECT s.product_id, s.saree_name, s.category, s.fabric, s.weave, s.region,
               s.occasion, s.description, s.price, s.stock, s.image_url,
               s.image_credit, s.image_license, s.image_source,
               COALESCE(r.review_count, 0) AS review_count,
               COALESCE(r.average_rating, 0) AS average_rating
        FROM sarees AS s
        LEFT JOIN (
            SELECT product_id, COUNT(*) AS review_count, AVG(rating) AS average_rating
            FROM reviews
            GROUP BY product_id
        ) AS r ON r.product_id = s.product_id
        WHERE {' AND '.join(clauses)}
        ORDER BY {ordering}
    """
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, values)
            products = cursor.fetchall()
    return jsonify({"products": [serialize_product(product) for product in products]})


@app.get("/api/products/<int:product_id>")
def get_product(product_id: int) -> Any:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT product_id, saree_name, category, fabric, weave, region,
                       occasion, description, price, stock, image_url,
                       image_credit, image_license, image_source,
                       (SELECT COUNT(*) FROM reviews WHERE reviews.product_id = sarees.product_id)
                         AS review_count,
                       COALESCE(
                         (SELECT AVG(rating) FROM reviews WHERE reviews.product_id = sarees.product_id),
                         0
                       ) AS average_rating
                FROM sarees
                WHERE product_id = %s AND is_active = TRUE
                """,
                (product_id,),
            )
            product = cursor.fetchone()
    if not product:
        return jsonify({"error": "Saree not found."}), 404
    return jsonify({"product": serialize_product(product)})


@app.get("/api/products/<int:product_id>/reviews")
def list_reviews(product_id: int) -> Any:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT r.review_id, r.rating, r.review_text, r.created_at,
                       c.first_name, c.last_name
                FROM reviews AS r
                JOIN customers AS c ON c.id = r.customer_id
                WHERE r.product_id = %s AND c.is_active = TRUE
                ORDER BY r.created_at DESC
                """,
                (product_id,),
            )
            reviews = cursor.fetchall()
    return jsonify({"reviews": reviews})


@app.post("/api/products/<int:product_id>/reviews")
@token_required
def create_review(product_id: int) -> Any:
    body = json_body()
    rating = body.get("rating")
    review_text = body.get("review_text")
    if isinstance(rating, bool) or not isinstance(rating, int) or not 1 <= rating <= 5:
        raise ValueError("Rating must be a whole number between 1 and 5.")
    if not isinstance(review_text, str) or not review_text.strip():
        raise ValueError("Write a short review before submitting.")
    review_text = review_text.strip()
    if len(review_text) > 1200:
        raise ValueError("Reviews must be at most 1,200 characters.")

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT product_id FROM sarees WHERE product_id = %s AND is_active = TRUE",
                (product_id,),
            )
            if not cursor.fetchone():
                return jsonify({"error": "Saree not found."}), 404
            cursor.execute(
                """
                INSERT INTO reviews (product_id, customer_id, rating, review_text)
                VALUES (%s, %s, %s, %s)
                """,
                (product_id, request.customer_id, rating, review_text),
            )
            review_id = cursor.lastrowid
        connection.commit()
    return jsonify({"review_id": review_id, "message": "Thank you for sharing your review."}), 201


@app.get("/api/orders")
@token_required
def list_orders() -> Any:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT o.order_id, o.total_amount, o.status, o.created_at,
                       d.product_id, d.saree_name, d.quantity, d.unit_price
                FROM orders AS o
                LEFT JOIN order_details AS d ON d.order_id = o.order_id
                WHERE o.customer_id = %s
                ORDER BY o.created_at DESC, o.order_id DESC
                """,
                (request.customer_id,),
            )
            rows = cursor.fetchall()
    orders: dict[int, dict[str, Any]] = {}
    for row in rows:
        order_id = row["order_id"]
        if order_id not in orders:
            order = {key: value for key, value in row.items() if key != "product_id"}
            order["total_amount"] = str(order["total_amount"])
            order["items"] = []
            orders[order_id] = order
        if row["product_id"] is not None:
            orders[order_id]["items"].append(
                {
                    "product_id": row["product_id"],
                    "saree_name": row["saree_name"],
                    "quantity": row["quantity"],
                    "unit_price": str(row["unit_price"]),
                }
            )
    return jsonify({"orders": list(orders.values())})


@app.post("/api/orders")
@token_required
def place_order() -> Any:
    body = json_body()
    items = body.get("items")
    if not isinstance(items, list) or not items:
        raise ValueError("At least one order item is required.")

    quantities: dict[int, int] = {}
    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Each item must include a product_id and quantity.")
        product_id = item.get("product_id")
        quantity = item.get("quantity")
        if (
            isinstance(product_id, bool)
            or not isinstance(product_id, int)
            or product_id <= 0
            or isinstance(quantity, bool)
            or not isinstance(quantity, int)
            or quantity <= 0
        ):
            raise ValueError("Product IDs and quantities must be positive integers.")
        quantities[product_id] = quantities.get(product_id, 0) + quantity

    product_ids = sorted(quantities)
    placeholders = ", ".join(["%s"] * len(product_ids))
    with get_connection() as connection:
        try:
            with connection.cursor() as cursor:
                # Lock products in ID order so concurrent orders cannot oversell stock.
                cursor.execute(
                    f"""
                    SELECT product_id, saree_name, price, stock
                    FROM sarees
                    WHERE is_active = TRUE AND product_id IN ({placeholders})
                    ORDER BY product_id
                    FOR UPDATE
                    """,
                    product_ids,
                )
                products = cursor.fetchall()
                if len(products) != len(product_ids):
                    raise ValueError("One or more selected sarees are unavailable.")

                total = Decimal("0.00")
                for product in products:
                    quantity = quantities[product["product_id"]]
                    if product["stock"] < quantity:
                        raise ValueError(
                            f"Only {product['stock']} item(s) remain for "
                            f"{product['saree_name']}."
                        )
                    total += product["price"] * quantity

                cursor.execute(
                    "INSERT INTO orders (customer_id, total_amount) VALUES (%s, %s)",
                    (request.customer_id, total),
                )
                order_id = cursor.lastrowid
                for product in products:
                    quantity = quantities[product["product_id"]]
                    cursor.execute(
                        """
                        INSERT INTO order_details
                          (order_id, product_id, saree_name, quantity, unit_price)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        (
                            order_id,
                            product["product_id"],
                            product["saree_name"],
                            quantity,
                            product["price"],
                        ),
                    )
                    cursor.execute(
                        """
                        UPDATE sarees
                        SET stock = stock - %s
                        WHERE product_id = %s AND stock >= %s
                        """,
                        (quantity, product["product_id"], quantity),
                    )
                    if cursor.rowcount != 1:
                        raise ValueError("Inventory changed during checkout. Please retry.")
            connection.commit()
        except Exception:
            connection.rollback()
            raise

    return jsonify(
        {"order_id": order_id, "total_amount": str(total), "status": "placed"}
    ), 201


@app.get("/uploads/<path:filename>")
def uploaded_image(filename: str) -> Any:
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


if __name__ == "__main__":
    if not app.config["SECRET_KEY"]:
        raise RuntimeError("Set SECRET_KEY in backend/.env before starting the API.")
    app.run(host="127.0.0.1", port=5000, debug=os.getenv("FLASK_DEBUG") == "1")
