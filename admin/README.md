# Vidhan.ai — Admin Module

Standalone admin dashboard for the Vidhan.ai legal system.

## Project Structure

```
d:\ai-legal-system\
├── backend\     → FastAPI (port 8000)
├── frontend\    → User-facing Vite app (port 3000)
└── admin\       → Admin dashboard Vite app (port 3001) ← YOU ARE HERE
```

## Setup & Run

```bash
cd admin
npm install
npm run dev
```

Opens at → **http://localhost:3001**

## Default Admin Credentials

| Field    | Value              |
|----------|--------------------|
| Email    | admin@vidhan.ai    |
| Password | admin@123          |

> The default admin is auto-created when the backend starts if no admin exists.

## Features

| Section   | Capabilities |
|-----------|-------------|
| Overview  | KPI cards, rating distribution, laws by category, recent reviews |
| Users     | Search, paginated list, delete |
| Reviews   | Search, filter by rating, delete |
| Queries   | Browse AI query log, search |
| Laws      | Category breakdown with progress bars |
| Settings  | Change password, add/remove admin accounts |

## Tech Stack

- **React 18** + **Vite**
- **Framer Motion** for animations
- **Lucide React** for icons
- **React Router v6** for routing

## Backend Requirements

Make sure the backend is running: `uvicorn app.main:app --reload` (port 8000)
