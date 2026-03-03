# 🚀 Mini Job Processing Platform

A production-ready background job processing platform built with NestJS, PostgreSQL, Redis, and BullMQ. Supports authentication, role-based authorization, job scheduling, rate limiting, retries, and idempotency.

---

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Features](#features)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Design Decisions & Tradeoffs](#design-decisions--tradeoffs)

---

## 🛠 Tech Stack

| Technology            | Purpose                                       |
| --------------------- | --------------------------------------------- |
| **NestJS**            | Backend framework (modular, TypeScript-first) |
| **TypeORM**           | ORM for PostgreSQL                            |
| **PostgreSQL** (Neon) | Primary database                              |
| **Redis** (Upstash)   | Queue storage & rate limiting                 |
| **BullMQ**            | Job queue management                          |
| **Passport + JWT**    | Authentication                                |
| **Swagger**           | API documentation                             |

---

## 🏗 Architecture

```
Client
  │
  ▼
NestJS API (REST)
  ├── AuthModule       → Register, Login, JWT
  ├── UserModule       → User CRUD
  ├── TaskModule       → Task management + BullMQ queue
  └── MockModule       → Simulated task processor
        │
        ▼
  ┌─────────────┐     ┌─────────────┐
  │ PostgreSQL  │     │    Redis    │
  │  (Neon)     │     │  (Upstash)  │
  │             │     │             │
  │ - users     │     │ - job queue │
  │ - tasks     │     │ - rate limit│
  └─────────────┘     └─────────────┘
        │
        ▼
  TaskWorker (BullMQ)
  - Picks jobs from queue
  - Simulates 2-5s processing
  - 25% failure rate
  - Retries with exponential backoff
  - Updates task status in DB
```

---

## ✨ Features

### Authentication & Authorization

- JWT-based authentication (15-60 min expiry)
- Two roles: `ADMIN` and `USER`
- `USER` can create tasks, view own tasks, cancel own pending tasks
- `ADMIN` can view all tasks, cancel any pending task, reprocess failed tasks, view metrics

### Task Management

- Create tasks with `type`, `priority`, `payload`
- Support for **delayed/scheduled** execution via `scheduled_at`
- Task states: `PENDING → PROCESSING → COMPLETED / FAILED / CANCELLED`
- Filter tasks by status, type, date range with pagination

### Background Processing

- Worker processes jobs asynchronously via BullMQ
- Simulates 2-5 second processing time
- ~25% simulated failure rate
- Retries up to 3 times with **exponential backoff** (1s, 2s, 4s)
- Failed jobs after 3 attempts moved to dead-letter queue

### Rate Limiting (Redis-based)

- `email` tasks: max **5 per minute** per user
- `report` tasks: max **2 per minute** per user
- Implemented via Redis `INCR` + `EXPIRE` commands

### Idempotency

- Duplicate requests with same `idempotency_key` return existing task
- Prevents double processing

### Metrics (Admin only)

- Total task count
- Counts grouped by status
- Average processing time (ms)

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL database (or [Neon](https://neon.tech) cloud)
- Redis instance (or [Upstash](https://upstash.com) cloud)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd mini-job-processing-platform

# Install dependencies
npm install
```

### Setup Environment Variables

```bash
cp env.example .env
# Fill in your values (see Environment Variables section)
```

### Run the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

### Access

- **API**: http://localhost:3001
- **Swagger Docs**: http://localhost:3001/api

---

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# Database (PostgreSQL / Neon)
DB_HOST=your-db-host
DB_PORT=5432
DB_USER=your-db-user
DB_PASS=your-db-password
DB_NAME=your-db-name

# Redis (Upstash)
REDIS_HOST=your-redis-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# JWT
JWT_SECRET=your-super-secret-key

# Server
PORT=3001
```

---

## 📡 API Endpoints

### Auth

| Method | Endpoint         | Description             | Auth |
| ------ | ---------------- | ----------------------- | ---- |
| POST   | `/auth/register` | Register new user       | ❌   |
| POST   | `/auth/login`    | Login and get JWT token | ❌   |

### Tasks

| Method | Endpoint            | Description               | Auth          |
| ------ | ------------------- | ------------------------- | ------------- |
| POST   | `/tasks`            | Create a new task         | ✅ USER       |
| GET    | `/tasks`            | List tasks (with filters) | ✅ USER/ADMIN |
| GET    | `/tasks/:id`        | Get task by ID            | ✅ USER/ADMIN |
| POST   | `/tasks/:id/cancel` | Cancel a pending task     | ✅ USER/ADMIN |
| GET    | `/tasks/metrics`    | Get platform metrics      | ✅ ADMIN only |

### Task Filters (GET /tasks)

| Query Param | Type   | Example                          |
| ----------- | ------ | -------------------------------- |
| `status`    | enum   | `PENDING`, `COMPLETED`, `FAILED` |
| `type`      | string | `email`, `report`                |
| `from`      | date   | `2026-03-01`                     |
| `to`        | date   | `2026-03-10`                     |
| `page`      | number | `1`                              |
| `limit`     | number | `10`                             |

### Create Task Example

```json
POST /tasks
Authorization: Bearer <token>

{
  "type": "email",
  "priority": "high",
  "payload": { "to": "user@example.com", "subject": "Hello" },
  "idempotency_key": "unique-key-001",
  "scheduled_at": "2026-03-04T10:00:00.000Z"
}
```

---

## 🧠 Design Decisions & Tradeoffs

### 1. BullMQ over raw Redis queues

**Decision**: Used BullMQ for job queue management.  
**Why**: BullMQ provides built-in retry logic, delayed jobs, concurrency control, and job events out of the box. Building this manually with raw Redis would require significant effort.  
**Tradeoff**: BullMQ requires Redis 5+. Older Redis versions are not supported.

### 2. Redis for Rate Limiting (not DB)

**Decision**: Rate limiting implemented via Redis `INCR` + `EXPIRE` instead of DB queries.  
**Why**: Redis operations are O(1) and much faster than DB queries. DB-based rate limiting would add latency on every task creation request.  
**Tradeoff**: If Redis goes down, rate limiting stops working (fails open).

### 3. TypeORM `synchronize: true` in Development

**Decision**: Used `synchronize: true` instead of migrations for development.  
**Why**: Faster development iteration - schema changes apply automatically.  
**Tradeoff**: Not safe for production. In production, proper migrations should be used with `synchronize: false`.

### 4. Idempotency via DB unique constraint

**Decision**: `idempotency_key` has a DB-level unique constraint.  
**Why**: Guarantees uniqueness at the database level even under concurrent requests.  
**Tradeoff**: Requires clients to generate and manage their own idempotency keys.

### 5. Simulated Worker in Same Process

**Decision**: Worker runs in the same NestJS process.  
**Why**: Simpler setup for MVP/demo purposes.  
**Tradeoff**: In production, workers should run as separate processes/containers for better scalability and fault isolation.

### 6. JWT Stateless Authentication

**Decision**: Stateless JWT tokens without refresh tokens.  
**Why**: Simple and sufficient for MVP. No need for token storage.  
**Tradeoff**: Tokens cannot be revoked before expiry. A token blacklist or refresh token mechanism would be needed for production.

### 7. Exponential Backoff for Retries

**Decision**: Retry failed jobs with exponential backoff (1s, 2s, 4s).  
**Why**: Prevents thundering herd problem - if a downstream service is struggling, immediate retries would make it worse.  
**Tradeoff**: Failed jobs take longer to complete (up to ~7 seconds total retry time).

---

## 📊 Task Status Flow

```
                    ┌─────────┐
         create     │         │
        ──────────► │ PENDING │
                    │         │
                    └────┬────┘
                         │ worker picks up
                         ▼
                    ┌─────────────┐
                    │             │
                    │ PROCESSING  │
                    │             │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │ success                 │ failure (after 3 retries)
              ▼                         ▼
        ┌───────────┐            ┌────────────┐
        │           │            │            │
        │ COMPLETED │            │   FAILED   │
        │           │            │            │
        └───────────┘            └────────────┘

        ┌───────────┐
        │           │  (from PENDING only)
        │ CANCELLED │◄─────────────────────
        │           │
        └───────────┘
```

---

## 🧪 Testing with Swagger

1. Open http://localhost:3001/api
2. Register: `POST /auth/register`
3. Login: `POST /auth/login` → copy `access_token`
4. Click **Authorize** button → paste token
5. Create tasks and observe status changes
6. Test rate limiting by creating 6+ email tasks in 1 minute
7. For metrics, update your user role to `ADMIN` in DB

---

## 📁 Project Structure

```
src/
├── auth/
│   ├── dto/              # RegisterDto, LoginDto
│   ├── strategies/       # JwtStrategy, JwtAuthGuard
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── user/
│   ├── entities/         # User entity
│   ├── user.service.ts
│   └── user.module.ts
├── task/
│   ├── dto/              # CreateTaskDto
│   ├── entities/         # Task entity
│   ├── task.controller.ts
│   ├── task.service.ts
│   ├── task.worker.ts    # BullMQ worker
│   └── task.module.ts
├── mock/
│   ├── mock.service.ts   # Simulated task processor
│   └── mock.module.ts
├── guard/
│   ├── auth.ts           # RolesGuard
│   └── decorator.ts      # @Roles decorator
└── app.module.ts
```
