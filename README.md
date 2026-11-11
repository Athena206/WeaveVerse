# WeaveVerse

A local-first saree storefront with a React front end, Flask API, and a real
MySQL 8.4 database. The starter includes customer accounts, an inventory-backed
shopping bag and checkout, live reviews, 24 saree listings, fabric discovery,
and a persistent light/dark theme. Its visual identity uses a custom woven W
mark, an editorial forest-and-ivory palette, and a curated collection of Indian
saree model photography.

## Run it on Windows

The local MySQL server is extracted into the project and runs as your Windows
user on `127.0.0.1`; this setup does not require an administrator account or
install a Windows service.

### 1. Install and start the project-local MySQL server

Open PowerShell in the project folder:

```powershell
.\backend\install_mysql.ps1
.\backend\run_mysql.ps1
```

Keep that PowerShell window open while you use the shop. The server listens on
localhost port `3306`; it is not exposed to your network. The first run creates
a database directory in `backend\mysql-data`.

### 2. Configure and seed the database

In a second PowerShell window:

```powershell
if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
py -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
backend\.venv\Scripts\python.exe backend\setup_database.py
```

The setup script creates the MySQL tables, seeds 24 sarees with 24 local product
photos, creates a restricted application database user, and generates passwords
and a signing secret in `backend\.env`. That file is ignored by Git; do not
share it. For a fresh database, keep `MYSQL_ROOT_PASSWORD` blank in
`backend\.env`; the setup script assigns a generated root password. Re-running
the setup keeps existing inventory counts intact.

### 3. Start the API and storefront

In one PowerShell window:

```powershell
backend\.venv\Scripts\python.exe backend\app.py
```

In another:

```powershell
Set-Location frontend
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The API health check is
available at [http://127.0.0.1:5000/api/health](http://127.0.0.1:5000/api/health).
Use the browser's theme button to switch between light and dark mode. The choice
is remembered on that device.

## Shop features

- 24 named sarees with stock, prices, weave, region, occasion, and local photos.
- Search and filter by fabric, region, and occasion; sort by price or name.
- Product pages with quantity controls, an image credit, and customer reviews.
- Customer registration, sign-in, session restoration, sign-out, and order history.
- Open `/#login` to sign in or `/#register` to create an account. The header
  provides account and sign-out actions on desktop and mobile.
- A persistent shopping bag and transactional checkout that checks and decrements
  stock in MySQL.
- Responsive layouts for mobile and desktop.

## Photo credits and product imagery

The 24 model photographs are locally stored Unsplash images; each product page
links to the corresponding Unsplash photo and displays the Unsplash License
credit. The photographs are styling inspiration, not verified photos of the
specific sample inventory. Confirm product colours and details with customers,
and replace the illustrative images with your own product photography before
accepting real customer orders.

## API routes

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | No | API availability |
| `POST` | `/api/auth/register` | No | Create a customer account |
| `POST` | `/api/auth/login` | No | Verify credentials and return a JWT |
| `GET` | `/api/auth/me` | Bearer JWT | Restore the current customer session |
| `GET` | `/api/products` | No | List/search/filter/sort sarees |
| `GET` | `/api/products/<id>` | No | Get saree details and rating summary |
| `GET` | `/api/products/<id>/reviews` | No | Read customer reviews |
| `POST` | `/api/products/<id>/reviews` | Bearer JWT | Submit a rating and review |
| `GET` | `/api/orders` | Bearer JWT | Read the customer's order history |
| `POST` | `/api/orders` | Bearer JWT | Place an order and decrement stock |

Product filters support `q`, `fabric`, `category`, `region`, and `occasion`.
Orders accept `{"items":[{"product_id":1,"quantity":1}]}`. The API calculates
prices from MySQL, locks products during checkout, and creates the order,
details, and stock updates in one transaction.

## Add product photography

Place image files in `backend\uploads` and save paths such as
`/uploads/my-saree.jpg` in the `sarees.image_url` column. For a public
production site, use object storage/CDN URLs instead of serving large images
from the development server.

## Production checklist

This is a working local foundation, not a production deployment. Before
launching publicly, use HTTPS and a managed MySQL service, back up the database,
add rate limiting and email verification, configure a production WSGI server,
and connect a real payment gateway and shipping provider. Product seed data,
prices, stock, and sample photos are illustrative.
