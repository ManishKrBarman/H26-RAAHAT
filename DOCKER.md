# 🐳 Docker Setup Guide — Raahat Traffic System

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed
- Docker Compose v2 (included with Docker Desktop)

---

## 🚀 Quick Start

```bash
# Clone the repo (skip if you already have it)
git clone https://github.com/ManishKrBarman/H26-Raahat.git
cd H26-Raahat

# Start everything
docker compose up -d --build
```

Open **http://localhost:3000** — that's it.

---

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│   MongoDB    │
│   (nginx)    │     │   (Node.js)  │     │              │
│  Port: 3000  │     │  Port: 3001  │     │  Port: 27017 │
└──────────────┘     └──────────────┘     └──────────────┘
    browser             container            container
    calls               internal:3000        internal:27017
    localhost:3001
```

**How it works:**
- Frontend is built into **static HTML/JS/CSS** by Vite, served by **nginx**
- The API URL (`http://localhost:3001`) is **baked into the JS bundle** at build time
- Backend connects to MongoDB using Docker's internal hostname: `mongodb:27017`
- Browser → `localhost:3001` → backend container → `mongodb:27017`

---

## 📁 Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Defines all 3 services and their configuration |
| `.env` | Port numbers and API URL (override defaults here) |
| `backend/Dockerfile` | Multi-stage Node.js build |
| `frontend/Dockerfile` | Vite build + nginx serving |
| `backend/.dockerignore` | Files excluded from backend image |
| `frontend/.dockerignore` | Files excluded from frontend image |

---

## ⚙️ Common Commands

```bash
# Start all services (detached)
docker compose up -d

# Start + rebuild images (after code changes)
docker compose up -d --build

# Stop all services
docker compose down

# Stop + delete database volume (fresh start)
docker compose down -v

# View all logs
docker compose logs -f

# View logs for one service
docker compose logs -f backend

# Check status
docker compose ps

# Restart just one service
docker compose restart backend

# Rebuild just one service
docker compose up -d --build frontend

# Open a shell inside a container
docker compose exec backend sh
docker compose exec mongodb mongosh raahat
```

---

## 🔧 Changing Ports

Edit `.env` in the project root:

```env
# Change frontend from 3000 to 8080
FRONTEND_PORT=8080

# Change backend from 3001 to 5000
BACKEND_PORT=5000

# Change MongoDB from 27017 to 27018
MONGO_PORT=27018

# IMPORTANT: If you change BACKEND_PORT, update this too!
VITE_API_BASE_URL=http://localhost:5000
```

Then rebuild:
```bash
docker compose up -d --build
```

> **Why rebuild?** The API URL is baked into the frontend JS at build time by Vite.
> Changing `VITE_API_BASE_URL` requires rebuilding the frontend image.

---

## 🔌 Local Development (Without Docker)

When running locally without Docker, keep using the defaults:

```
Frontend (Vite dev server):  http://localhost:5173
Backend (nodemon):           http://localhost:3000
MongoDB:                     mongodb://127.0.0.1:27017/raahat
```

The frontend `config/api.js` defaults to `http://localhost:3000` when
`VITE_API_BASE_URL` is not set, so local dev "just works."

### Running Local + Docker MongoDB

You can mix: run MongoDB in Docker but frontend/backend locally:

```bash
# Start only MongoDB from Docker
docker compose up -d mongodb

# Backend (local)
cd backend && npm run dev
# → connects to localhost:27017 (Docker MongoDB)

# Frontend (local)
cd frontend && npm run dev
# → API calls go to localhost:3000 (local backend)
```

---

## 🌐 Production Deployment

### Step 1: Set environment variables

Create `.env.production`:
```env
FRONTEND_PORT=80
BACKEND_PORT=3001
MONGO_PORT=27017
VITE_API_BASE_URL=https://api.yourdomain.com
```

### Step 2: Build and deploy

```bash
# Use production env
cp .env.production .env

# Build and start
docker compose up -d --build
```

### Step 3: Reverse proxy (recommended)

Put nginx/Caddy in front for HTTPS:
```
https://yourdomain.com     →  frontend container (port 80)
https://api.yourdomain.com →  backend container (port 3001)
```

### Step 4: MongoDB security

For production, add authentication:
```yaml
# docker-compose.yml → mongodb service
environment:
  MONGO_INITDB_ROOT_USERNAME: admin
  MONGO_INITDB_ROOT_PASSWORD: your_secure_password

# docker-compose.yml → backend service
environment:
  MONGODB_URI: mongodb://admin:your_secure_password@mongodb:27017/raahat?authSource=admin
```

---

## 🐛 Troubleshooting

### Port already in use

```bash
# Find what's using the port
netstat -ano | findstr :3000    # Windows
lsof -i :3000                  # Mac/Linux

# Solution: change ports in .env
```

### MongoDB connection refused

```bash
# Check if MongoDB is healthy
docker compose ps

# View MongoDB logs
docker compose logs mongodb

# MongoDB needs ~10s to start. Backend waits via depends_on + healthcheck.
```

### Frontend shows blank page

```bash
# Check if the build succeeded
docker compose logs frontend

# Rebuild
docker compose up -d --build frontend
```

### Backend can't connect to MongoDB

```bash
# The backend uses MONGODB_URI from docker-compose.yml
# Inside Docker, MongoDB hostname is "mongodb" (the service name), NOT "localhost"
# Container  → mongodb://mongodb:27017/raahat     ✅
# Local      → mongodb://127.0.0.1:27017/raahat   ✅
# Container  → mongodb://localhost:27017/raahat    ❌ WRONG
```

### Need to reset everything

```bash
docker compose down -v           # stop + delete volumes
docker system prune -f           # clean unused images
docker compose up -d --build     # fresh start
```

---

## 📊 Resource Summary

| Service | Image Size | RAM Usage |
|---------|-----------|-----------|
| Frontend | ~25 MB (nginx:alpine) | ~5 MB |
| Backend | ~150 MB (node:20-alpine) | ~50 MB |
| MongoDB | ~700 MB (mongo:7) | ~100 MB |
| **Total** | **~875 MB** | **~155 MB** |
