# E-Commerce RESTful API Backend

Dự án Backend xây dựng hệ thống API cho nền tảng thương mại điện tử (E-commerce), phục vụ đồ án tốt nghiệp thực tập tại DEKON. Hệ thống được phát triển trên nền tảng **NestJS** kết hợp cơ sở dữ liệu **MongoDB Replica Set** hỗ trợ ACID Transaction, cơ chế xác thực kép (JWT Token Rotation + Google OAuth2), phân quyền RBAC và hệ thống thông báo email tự động.

---

## 📑 Mục lục

1. [Tính năng cốt lõi](#-tính-năng-cốt-lõi)
2. [Ngăn xếp công nghệ (Tech Stack)](#-ngăn-xếp-công-nghệ-tech-stack)
3. [Tài khoản Demo cho Người đánh giá (Reviewer)](#-tài-khoản-demo-cho-người-đánh-giá-reviewer)
4. [Cấu hình biến môi trường (.env)](#-cấu-hình-biến-môi-trường-env)
5. [Hướng dẫn cài đặt & Khởi chạy](#-hướng-dẫn-cài-đặt--khởi-chạy)
   - [Cách 1: Khởi chạy bằng Docker Compose (Khuyên dùng)](#cách-1-khởi-chạy-bằng-docker-compose-khuyên-dùng)
   - [Cách 2: Khởi chạy thủ công trên môi trường nội bộ (Local)](#cách-2-khởi-chạy-thủ-công-trên-môi-trường-nội-bộ-local)
6. [Tài liệu API (Swagger UI)](#-tài-liệu-api-swagger-ui)
7. [Danh mục API Endpoints](#-danh-mục-api-endpoints)
8. [Kiểm thử tự động & Độ phủ mã nguồn (Testing & Coverage)](#-kiểm-thử-tự-động--độ-phủ-mã-nguồn-testing--coverage)
9. [Cấu trúc thư mục dự án](#-cấu-trúc-thư-mục-dự-án)
10. [Quy ước Commit (Git Conventional Commits)](#-quy-ước-commit-git-conventional-commits)

---

## 🚀 Tính năng cốt lõi

- **Authentication & Authorization**:
  - Đăng ký, đăng nhập tài khoản chuẩn mật khẩu (băm BCrypt).
  - Xác thực hai lớp với **JWT Access Token** (thời hạn ngắn, mặc định 15 phút) và **Refresh Token Rotation** (lưu SHA-256 hash trong database, quản lý theo Family ID để phát hiện và ngăn chặn hành vi sử dụng lại token đã thu hồi).
  - Đăng nhập qua **Google OAuth2** (`passport-google-oauth20`) và cơ chế **Account Linking**: phát hiện email đã tồn tại và yêu cầu xác nhận mật khẩu tài khoản local trước khi hợp nhất.
  - Phân quyền theo vai trò (Role-Based Access Control - RBAC): `customer`, `staff`, `admin`.
- **Quản lý danh mục & Sản phẩm (Category & Product)**:
  - Phân trang dạng offset (`page`, `itemsPerPage`), tìm kiếm không phân biệt hoa thường và lọc theo danh mục.
  - Upload đa ảnh (tối đa 5 ảnh, định dạng `.jpg`, `.jpeg`, `.png`, dung lượng ≤ 5MB), xác thực nội dung nhị phân (magic bytes) qua thư viện `file-type`.
  - Tự động dọn dẹp (unlink) các file ảnh tạm nếu quá trình tạo/cập nhật sản phẩm gặp lỗi.
  - Tự động ghi vết lịch sử biến động giá (`priceHistory`) mỗi khi cập nhật giá sản phẩm.
- **Quản lý đơn hàng (Order Processing)**:
  - Đặt hàng an toàn sử dụng **MongoDB ACID Transactions**: kiểm tra tồn kho, khóa và trừ số lượng sản phẩm tức thời, tự động rollback nếu hết hàng.
  - Vòng đời trạng thái đơn hàng (Order State Machine) chặt chẽ: `PENDING` -> `CONFIRMED` / `CANCELLED` -> `SHIPPING` -> `COMPLETED`.
  - Cơ chế xác nhận / hủy đơn hàng qua liên kết email bảo mật có ký số JWT (`ORDER_TOKEN_SECRET`). Tự động hoàn lại số lượng tồn kho khi đơn bị hủy.
  - Cập nhật trạng thái thanh toán và địa chỉ giao hàng (chỉ cho phép khi đơn ở trạng thái `PENDING` hoặc `CONFIRMED`).
- **Hệ thống gửi Email thông báo (Mailer Module)**:
  - Tích hợp `@nestjs-modules/mailer` với template engine **Pug**.
  - Tự động kích hoạt email trong toàn bộ chu trình đặt hàng: xác nhận đơn, đơn được duyệt, thanh toán thành công, đơn đang giao, đơn hoàn tất, đơn bị hủy, cập nhật địa chỉ giao hàng.
- **Bảo mật & Giám sát**:
  - Chặn tấn công brute-force / DDoS với `@nestjs/throttler` (giới hạn 5 req/phút cho các API auth nhạy cảm, 10 req/phút cho các API chung, kích hoạt `trust proxy`).
  - Ghi log có cấu trúc chuẩn JSON phục vụ production qua `nestjs-pino`, che giấu các header nhạy cảm (`Authorization`, `Cookie`).
  - Chuẩn hóa toàn bộ phản hồi trả về qua `TransformInterceptor` (`{ data: ... }`) và xử lý ngoại lệ tập trung qua `CatchEverythingFilter`.

---

## 🛠 Ngăn xếp công nghệ (Tech Stack)

- **Framework**: [NestJS](https://nestjs.com/) v11.x (Node.js runtime v22 / v24)
- **Ngôn ngữ**: TypeScript 5.7
- **Database**: MongoDB 7.0 (Mongoose 9.x, chạy ở chế độ Single-Node Replica Set `rs0` để hỗ trợ đa document transactions)
- **Session & Caching**: `express-session`, `connect-mongo`
- **Tài liệu API**: `@nestjs/swagger` v11.x (Swagger UI tại `/api/docs`)
- **Logging**: `nestjs-pino`, `pino-pretty`
- **Mail Engine**: `@nestjs-modules/mailer`, `nodemailer`, `pug`
- **Containerization**: Docker, Docker Compose (Multi-stage build)

---

## 👥 Tài khoản Demo cho Người đánh giá (Reviewer)

Cơ sở dữ liệu mẫu đi kèm dự án đã tạo sẵn 3 tài khoản đại diện cho 3 cấp độ phân quyền trong hệ thống:

| Vai trò (Role) | Email                | Mật khẩu          | Quyền hạn chính                                                                                         |
| -------------- | -------------------- | ----------------- | ------------------------------------------------------------------------------------------------------- |
| **Admin**      | `admin@dekon.com`    | `Admin@123456`    | Toàn quyền: Quản lý danh mục, Thêm/Sửa/Xóa sản phẩm, Quản lý tài khoản và phân quyền người dùng         |
| **Staff**      | `staff@dekon.com`    | `Staff@123456`    | Quản lý vận hành đơn hàng, Cập nhật trạng thái giao hàng, Cập nhật thanh toán, Xem danh sách người dùng |
| **Customer**   | `customer@dekon.com` | `Customer@123456` | Đặt hàng, Xem lịch sử đơn hàng cá nhân, Cập nhật địa chỉ nhận hàng, Tự chỉnh sửa thông tin cá nhân      |

> [!NOTE]
> Các tài khoản mẫu trên dùng địa chỉ email giả lập nên sẽ không nhận được email thật. Để kiểm tra tính năng gửi mail đơn hàng qua SMTP thực tế, vui lòng đăng ký một tài khoản mới bằng email cá nhân của bạn thông qua `POST /auth/register` hoặc `GET /auth/google`.

---

## 🔑 Cấu hình biến môi trường (.env)

Tạo file `.env` tại thư mục gốc của dự án dựa trên mẫu `.env.example`:

| Tên biến                     | Mô tả                                                                   | Giá trị mẫu / Mặc định                                               |
| ---------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `PORT`                       | Cổng dịch vụ API                                                        | `3000`                                                               |
| `NODE_ENV`                   | Môi trường triển khai (`development` / `production`)                    | `development`                                                        |
| `LOG_PRETTY`                 | Bật định dạng màu cho log Pino ở môi trường local                       | `true`                                                               |
| `MONGODB_URI`                | Chuỗi kết nối MongoDB (Bắt buộc hỗ trợ Replica Set để dùng Transaction) | `mongodb://localhost:27017/ecommerce_api_application?replicaSet=rs0` |
| `SESSION_SECRET`             | Khóa bí mật dùng cho phiên làm việc (Session)                           | `demo-session-secret`                                                |
| `JWT_SECRET`                 | Khóa bí mật ký Access Token                                             | `demo-jwt-secret`                                                    |
| `JWT_EXPIRES_IN`             | Thời hạn sống của Access Token                                          | `15m`                                                                |
| `REFRESH_TOKEN_EXPIRES_DAYS` | Số ngày sống của Refresh Token                                          | `7`                                                                  |
| `ORDER_TOKEN_SECRET`         | Khóa bí mật ký token xác nhận/hủy đơn hàng gửi qua email                | `demo-order-token-secret`                                            |
| `FRONTEND_URL`               | Địa chỉ frontend dùng tạo đường dẫn xác nhận đơn trong email            | `http://localhost:3000` (hoặc `http://localhost:5173`)               |
| `GOOGLE_CLIENT_ID`           | Client ID ứng dụng Google Cloud OAuth2                                  | `your_client_id.apps.googleusercontent.com`                          |
| `GOOGLE_CLIENT_SECRET`       | Client Secret ứng dụng Google Cloud OAuth2                              | `your_google_client_secret`                                          |
| `GOOGLE_CALLBACK_URL`        | URL chuyển hướng callback Google OAuth2                                 | `http://localhost:3000/auth/google/callback`                         |
| `SMTP_HOST`                  | Địa chỉ máy chủ SMTP gửi mail                                           | `smtp.gmail.com`                                                     |
| `SMTP_PORT`                  | Cổng máy chủ SMTP (587 cho STARTTLS, 465 cho SSL)                       | `587`                                                                |
| `SMTP_USER`                  | Email tài khoản gửi thư                                                 | `your_email@gmail.com`                                               |
| `SMTP_PASS`                  | Mật khẩu ứng dụng (Google App Password 16 ký tự)                        | `your_app_password`                                                  |
| `SMTP_FROM`                  | Tên và email hiển thị người gửi                                         | `"My Shop <your_email@gmail.com>"`                                   |
| `SHOP_NAME`                  | Tên cửa hàng hiển thị trong tiêu đề và nội dung email                   | `My Shop`                                                            |

---

## 📦 Hướng dẫn cài đặt & Khởi chạy

### Cách 1: Khởi chạy bằng Docker Compose (Khuyên dùng)

Đây là phương thức nhanh chóng và đồng bộ nhất. Hệ thống tự động cấu hình MongoDB Replica Set, nạp sẵn dữ liệu mẫu (seed data), khởi chạy API và cung cấp giao diện quản lý cơ sở dữ liệu Mongo Express.

1. **Khởi động toàn bộ cụm dịch vụ**:

   ```bash
   docker compose up -d --build
   ```

2. **Các dịch vụ được kích hoạt**:
   - **Backend API**: `http://localhost:3000`
   - **Swagger Documentation**: `http://localhost:3000/api/docs`
   - **Mongo Express Web GUI**: `http://localhost:8081` (Xem trực quan các bảng `users`, `products`, `categories`, `orders`)
   - **MongoDB Replica Set `rs0`**: `localhost:27017`

3. **Cơ chế nạp dữ liệu mẫu (Seed Data)**:
   Container `mongo-init` sẽ tự động phát hiện số lượng tài liệu trong database. Nếu cơ sở dữ liệu chưa có dữ liệu, container sẽ chạy lệnh `mongorestore` trực tiếp từ thư mục `seed-dump/ecommerce_api_application/` để nạp danh mục, sản phẩm và tài khoản mẫu.

4. **Dừng hệ thống**:
   ```bash
   docker compose down
   # Nếu muốn xóa sạch database để nạp lại từ đầu:
   docker compose down -v
   ```

---

### Cách 2: Khởi chạy thủ công trên môi trường nội bộ (Local)

#### Yêu cầu hệ thống:

- Node.js version 22.x hoặc 24.x
- MongoDB Server đang chạy ở chế độ **Replica Set** (bắt buộc để các lệnh Transaction trong đơn hàng và refresh token hoạt động).

#### Các bước thực hiện:

1. **Cài đặt thư viện phụ thuộc**:

   ```bash
   npm install
   ```

2. **Thiết lập file môi trường**:
   Sao chép `.env.example` thành `.env` và điền thông số kết nối cơ sở dữ liệu cùng tài khoản SMTP của bạn:

   ```bash
   cp .env.example .env
   ```

3. **Nạp dữ liệu mẫu vào MongoDB local**:
   Sử dụng công cụ `mongorestore` của MongoDB Database Tools để import thư mục dump có sẵn trong repo:

   ```bash
   mongorestore --uri="mongodb://localhost:27017/ecommerce_api_application?replicaSet=rs0" seed-dump/
   ```

4. **Khởi chạy ứng dụng**:
   ```bash
   # Chế độ phát triển (Watch mode)
   npm run start:dev

   # Chế độ biên dịch và chạy Production
   npm run build
   npm run start:prod
   ```

---

## 📖 Tài liệu API (Swagger UI)

Khi ứng dụng đang chạy, truy cập đường dẫn sau trên trình duyệt để kiểm thử trực quan:
👉 **`http://localhost:3000/api/docs`**

### Các bước xác thực trên Swagger UI:

1. Mở nhóm **Auth** -> chọn endpoint `POST /auth/login`.
2. Bấm **Try it out** -> **Execute** (Swagger đã điền sẵn tài khoản Admin `admin@dekon.com`).
3. Sao chép chuỗi `accessToken` nhận được trong phản hồi.
4. Nhấn nút **Authorize 🔓** ở góc trên cùng bên phải màn hình Swagger.
5. Dán token vào ô `Value` (không cần gõ thêm chữ `Bearer`) rồi nhấn **Authorize**.
6. Bây giờ bạn có thể thực hiện kiểm thử tất cả các API được bảo vệ bởi quyền Admin, Staff hoặc Customer.

---

## 🛣 Danh mục API Endpoints

Mọi phản hồi thành công từ API đều được bọc trong cấu trúc chuẩn:

```json
{
  "data": { ... }
}
```

### 1. Authentication (`/auth`)

| Method | Path                        | Quyền truy cập | Mô tả                                                          |
| ------ | --------------------------- | -------------- | -------------------------------------------------------------- |
| `POST` | `/auth/register`            | Public (Guest) | Đăng ký tài khoản customer mới                                 |
| `POST` | `/auth/login`               | Public (Guest) | Đăng nhập tài khoản local lấy access & refresh token           |
| `POST` | `/auth/refresh`             | Public (Guest) | Đổi mới token cặp (Token Rotation), phát hiện reuse token      |
| `POST` | `/auth/logout`              | Authenticated  | Thu hồi (revoke) refresh token hiện tại                        |
| `GET`  | `/auth/profile`             | Authenticated  | Lấy thông tin tài khoản đang đăng nhập từ JWT payload          |
| `GET`  | `/auth/google`              | Public         | Khởi động đăng nhập Google OAuth2 (Redirect 302)               |
| `GET`  | `/auth/google/callback`     | Public         | Tiếp nhận kết quả đăng nhập Google OAuth2                      |
| `POST` | `/auth/google/confirm-link` | Public         | Xác nhận liên kết tài khoản Google vào tài khoản local hiện có |

### 2. Quản lý người dùng (`/user`)

| Method   | Path               | Quyền truy cập   | Mô tả                                               |
| -------- | ------------------ | ---------------- | --------------------------------------------------- |
| `POST`   | `/user`            | `admin`          | Admin tạo tài khoản người dùng với vai trò tùy chọn |
| `GET`    | `/user`            | `admin`, `staff` | Lấy danh sách toàn bộ người dùng                    |
| `GET`    | `/user/:id`        | `admin`, `staff` | Lấy thông tin chi tiết người dùng theo ID           |
| `PATCH`  | `/user/updateInfo` | Authenticated    | Người dùng tự đổi họ tên, mật khẩu của chính mình   |
| `PATCH`  | `/user/:id`        | `admin`          | Admin cập nhật vai trò (Role) cho tài khoản khác    |
| `DELETE` | `/user/:id`        | `admin`          | Admin xóa người dùng                                |

### 3. Quản lý danh mục (`/category`)

| Method   | Path            | Quyền truy cập | Mô tả                           |
| -------- | --------------- | -------------- | ------------------------------- |
| `POST`   | `/category`     | `admin`        | Admin tạo mới danh mục sản phẩm |
| `GET`    | `/category`     | Public         | Lấy danh sách tất cả danh mục   |
| `GET`    | `/category/:id` | Public         | Lấy chi tiết một danh mục       |
| `PATCH`  | `/category/:id` | `admin`        | Cập nhật thông tin danh mục     |
| `DELETE` | `/category/:id` | `admin`        | Xóa danh mục                    |

### 4. Quản lý sản phẩm (`/product`)

| Method   | Path           | Quyền truy cập | Mô tả                                                                                    |
| -------- | -------------- | -------------- | ---------------------------------------------------------------------------------------- |
| `POST`   | `/product`     | `admin`        | Tạo sản phẩm kèm upload 1 - 5 ảnh (`multipart/form-data`)                                |
| `GET`    | `/product`     | Public         | Lấy danh sách sản phẩm phân trang (query `page`, `itemsPerPage`, `search`, `categoryId`) |
| `GET`    | `/product/:id` | Public         | Lấy thông tin chi tiết sản phẩm kèm lịch sử giá (`priceHistory`)                         |
| `PATCH`  | `/product/:id` | `admin`        | Cập nhật thông tin sản phẩm, cập nhật giá và thay đổi ảnh                                |
| `DELETE` | `/product/:id` | `admin`        | Xóa sản phẩm và dọn dẹp các tệp ảnh trên đĩa                                             |

### 5. Quản lý đơn hàng (`/order`)

| Method  | Path                             | Quyền truy cập   | Mô tả                                                                  |
| ------- | -------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| `POST`  | `/order`                         | Authenticated    | Đặt hàng trong Transaction: kiểm tra và trừ tồn kho, gửi mail xác nhận |
| `POST`  | `/order/confirm`                 | Authenticated    | Xác nhận đơn hàng qua token từ email (chuyển PENDING -> CONFIRMED)     |
| `POST`  | `/order/cancel`                  | Authenticated    | Hủy đơn hàng qua token từ email, hoàn lại tồn kho trong Transaction    |
| `GET`   | `/order`                         | `admin`, `staff` | Lấy danh sách đơn hàng có phân trang và bộ lọc                         |
| `GET`   | `/order/byCustomer`              | Authenticated    | Khách hàng lấy danh sách tất cả đơn hàng của mình                      |
| `GET`   | `/order/:id`                     | Authenticated    | Xem chi tiết đơn hàng (chỉ chủ đơn hoặc Admin/Staff)                   |
| `PATCH` | `/order/updatePaymentStatus/:id` | `admin`, `staff` | Cập nhật trạng thái thanh toán thành `paid`, gửi email thông báo       |
| `PATCH` | `/order/:id`                     | `admin`, `staff` | Cập nhật trạng thái đơn hàng theo luồng State Machine, gửi email       |
| `PATCH` | `/order/shippingAddress/:id`     | Authenticated    | Khách hàng đổi địa chỉ nhận hàng (chỉ khi đơn chưa giao)               |

---

## 🧪 Kiểm thử tự động & Độ phủ mã nguồn (Testing & Coverage)

### Chạy kiểm thử Unit Tests:

```bash
# Chạy toàn bộ Unit Tests
npm test

# Chạy kiểm thử và xuất báo cáo độ phủ mã nguồn (Coverage)
npm run test:cov

# Chạy kiểm thử ở chế độ theo dõi (Watch mode)
npm run test:watch
```

### Kết quả đo lường Coverage thực tế:

Dự án đạt độ phủ kiểm thử cao ở toàn bộ các tầng nghiệp vụ cốt lõi (**Services và Controllers đạt từ 91% đến 100% lines**):

| Tiêu chí đánh giá    | Tỷ lệ đạt được |     Chi tiết kiểm thử      |
| -------------------- | :------------: | :------------------------: |
| **Statements**       |   **79.97%**   |   1098 / 1373 statements   |
| **Branches**         |   **74.02%**   |     510 / 689 branches     |
| **Functions**        |   **73.98%**   |    128 / 173 functions     |
| **Lines**            |   **80.98%**   |     1022 / 1262 lines      |
| **Test Suites**      | **100% PASS**  |  **11 passed / 11 total**  |
| **Total Unit Tests** | **100% PASS**  | **276 passed / 276 total** |

#### Thống kê chi tiết theo tầng nghiệp vụ chính:

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

## 📁 Cấu trúc thư mục dự án

```text
├── seed-dump/                    # Dữ liệu BSON mẫu (categories, products, users)
│   └── ecommerce_api_application/
├── src/
│   ├── auth/                     # Module xác thực (JWT rotation, Google OAuth, Link account)
│   ├── category/                 # Module quản lý danh mục sản phẩm
│   ├── decorator/                # Custom decorators (@Roles, @Public, @ApiOkData, ...)
│   ├── dto/                      # Data Transfer Objects với class-validator & Swagger
│   ├── enum/                     # Định nghĩa hằng số (Role, Status, Payment, Provider)
│   ├── filter/                   # Exception Filters toàn cục & dọn dẹp file upload
│   ├── guard/                    # AuthGuard & RolesGuard
│   ├── helpers/                  # Cấu hình lưu trữ Multer & format toJSON Mongoose
│   ├── interceptor/              # TransformInterceptor ({ data: ... })
│   ├── order/                    # Module đơn hàng, Transaction và State Machine
│   ├── pipe/                     # ValidateObjectIdPipe, ValidateImageFilesPipe
│   ├── product/                  # Module sản phẩm, upload ảnh, lịch sử giá
│   ├── pug/                      # Template email định dạng HTML Pug
│   ├── refresh-token/            # Mongoose schema và module Refresh Token
│   ├── schemas/                  # Mongoose Schemas (User, Product, Order, Category, ...)
│   ├── service/                  # Tiện ích băm mật khẩu (bcrypt) và mã token (sha256)
│   ├── strategies/               # Passport Google Strategy
│   ├── user/                     # Module quản lý người dùng
│   ├── app.module.ts             # Root Module tích hợp Mailer, Pino, Throttler, Mongoose
│   └── main.ts                   # Điểm khởi động ứng dụng (Swagger, Session, Validation)
├── test/                         # E2E Test files
├── uploads/images/               # Thư mục lưu trữ hình ảnh sản phẩm được upload
├── docker-compose.yaml           # Cấu hình Multi-container Docker (MongoDB, API, Mongo Express)
├── Dockerfile                    # Multi-stage Docker build cho môi trường Production
└── package.json                  # Scripts và danh sách thư viện phụ thuộc
```

---

## 📝 Quy ước Commit (Git Conventional Commits)

Dự án tuân thủ nghiêm ngặt chuẩn **Conventional Commits** trong lịch sử phát triển Git. Các tiền tố chuẩn được áp dụng:

- `feat`: Thêm tính năng mới (vd: `feat: Add Docker support with Dockerfile and docker-compose configuration`, `feat: prepare seed data and local database for reviewer`).
- `fix`: Sửa lỗi logic hoặc xử lý dữ liệu (vd: `fix: improve value transformation logic in CreateProductDto`, `fix: sort items by createdAt and _id in findAll methods`).
- `test`: Viết thêm hoặc cập nhật bộ kiểm thử (vd: `test: implement unit testing for Order module`, `test: implement Unit testing for Category and Product module`).
- `chore`: Tinh chỉnh cấu hình, dọn dẹp mã nguồn (vd: `chore: fix lint warnings and format code`, `chore: add .env.example with required environment variables`).
