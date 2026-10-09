# E-Commerce RESTful API Backend

A production-ready e-commerce backend RESTful API built for an internship graduation project at DEKON. Developed with **NestJS**, running on a **MongoDB Replica Set** to support multi-document ACID transactions, featuring dual-layer authentication (JWT Token Rotation + Google OAuth2), role-based access control (RBAC), and automated event-driven email notifications.

---

## 🌐 Live Deployed Demo

A live deployment of this project is hosted on Render and MongoDB Atlas:

- **Swagger UI Documentation**: [https://dekon-intern-graduate-project.onrender.com/api/docs](https://dekon-intern-graduate-project.onrender.com/api/docs)
- **Health Check Endpoint**: [https://dekon-intern-graduate-project.onrender.com/health](https://dekon-intern-graduate-project.onrender.com/health)
  - **Expected Response**: `{ "data": { "status": "ok" } }` (HTTP 200 OK)
- **Pre-configured Accounts**: Test all features directly using the [Demo Accounts](#-demo-accounts-for-reviewer) listed below.

> [!NOTE]
> **Render Free Instance Spin-Down**:
> The free hosting tier spins down ("sleeps") after approximately 15 minutes of inactivity. When asleep, the first incoming request can take **30 to 60 seconds** to wake up the server (cold start).
> **Recommended Wake-Up Procedure**: Open `/health` first in your browser or terminal, wait for the `{ "data": { "status": "ok" } }` response, and then access the Swagger UI.

### Health Check Verification Commands:

- **Browser**: Navigate directly to `https://dekon-intern-graduate-project.onrender.com/health`

> [!WARNING]
> **Shared Production Data Notice**:
> The deployed live demo connects to a real shared MongoDB Atlas cluster. All operations (creating, editing, deleting items, updating profiles, placing orders) write directly to shared live database documents and will be visible to all reviewers.
>
> - **Do NOT delete the 3 demo accounts**.
> - **Do NOT change the passwords of the 3 demo accounts**.
> - For unrestricted testing, modifying roles, or destructive operations, please run the project locally via Docker Compose.

---

## 📑 Table of Contents

1. [Live Deployed Demo](#-live-deployed-demo)
2. [Data Scope & Impact: Local vs. Deployed](#-data-scope--impact-local-vs-deployed)
3. [Core Features](#-core-features)
4. [Tech Stack](#-tech-stack)
5. [Demo Accounts for Reviewer](#-demo-accounts-for-reviewer)
6. [Environment Variables (.env)](#-environment-variables-env)
7. [Configuration Keys Setup Guide](#-configuration-keys-setup-guide)
   - [C1. Google Client ID & Client Secret](#c1-google-client-id--client-secret)
   - [C2. SMTP (Gmail App Password)](#c2-smtp-gmail-app-password)
   - [C3. Cryptographic Secrets (SESSION, JWT, ORDER)](#c3-cryptographic-secrets-session-jwt-order)
8. [Installation & Setup Guide](#-installation--setup-guide)
   - [Method 1: Local Setup with Docker Compose](#method-1-local-setup-with-docker-compose)
   - [Method 2: Direct Access via Render Live Deployment (Recommended)](#method-2-direct-access-via-render-live-deployment-recommended)
9. [API Documentation (Swagger UI)](#-api-documentation-swagger-ui)
10. [API Endpoints Reference](#-api-endpoints-reference)
11. [Automated Testing & Code Coverage](#-automated-testing--code-coverage)
12. [Project Directory Structure](#-project-directory-structure)
13. [Git Commit Conventions](#-git-commit-conventions)

---

## 🎯 Data Scope & Impact: Local vs. Deployed

| Dimension                        | Local (Docker Compose)                                          | Live Deployment (Render + Atlas)                  |
| -------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| **Host Environment**             | Local Docker engine on your machine                             | Render Web Service                                |
| **Database Engine**              | Containerized MongoDB 7.0 (`dekon-mongodb`)                     | Shared MongoDB Atlas Cloud Cluster                |
| **Data Isolation**               | **Completely Isolated**: private to your local machine          | **Shared**: shared among all reviewers            |
| **Resetting Data**               | Run `docker compose down -v` to reset cleanly to seed dump      | Manual database restore (restricted)              |
| **Mongo Express GUI**            | **Available** at `http://localhost:8081`                        | **Disabled** (Not exposed for security)           |
| **Impact on Other Environments** | **Zero Impact**: Local changes never affect the live deployment | Modifications persist on the shared live database |

---

## 🚀 Core Features

- **Authentication & Authorization**:
  - Secure registration and login with BCrypt password hashing.
  - Dual-layer token system: short-lived **JWT Access Token** (default 15 minutes) and **Refresh Token Rotation** (hashed via SHA-256 in the database, tracked with unique `familyId` to detect and invalidate compromised token families upon reuse).
  - **Google OAuth2** integration (`passport-google-oauth20`) with **Account Linking**: detects existing local accounts with the same email and issues a temporary link token requiring password verification before merging accounts.
  - Role-Based Access Control (RBAC): `customer`, `staff`, `admin`.
- **Category & Product Management**:
  - Offset-based pagination (`page`, `itemsPerPage`), case-insensitive regex search, and category filtering.
  - Multi-image upload (1 to 5 images, `.jpg`, `.jpeg`, `.png`, maximum 5MB each) with binary magic byte validation via `file-type`.
  - Automatic disk cleanup via custom filter/interceptor to remove uploaded files if a transaction or validation fails.
  - Automated price history tracking (`priceHistory`) recording price updates, timestamps, and the administrator responsible.
- **Order Processing & Inventory Management**:
  - Resilient checkout protected by **MongoDB ACID Transactions**: verifies inventory, reserves stock, and rolls back atomically on failure.
  - Strict Order State Machine: `PENDING` -> `CONFIRMED` / `CANCELLED` -> `SHIPPING` -> `COMPLETED`.
  - Cryptographically signed email confirmation/cancellation links (`ORDER_TOKEN_SECRET`). Automatic inventory restoration when an order is cancelled.
  - Secure payment status and shipping address updates (permitted only when orders are in `PENDING` or `CONFIRMED` status).
- **Automated Mailer System**:
  - Built on `@nestjs-modules/mailer` utilizing the **Pug** template engine.
  - Automated transactional emails for all order milestones: confirmation requests, approval notices, payment receipts, shipping updates, completions, cancellations, and address adjustments.
- **Security & Observability**:
  - DDoS and brute-force prevention with `@nestjs/throttler` (5 req/min on authentication routes, 10 req/min globally, with `trust proxy` configured).
  - Structured JSON logging for production through `nestjs-pino`, masking sensitive headers (`Authorization`, `Cookie`).
  - Standardized API envelope via `TransformInterceptor` (`{ data: ... }`) and centralized exception logging via `CatchEverythingFilter`.

---

## 🛠 Tech Stack

- **Framework**: [NestJS](https://nestjs.com/)
- **Language**: TypeScript 5.7
- **Database**: MongoDB 7.0 (Mongoose 9.x, Single-Node Replica Set `rs0` for multi-document ACID transactions)
- **API Documentation**: `@nestjs/swagger` v11.x (Swagger UI at `/api/docs`)
- **Logging**: `nestjs-pino`, `pino-pretty`
- **Email Engine**: `@nestjs-modules/mailer`, `nodemailer`, `pug`
- **Containerization**: Docker, Docker Compose (Multi-stage build)

---

## 👥 Demo Accounts for Reviewer

The pre-loaded database contains 3 accounts representing the system's role hierarchy:

| Role         | Email                | Password          | Primary Permissions                                              |
| ------------ | -------------------- | ----------------- | ---------------------------------------------------------------- |
| **Admin**    | `admin@dekon.com`    | `Admin@123456`    | Full access: Categories, Products, Users, Roles, Orders          |
| **Staff**    | `staff@dekon.com`    | `Staff@123456`    | Operations: Order status, Payment status, View users             |
| **Customer** | `customer@dekon.com` | `Customer@123456` | Customer actions: Create orders, View own orders, Manage profile |

> [!NOTE]
> The demo accounts above use dummy email addresses and cannot receive real emails. To test actual transactional emails (order confirmation, cancellation, address changes), register a new account with your personal email address via `POST /auth/register` or `GET /auth/google`. **To receive real emails, make sure SMTP is configured as described in the [Configuration Keys Setup Guide](#-configuration-keys-setup-guide).**

---

## 🔑 Environment Variables (.env)

| Variable Name                | Description                                                         | Default / Sample Value                                               |
| ---------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `PORT`                       | API server port                                                     | `3000`                                                               |
| `NODE_ENV`                   | Environment mode (`development` / `production`)                     | `development`                                                        |
| `LOG_PRETTY`                 | Enable colored pino-pretty log formatting in development            | `true`                                                               |
| `MONGODB_URI`                | MongoDB connection string (Replica Set required for transactions)   | `mongodb://localhost:27017/ecommerce_api_application?replicaSet=rs0` |
| `SESSION_SECRET`             | Secret key for encrypting session cookies                           | `demo-session-secret`                                                |
| `JWT_SECRET`                 | Secret key for signing Access Tokens                                | `demo-jwt-secret`                                                    |
| `JWT_EXPIRES_IN`             | Access Token expiration lifetime                                    | `15m`                                                                |
| `REFRESH_TOKEN_EXPIRES_DAYS` | Refresh Token expiration lifetime (days)                            | `7`                                                                  |
| `ORDER_TOKEN_SECRET`         | Secret key for signing order confirmation/cancellation email tokens | `demo-order-token-secret`                                            |
| `FRONTEND_URL`               | Frontend URL for building order confirmation links in emails        | `http://localhost:3000` (or `http://localhost:5173`)                 |
| `GOOGLE_CLIENT_ID`           | Google OAuth2 Client ID                                             | `your_client_id.apps.googleusercontent.com`                          |
| `GOOGLE_CLIENT_SECRET`       | Google OAuth2 Client Secret                                         | `your_google_client_secret`                                          |
| `GOOGLE_CALLBACK_URL`        | Google OAuth2 authorized callback redirect URI                      | `http://localhost:3000/auth/google/callback`                         |
| `SMTP_HOST`                  | SMTP server hostname                                                | `smtp.gmail.com`                                                     |
| `SMTP_PORT`                  | SMTP port (`587` for STARTTLS, `465` for SSL)                       | `587`                                                                |
| `SMTP_USER`                  | Email account username for outgoing mail                            | `your_email@gmail.com`                                               |
| `SMTP_PASS`                  | Google App Password (16 characters)                                 | `your_app_password`                                                  |
| `SMTP_FROM`                  | Sender display name and email address                               | `"My Shop <your_email@gmail.com>"`                                   |
| `SHOP_NAME`                  | Store name rendered in email templates and subjects                 | `My Shop`                                                            |

> [!NOTE]
>
> - **Docker Compose Override**: In `docker-compose.yaml`, `MONGODB_URI` is hardcoded to connect to the internal container (`mongodb://mongo:27017/...`).
> - **NODE_ENV in Local Mode**: Do **NOT** set `NODE_ENV=production` when running locally over plain HTTP.

---

## 🔐 Configuration Keys Setup Guide

You need to create a custom `.env` file when you want to enable **real Google OAuth login** and **real email delivery via SMTP**. Without these credentials, Google OAuth will return an `invalid_client` error and outgoing emails will fail, while all other API features remain fully operational.

### C1. Google Client ID & Client Secret

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project.
2. Go to **APIs & Services** > **OAuth consent screen**:
   - User Type: Select **External**.
   - Fill in **App name** and **User support email**.
   - Under **Test users**, add every email address you plan to use for testing (while the app is in "Testing" mode, accounts not on this list will be rejected with an `access_denied` error).
3. Go to **APIs & Services** > **Credentials** > click **Create Credentials** > select **OAuth client ID**:
   - Application type: Select **Web application**.
4. Under **Authorized redirect URIs**, add both:
   - Local: `http://localhost:3000/auth/google/callback`
   - Live Demo: `https://dekon-intern-graduate-project.onrender.com/auth/google/callback`
     _(Must match `GOOGLE_CALLBACK_URL` character-for-character with no trailing slash)._
5. **Authorized JavaScript origins**: Leave blank (this API handles authentication via server-side redirection).
6. Click **Create**, then copy the generated **Client ID** and **Client Secret** into your `.env`:
   ```env
   GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```
7. **Common Google OAuth Errors**:

| Error Code              | Root Cause                                                             | Solution                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `redirect_uri_mismatch` | The callback URL in the request does not match the Google Console list | Ensure `GOOGLE_CALLBACK_URL` exactly matches the URI registered in Google Console (character-for-character). |
| `access_denied`         | The signing-in account is not registered under Test Users              | Add the email to **OAuth consent screen** > **Test users** in Google Cloud Console.                          |
| `invalid_client`        | Missing, incorrect, or mismatched Client ID / Client Secret            | Verify that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` are accurate.                            |

---

### C2. SMTP (Gmail App Password)

1. Enable **2-Step Verification** on your Google Account at [Google Account Security](https://myaccount.google.com/security).
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords):
   - Enter an App name (e.g., `Dekon E-Commerce API`).
   - Click **Create**, then copy the generated 16-character password (remove all spaces).
3. Populate the variables in `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=abcdefghijklmnop
   SMTP_FROM="My Shop <your_email@gmail.com>"
   SHOP_NAME="My Shop"
   ```
4. **Important Tips**:
   - Use a secondary Gmail account specifically dedicated to testing rather than your personal primary email.
   - **Error `535 Authentication Failed`**: The App Password contains extra spaces or was mistyped.
   - If the "App passwords" menu does not appear, ensure 2-Step Verification is enabled, or check if your Google Workspace account administrator has restricted App Passwords.

---

### C3. Cryptographic Secrets (SESSION, JWT, ORDER)

Generate unique, high-entropy random strings (at least 32 bytes / 64 hex characters) for each secret:

- **macOS / Linux / Git Bash**:
  ```bash
  openssl rand -hex 32
  ```
- **PowerShell**:
  ```powershell
  [Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
  ```
- **Node.js (Cross-Platform)**:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

> [!CAUTION]
> Assign distinct random values to `SESSION_SECRET`, `JWT_SECRET`, and `ORDER_TOKEN_SECRET`. Never reuse demo strings in production environments.

---

## 📦 Installation & Setup Guide

> [!IMPORTANT]
> To run the project locally and enable **Google OAuth login** and **transactional email notifications (SMTP)**, you must create a `.env` file (based on `.env.example`) and supply your own credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SMTP_USER`, `SMTP_PASS`, etc.) as guided in [Configuration Keys Setup Guide](#-configuration-keys-setup-guide). Without these keys, Google OAuth and email delivery cannot be performed.

### Method 1: Local Setup with Docker Compose

This method runs the full application stack locally using Docker. It automatically spins up a MongoDB Replica Set, imports seed data, builds the NestJS API, and provides the Mongo Express management GUI.

1. **Prepare Environment File**:
   Create a `.env` file at the project root based on `.env.example` and add your Google OAuth and SMTP keys:

   ```bash
   cp .env.example .env
   ```

2. **Start All Services**:

   ```bash
   docker compose up -d --build
   ```

3. **Available Service Endpoints**:
   - **Backend API**: `http://localhost:3000`
   - **Swagger Documentation**: `http://localhost:3000/api/docs`
   - **Mongo Express Web GUI**: `http://localhost:8081` (Inspect `users`, `products`, `categories`, `orders`)
   - **MongoDB Replica Set**: `localhost:27017`

4. **Automated Seed Data Loading**:
   The `mongo-init` container automatically checks if documents exist in the database. If empty, it restores categories, products, and user accounts from `seed-dump/ecommerce_api_application/` using `mongorestore`.

5. **Shutdown Services**:
   ```bash
   docker compose down
   # To completely wipe the database volume and re-seed from scratch:
   docker compose down -v
   ```

---

### Method 2: Direct Access via Render Live Deployment (Recommended)

This is the **recommended** and fastest method to review and test the project, requiring zero local installation or configuration:

1. **Open Live Swagger UI**:
   Navigate directly to **[https://dekon-intern-graduate-project.onrender.com/api/docs](https://dekon-intern-graduate-project.onrender.com/api/docs)**.

2. **Instant Testing**:
   - The cloud service is fully pre-configured with MongoDB Atlas, OAuth, and mailer services.
   - Use the pre-loaded [Demo Accounts](#-demo-accounts-for-reviewer) (`Admin`, `Staff`, `Customer`) to authenticate and test all endpoints immediately.
   - If the service is asleep, call the [Health Check](https://dekon-intern-graduate-project.onrender.com/health) endpoint once to wake it up.

---

## 📖 API Documentation (Swagger UI)

With the application running, visit the interactive OpenAPI documentation:
👉 **`http://localhost:3000/api/docs`** (Local) or **[Render Live Swagger](https://dekon-intern-graduate-project.onrender.com/api/docs)**

### Testing Protected Endpoints on Swagger UI:

1. Open the **Auth** section and click `POST /auth/login`.
2. Click **Try it out** -> **Execute** (pre-populated with Admin account `admin@dekon.com`).
3. Copy the `accessToken` string from the response JSON.
4. Click the **Authorize 🔓** button in the top right corner.
5. Paste the token into the `Value` field (no need to type `Bearer `) and click **Authorize**.
6. You can now test any Admin, Staff, or Customer endpoints directly.

---

## 🛣 API Endpoints Reference

All successful responses are wrapped in a standard JSON response envelope:

```json
{
  "data": { ... }
}
```

### 1. Authentication (`/auth`)

| Method | Path                        | Access Role    | Description                                                      |
| ------ | --------------------------- | -------------- | ---------------------------------------------------------------- |
| `POST` | `/auth/register`            | Public (Guest) | Register a new customer account                                  |
| `POST` | `/auth/login`               | Public (Guest) | Authenticate with email and password                             |
| `POST` | `/auth/refresh`             | Public (Guest) | Refresh token rotation with reuse detection                      |
| `POST` | `/auth/logout`              | Authenticated  | Revoke refresh token                                             |
| `GET`  | `/auth/profile`             | Authenticated  | Retrieve current user profile from JWT payload                   |
| `GET`  | `/auth/google`              | Public         | Initiate Google OAuth2 login flow (302 Redirect)                 |
| `GET`  | `/auth/google/callback`     | Public         | Handle Google OAuth2 callback                                    |
| `POST` | `/auth/google/confirm-link` | Public         | Confirm account linking using temporary token and local password |

### 2. User Management (`/user`)

| Method   | Path               | Access Role      | Description                                 |
| -------- | ------------------ | ---------------- | ------------------------------------------- |
| `POST`   | `/user`            | `admin`          | Create new user account with specified role |
| `GET`    | `/user`            | `admin`, `staff` | Retrieve all user accounts                  |
| `GET`    | `/user/:id`        | `admin`, `staff` | Retrieve user details by ID                 |
| `PATCH`  | `/user/updateInfo` | Authenticated    | User self-updates name, email, or password  |
| `PATCH`  | `/user/:id`        | `admin`          | Admin updates role for another user         |
| `DELETE` | `/user/:id`        | `admin`          | Admin deletes user account                  |

### 3. Category Management (`/category`)

| Method   | Path            | Access Role | Description                 |
| -------- | --------------- | ----------- | --------------------------- |
| `POST`   | `/category`     | `admin`     | Create new product category |
| `GET`    | `/category`     | Public      | List all categories         |
| `GET`    | `/category/:id` | Public      | Get category details by ID  |
| `PATCH`  | `/category/:id` | `admin`     | Update category information |
| `DELETE` | `/category/:id` | `admin`     | Delete category             |

### 4. Product Management (`/product`)

| Method   | Path           | Access Role | Description                                                                    |
| -------- | -------------- | ----------- | ------------------------------------------------------------------------------ |
| `POST`   | `/product`     | `admin`     | Create product with 1 to 5 images (`multipart/form-data`)                      |
| `GET`    | `/product`     | Public      | List paginated products (query `page`, `itemsPerPage`, `search`, `categoryId`) |
| `GET`    | `/product/:id` | Public      | Get product details with price history (`priceHistory`)                        |
| `PATCH`  | `/product/:id` | `admin`     | Update product information, price, and images                                  |
| `DELETE` | `/product/:id` | `admin`     | Delete product and clean up image files on disk                                |

### 5. Order Management (`/order`)

| Method  | Path                             | Access Role      | Description                                                                             |
| ------- | -------------------------------- | ---------------- | --------------------------------------------------------------------------------------- |
| `POST`  | `/order`                         | Authenticated    | Place order in transaction: verify stock, reserve inventory, trigger confirmation email |
| `POST`  | `/order/confirm`                 | Authenticated    | Confirm order via email verification token (`PENDING` -> `CONFIRMED`)                   |
| `POST`  | `/order/cancel`                  | Authenticated    | Cancel order via email token and restore reserved inventory                             |
| `GET`   | `/order`                         | `admin`, `staff` | List all orders with pagination and filtering                                           |
| `GET`   | `/order/byCustomer`              | Authenticated    | Customer retrieves their own order history                                              |
| `GET`   | `/order/:id`                     | Authenticated    | Retrieve order details (Order owner, Admin, or Staff)                                   |
| `PATCH` | `/order/updatePaymentStatus/:id` | `admin`, `staff` | Mark order payment as `paid` and send confirmation email                                |
| `PATCH` | `/order/:id`                     | `admin`, `staff` | Advance order status through State Machine and trigger email                            |
| `PATCH` | `/order/shippingAddress/:id`     | Authenticated    | Customer updates shipping address (when `PENDING` or `CONFIRMED`)                       |

---

## 🧪 Automated Testing & Code Coverage

### Running Tests:

```bash
# Run all unit tests
npm test

# Run tests and output coverage report
npm run test:cov

# Run tests in watch mode
npm run test:watch
```

### Actual Code Coverage Results:

The codebase maintains rigorous unit test coverage across all business logic layers (**Core Services and Controllers achieve 91% to 100% line coverage**):

| Metric          | Achieved Rate |          Details           |
| --------------- | :-----------: | :------------------------: |
| **Statements**  |  **79.97%**   |   1098 / 1373 statements   |
| **Branches**    |  **74.02%**   |     510 / 689 branches     |
| **Functions**   |  **73.98%**   |    128 / 173 functions     |
| **Lines**       |  **80.98%**   |     1022 / 1262 lines      |
| **Test Suites** | **100% PASS** |  **11 passed / 11 total**  |
| **Total Tests** | **100% PASS** | **276 passed / 276 total** |

#### Detailed Service & Controller Metrics:

- `auth.service.ts`: **100% lines** (93.33% branch)
- `auth.controller.ts`: **100% lines**
- `user.service.ts`: **98.83% lines** (93.75% branch)
- `user.controller.ts`: **100% lines**
- `product.service.ts`: **100% lines** (95.58% branch)
- `product.controller.ts`: **97.36% lines**
- `order.service.ts`: **96.7% lines** (83.51% branch)
- `order.controller.ts`: **100% lines**
- `category.service.ts`: **91.3% lines**
- `category.controller.ts`: **100% lines**

---

## 📁 Project Directory Structure

```text
├── seed-dump/                    # Pre-packaged BSON seed data (categories, products, users)
│   └── ecommerce_api_application/
├── src/
│   ├── auth/                     # Authentication module (JWT rotation, Google OAuth, Link account)
│   ├── category/                 # Product category management
│   ├── decorator/                # Custom decorators (@Roles, @Public, @ApiOkData, ...)
│   ├── dto/                      # Data Transfer Objects with validation & Swagger annotations
│   ├── enum/                     # System enums (Roles, OrderStatus, PaymentMethod, Providers)
│   ├── filter/                   # Global Exception Filters and upload cleanup filters
│   ├── guard/                    # AuthGuard and RolesGuard
│   ├── helpers/                  # Multer disk storage and Mongoose toJSON transform helpers
│   ├── interceptor/              # TransformInterceptor ({ data: ... })
│   ├── order/                    # Order module, ACID transactions, and State Machine
│   ├── pipe/                     # ValidateObjectIdPipe, ValidateImageFilesPipe
│   ├── product/                  # Product module, multi-image uploads, price history
│   ├── pug/                      # Pug HTML email notification templates
│   ├── refresh-token/            # RefreshToken schema and module
│   ├── schemas/                  # Mongoose Schemas (User, Product, Order, Category, ...)
│   ├── service/                  # Password hashing (bcrypt) and token hashing (sha256)
│   ├── strategies/               # Passport Google Strategy
│   ├── user/                     # User management module
│   ├── app.module.ts             # Root application module (Mailer, Pino, Throttler, Mongoose)
│   └── main.ts                   # Application bootstrap (Swagger, Session, Validation)
├── test/                         # E2E test files
├── uploads/images/               # Local disk storage directory for uploaded product images
├── docker-compose.yaml           # Multi-container Docker configuration (MongoDB, API, Mongo Express)
├── Dockerfile                    # Production multi-stage Docker build
└── package.json                  # Dependencies and execution scripts
```

---

## 📝 Git Commit Conventions

This project strictly adheres to the **Conventional Commits** specification. Examples from the git history:

- `feat`: New features (e.g., `feat: Add Docker support with Dockerfile and docker-compose configuration`, `feat: prepare seed data and local database for reviewer`).
- `fix`: Bug fixes (e.g., `fix: improve value transformation logic in CreateProductDto`, `fix: sort items by createdAt and _id in findAll methods`).
- `test`: Unit and integration testing (e.g., `test: implement unit testing for Order module`, `test: implement Unit testing for Category and Product module`).
- `chore`: Tooling and maintenance (e.g., `chore: fix lint warnings and format code`, `chore: add .env.example with required environment variables`).
