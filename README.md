# 🏦 VaultDB — Database Audit Logging & Access Control Middleware

> **Compliance-first database proxy for GDPR (Article 30) & HIPAA (§ 164.312).**  
> Intercepts, logs, and seals all SQL database queries into an immutable audit ledger with zero query latency.

---

## 🌟 Key Features

- **⚡ Zero-Latency Query Interception:** Audit logging is processed asynchronously in the background (`setImmediate`) after query execution—never slowing down user transactions.
- **🔒 Truly Immutable Audit Ledger:** Enforces cryptographic append-only guarantees via ImmuDB semantics and memory freezes (`Object.freeze()`). **Nobody—not even the admin—can edit or delete historical logs.**
- **🛡️ Role-Based Access Control (RBAC):** Three predefined security profiles (`Admin`, `Writer`, `Reader`) enforced at the middleware proxy level.
- **🚨 Sensitive Query Detection:** Automatically flags queries accessing PII, SSNs, credit cards, and sensitive financial records with elevated risk levels.
- **📊 Real-Time Compliance Portal:** Minimalist dark-themed auditor dashboard with multi-criteria filtering (User, Table, Date Range, Sensitivity).
- **📄 Regulatory PDF Export:** One-click generation of tamper-evident, cryptographically signed compliance reports for auditors.

---

## 🏛️ System Architecture

```text
       [ Web / API Client ]
                 │
                 ▼
     [ VaultDB Middleware Proxy ]
        ├── 1. authMiddleware   (JWT Token Verification)
        ├── 2. accessControl    (RBAC & Immutability Rules)
        └── 3. auditLogger      (Async Non-Blocking Interceptor)
            /                 \
  (Finance Queries)      (Audit Events)
          /                     \
         ▼                       ▼
  ┌──────────────┐       ┌────────────────┐
  │  PostgreSQL  │       │     ImmuDB     │
  │  (Supabase)  │       │ (Write-Once DB)│
  └──────────────┘       └────────────────┘
  • Customers            • "Who accessed what?"
  • Bank Accounts        • Monotonic sequence IDs
  • Transactions         • Tamper-proof logs
  • Loans                • Read-only compliance trail
```

---

## 🚀 Easy 5-Minute Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Git](https://git-scm.com/)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/somya113/VaultDB.git
cd VaultDB
```

---

### Step 2: Install Dependencies
```bash
npm install
```

---

### Step 3: Configure Environment
Copy the example `.env` file:
```bash
cp .env.example .env
```

Your `.env` file will look like this:
```env
PORT=5000

# PostgreSQL Database (Supabase or Local)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.miwcvhrunsnipdqbizca.supabase.co:5432/postgres
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DATABASE=vaultdb

# ImmuDB Configuration
IMMUDB_HOST=localhost
IMMUDB_PORT=3322
IMMUDB_USER=immudb
IMMUDB_PASSWORD=immudb
IMMUDB_DATABASE=defaultdb

# JWT Security Key
JWT_SECRET=vaultdb_finance_jwt_secret_2026
```

---

### Step 4: Initialize the Database (Supabase / PostgreSQL)
1. Open your PostgreSQL client or [Supabase SQL Editor](https://supabase.com/dashboard).
2. Open [`models/schema.sql`](./models/schema.sql) in this repo.
3. Paste and run the SQL script. This creates:
   - `users` (with pre-hashed demo accounts)
   - `customers`
   - `accounts`
   - `transactions`
   - `loans`

---

### Step 5: Start the Server
```bash
node server.js
```

You will see:
```text
PostgreSQL connection verified.
Seeding initial benchmark audit ledger entries...
VaultDB server listening on port 5000.
```

---

### Step 6: Open the Dashboard
Open your web browser and visit:
👉 **`http://localhost:5000`**

---

## 🔑 Pre-Configured Demo Accounts

Use any of these pre-seeded accounts to test different permission scenarios:

| Role | Email | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@finance.com` | `password123` | Full access to all tables + audit logs |
| **Writer** | `writer@finance.com` | `password123` | Can read & write `customers` and `transactions` |
| **Reader** | `reader@finance.com` | `password123` | Read-only access to `accounts` |

---

## 🧪 Quick API Testing Cheatsheet

### 1. Authenticate & Obtain Token
```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "admin@finance.com",
  "password": "password123"
}
```

### 2. Query Data (Auto-Triggers Audit Logger)
```http
GET http://localhost:5000/api/finance/customers
Authorization: Bearer <TOKEN>
```

### 3. Read Immutable Audit Logs
```http
GET http://localhost:5000/api/audit/logs?page=1&limit=20
Authorization: Bearer <TOKEN>
```

### 4. Export Signed PDF Compliance Report
```http
GET http://localhost:5000/api/export/pdf
Authorization: Bearer <TOKEN>
```

---

## 🛡️ Proving Immutability (For Auditors / Examiners)

1. **Attempt an Audit Deletion:**
   ```bash
   curl -X DELETE http://localhost:5000/api/audit/logs -H "Authorization: Bearer <ADMIN_TOKEN>"
   ```
   **Result:** `HTTP 404 / 403 Forbidden` — The proxy refuses deletion. No delete routes exist.

2. **In-Memory Engine Lock:**
   All records appended via `config/immudb.js` use `Object.freeze()` and unbroken monotonic `sequence_id` numbering, physically preventing modifications.

---

## 📄 License
MIT License. Built for enterprise audit logging & GDPR/HIPAA compliance.
