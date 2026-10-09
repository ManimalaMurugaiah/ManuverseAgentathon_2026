# Manuverse Agent Orchestrator

Local-first AI project orchestration platform scaffolded for:
- Frontend: React + TypeScript + Recharts
- Backend: FastAPI (Python)
- Database: SQL Server Express / LocalDB via SQLAlchemy + pyodbc
- Cache: Redis
- AI: Ollama (primary) + OpenRouter free models (fallback)
- Auth: JWT + RBAC

## Monorepo Structure

- `frontend/` React application
- `backend/` FastAPI service
- `docker-compose.yml` optional local Redis and Ollama

## Quick Start (Windows)

### 1) Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

### 2) Frontend

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend: http://localhost:5173  
Backend docs: http://localhost:8000/docs

### 3) Optional services with Docker

```powershell
docker compose up -d
```

This starts Redis and Ollama containers.

## SQL Server LocalDB Notes

Update `backend/.env`:

```env
DATABASE_URL=mssql+pyodbc:///?odbc_connect=DRIVER%3D%7BODBC+Driver+17+for+SQL+Server%7D%3BSERVER%3D%28localdb%29%5CMSSQLLocalDB%3BDATABASE%3DManuverseDB%3BTrusted_Connection%3Dyes%3BTrustServerCertificate%3Dyes%3B
```

This uses Windows Authentication (trusted connection) against LocalDB instance:

```text
(localdb)\\MSSQLLocalDB
```

If you prefer SQL Server Express named instance instead:

```env
DATABASE_URL=mssql+pyodbc:///?odbc_connect=DRIVER%3D%7BODBC+Driver+17+for+SQL+Server%7D%3BSERVER%3Dlocalhost%5CSQLEXPRESS%3BDATABASE%3DManuverseDB%3BTrusted_Connection%3Dyes%3BTrustServerCertificate%3Dyes%3B
```

Optional check command:

```powershell
sqllocaldb i MSSQLLocalDB
```

## Default Seed User

On first run, backend seeds:
- Username: `admin`
- Password: `Admin@123`
- Role: `admin`

Change immediately for real use.

## Testing

Backend:
```powershell
cd backend
pytest
```

Frontend:
```powershell
cd frontend
npm run test
```

## Workflow Coverage

The backend includes a staged internal workflow and agent roles aligned to the architecture diagram:
- Design Freeze
- Drawing Approval
- PO Release
- Vendor Manufacturing
- FAT
- Shipment
- Site Readiness
- Equipment Delivery
- Installation
- Mechanical Completion
- SAT
- Commissioning
- Production Handover
