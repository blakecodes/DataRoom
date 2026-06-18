# Data Room MVP

A document repository MVP with:

- **React + Vite** frontend
- **Flask / Python** API
- **PostgreSQL** for users, metadata, OAuth credentials, and import jobs
- **Azure Blob Storage** for file content
- **Redis + RQ** worker for background Google Drive imports
- **Terraform on Azure Container Apps** for cloud deployment

## What the app does

- Sign up / log in with app-native email + password auth
- Connect a Google account with OAuth
- Select files with Google Picker and import them into the Data Room
- Upload local files directly
- Preview / download supported files
- Search and paginate file results from the backend
- Track long-running imports through persisted job rows

## Repo layout

```text
backend/           Flask app, worker, Alembic migrations, tests
frontend/          React/Vite SPA
infra/terraform/   Azure infrastructure and deploy flow
```

## Prerequisites

- Docker + Docker Compose
- Node 20+
- npm
- Terraform 1.5+
- Azure CLI if you want to deploy to Azure

## Local development

### 1. Backend environment

Copy the backend env file:

```bash
cp .env.example .env
```

Fill in at least:

- `APP_ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` should stay `http://localhost:8000/api/auth/google/callback` for local dev

Generate a Fernet key with:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 2. Frontend environment

Copy the frontend env file:

```bash
cp frontend/.env.example frontend/.env
```

Set:

- `VITE_API_BASE=http://localhost:8000/api`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_API_KEY`

### 3. Google Cloud Console setup

For local development, configure the OAuth client with:

- **Authorized redirect URI**
  `http://localhost:8000/api/auth/google/callback`
- **Authorized JavaScript origin**
  `http://localhost:5173`

Enable:

- Google Drive API
- Google Picker API

### 4. Start the backend stack

The backend stack runs in Docker and includes:

- Postgres on host port `5433`
- Azurite Blob emulator on `10000`
- Redis on `6379`
- Flask API on `8000`
- RQ worker

Start it with:

```bash
make up
```

Or:

```bash
docker compose up --build
```

### 5. Start the frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

- Frontend: [http://localhost:5173](http://localhost:5173)
- API health: [http://localhost:8000/api/healthz](http://localhost:8000/api/healthz)

## Common local commands

### Run migrations

```bash
make migrate
```

### Run tests

```bash
make test
```

### Watch backend / worker logs

```bash
make logs
```

### Open a shell in the backend container

```bash
make shell
```

## Notes on the Python / DB backend

- Flask app bootstrap lives in `backend/app/__init__.py`
- DB engine/session setup is in `backend/app/db.py`
- The initial schema is in `backend/migrations/versions/0001_initial.py`
- Auth endpoints are in `backend/app/blueprints/auth.py`
- Google OAuth and Picker token flow live in:
  - `backend/app/blueprints/google_oauth.py`
  - `backend/app/services/google_oauth.py`
- File list / upload / preview / delete endpoints live in `backend/app/blueprints/files.py`
- Background imports are created in `backend/app/blueprints/imports.py`
- Worker queue logic lives in `backend/app/services/jobs.py`
- Blob helpers live in `backend/app/services/storage.py`

## Import pipeline notes

The Google Drive import path is designed around persisted DB state:

- `import_jobs` tracks one import request
- `import_job_items` tracks each selected Drive file
- The worker resumes orphaned jobs after restarts
- Streaming Drive-to-Blob upload avoids loading large files into memory

This is especially important for large media files, where buffering the entire
file would OOM the worker.

## Terraform / Azure notes

Terraform lives in `infra/terraform/`.

The current Azure deployment provisions:

- Resource group
- Container Apps environment
- Container Registry
- Blob Storage account + container
- Postgres Flexible Server
- Public frontend Container App
- Public API Container App
- Private worker Container App
- Internal Redis Container App

### Before running Terraform

Create a local tfvars file from the example:

```bash
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
```

Fill in:

- `subscription_id`
- `tenant_id`
- `google_client_id`
- `google_client_secret`
- `google_api_key`

Do **not** commit `terraform.tfvars`.

### Terraform commands

```bash
cd infra/terraform
terraform init
terraform plan
terraform apply
```

### Terraform implementation notes

- Frontend and backend images are built in Azure Container Registry via `az acr build`
- Container Apps revisions are forced on rebuild so fresh images are actually deployed
- Postgres is split to its own region variable (`postgres_location`) because some subscriptions may be region-restricted
- The worker was sized and hardened after real large-file import testing

### Current cloud tradeoffs

- Redis is deployed as a simple internal Container App for MVP simplicity
- Queue durability would be stronger with Azure Cache for Redis
- Postgres networking is currently public/firewalled for speed of setup; a private endpoint/VNet would be the production hardening step

## Public repo hygiene

This repo is configured so the following stay out of Git:

- local env files
- Terraform state and `tfvars`
- design assets / design-context
- internal docs and interview notes

If you add new local-only notes or exports, keep them untracked as well.
