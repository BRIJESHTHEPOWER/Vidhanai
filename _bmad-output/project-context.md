---
project_name: 'ai-legal-system (Vidhan.ai)'
user_name: 'Brijesh'
date: '2026-06-07'
status: complete
sections_completed:
  - technology_stack
  - language_rules
  - framework_rules
  - backend_rules
  - api_patterns
  - db_patterns
  - ai_integration
  - code_organization
  - critical_donts
  - workflow_rules
rule_count: 47
optimized_for_llm: true
---

# Project Context for AI Agents — Vidhan.ai

_Critical rules and patterns AI agents MUST follow when implementing code in this project.
Focus is on non-obvious details that agents commonly miss._

---

## Technology Stack & Versions

### Frontend
- **React** 19.2.5 — use modern hooks API; NO class components
- **Vite** 8.0.11 + `@vitejs/plugin-react` 6.0.1 — dev server on port 3000
- **React Router DOM** 7.14.0 — use v7 API (`<Routes>`, `<Route>`, `useNavigate`, `useParams`)
- **Framer Motion** 12.38.0 + **Motion** 12.40.0 (both installed; use `framer-motion` for page/component animations)
- **Three.js** 0.184.0 + **@react-three/fiber** 9.6.1 + **@react-three/drei** 10.7.7 + **@react-three/rapier** 2.2.0
- **GSAP** 3.15.0 — used for scroll-based hero animations
- **canvas-confetti** 1.9.4 — quiz/game celebration effects
- **lucide-react** 1.8.0 — icon library
- Styling: **Vanilla CSS only** — NO Tailwind in production components (tailwind-merge and clsx are installed but only used in `/components/ui/` shadcn-style utilities)
- Path alias: `@` resolves to `./src` (configured in vite.config.js)

### Backend
- **FastAPI** 0.104.1 — all endpoints use sync def (not async) unless explicitly needed
- **Uvicorn** 0.24.0 — started with `uvicorn app.main:app --reload`
- **PyMongo** 4.6.0 — synchronous MongoDB driver; NO Motor/async
- **Pydantic** 2.5.0 — v2 API (use `model_validator`, `field_validator`, not v1 validators)
- **Groq SDK** (unpinned) — primary AI provider; model: `llama-3.3-70b-versatile`
- **FAISS-CPU** 1.7.4 — vector index stored at `backend/vector/`
- **LangChain** 0.1.3 + **langchain-community** 0.0.8 — used in RAG pipeline only
- **SlowAPI** — rate limiting middleware already wired to `app.state.limiter`
- **JWT** (HS256, 7-day expiry) + **bcrypt** — authentication
- **python-dotenv** 1.0.0 — env loaded via `load_dotenv()` at module top

### Admin Panel
- Separate Vite+React app in `/admin/` — runs on its own port
- Has its own `src/api.js` for backend calls

---

## Critical Implementation Rules

### Language-Specific Rules (JavaScript/JSX)

- **JSX file extension**: ALL React files use `.jsx` extension (not `.tsx`, `.ts`, or `.js`). There is ONE exception: `/components/demo.tsx` which is an isolated shadcn demo — do NOT use `.tsx` for new files.
- **No TypeScript**: The project is plain JavaScript/JSX. Do NOT add TypeScript types, `.ts` files, or `tsconfig.json` for the main frontend.
- **Import style**: Use named imports for React hooks (`import React, { useState, useEffect } from 'react'`). React is always the first import.
- **CSS co-location**: Every page/component that needs styles has a co-located `.css` file (e.g., `QuizMode.jsx` + `QuizMode.css`). Always create the CSS file alongside the component. Import it directly: `import './ComponentName.css';`
- **No CSS Modules**: CSS files are plain CSS imported directly — NOT CSS modules (`styles.module.css`). Class names are plain strings.
- **No styled-components**: Do not introduce styled-components or emotion.
- **Async patterns**: Use `async/await` inside `useEffect` by creating an inner async function. Never make the effect callback itself async.
  ```js
  useEffect(() => {
    const load = async () => { /* fetch here */ };
    load();
  }, []);
  ```

### Language-Specific Rules (Python)

- **Sync FastAPI**: All route handlers are `def` (synchronous), not `async def`, unless specifically doing I/O that requires it.
- **Pydantic v2**: Use `model_config = ConfigDict(...)` not `class Config:`. Use `model_validator(mode='after')` not `@validator`.
- **Environment variables**: Always loaded via `load_dotenv()` at the top of the module, then accessed via `os.getenv()`. Never hardcode secrets.
- **No f-string multi-line abuse**: Long prompts use triple-quote f-strings. Keep them readable.
- **Import order**: stdlib → third-party → local (`from app.xxx import ...`).

---

### Framework-Specific Rules (React)

#### Component Structure
- **One component per file** — no multiple exports from a single file (except small sub-components used only within that file).
- **PascalCase filenames** — `QuizMode.jsx`, `DetectiveGame.jsx`. Never kebab-case for React files.
- **Default export** — every page/component uses `export default function ComponentName()`.
- **Lazy loading** — all top-level page components in `App.jsx` are lazy-loaded via `React.lazy()`. When adding a new page, add it to `App.jsx` with `lazy(() => import('./pages/NewPage'))`.

#### State Management
- **No Redux / Zustand** — state is managed locally with `useState` + `useContext`.
- **Two global contexts**: `LanguageContext` (language selection) and `JDAssistantContext` (AI voice assistant state). Use these for cross-cutting concerns.
- **localStorage** for persistence: User XP, tokens, and game state are in `localStorage`. Keys: `vidhan_token`, `detective_xp`, `detective_cases`.

#### Protected Routes
- The `<ProtectedRoute>` wrapper checks for `localStorage.getItem('vidhan_token')`. All feature pages (learn, quiz, ask-ai, detective, comic, compare, awareness, section detail) MUST be wrapped in `<ProtectedRoute>`.
- Public routes: `/`, `/login`, `/signup`, `/reviews`.

#### Animation Patterns
- Use `framer-motion` `<motion.div>` for entrance/exit animations.
- Standard entrance: `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}`.
- Use `<AnimatePresence>` when conditionally mounting/unmounting animated elements.
- GSAP is used only in `CinematicHero.jsx` for complex scroll timelines — do not introduce GSAP elsewhere.

#### API Call Pattern
- All backend calls go to `const API = 'http://localhost:8000'` defined at the top of the component file.
- Pattern: `fetch(`${API}/endpoint`, { method, headers, body })`.
- All fetches are wrapped in `try/catch`. On error, show user-facing message (not just console.log).
- Bearer token included where auth is needed: `headers: { Authorization: `Bearer ${localStorage.getItem('vidhan_token')}` }`.

---

### Framework-Specific Rules (FastAPI Backend)

#### Router Structure
- Each feature has its own router file in `backend/app/routers/`.
- Routers are registered in `backend/app/main.py` via `app.include_router(xxx_router)`.
- Add the router import AND `app.include_router()` call when creating new routers.
- Router tags are used for Swagger grouping — always set `tags=["FeatureName"]`.

#### Rate Limiting
- Use `@limiter.limit("30/minute")` on new endpoints. The limiter is attached to `app.state.limiter` in `main.py`.
- Endpoint must also accept `request: Request` as first parameter for SlowAPI to work.
  ```python
  @app.post("/new-endpoint")
  @limiter.limit("30/minute")
  def new_endpoint(request: Request, body: MyModel):
  ```

#### Input Sanitization
- ALWAYS call `sanitize_input()` from `app.routers` on user-supplied text before passing to AI or DB.
- `sanitize_input(text, max_len=2000)` strips HTML tags and collapses whitespace.

#### Shared Utilities (`app/routers/__init__.py`)
- `get_all_laws()` — returns cached list of all law documents (5-min TTL). Use this instead of direct DB queries when scanning all laws.
- `get_current_user_email_optional()` — JWT dependency for optional auth.
- `sanitize_input()` — input cleaner.
- `rag_context_from_db()` — keyword-scored law retrieval.
- `serialize_law()` — standard law document serializer for API responses.

---

### Database Patterns (MongoDB)

#### Collections
```
laws_collection          → "laws"           (enriched IPC+BNS data)
bns_collection           → "bns_sections"   (raw BNS 2023 from bns.json)
queries_collection       → "queries"        (chat + quiz history)
users_collection         → "users"          (auth users + XP)
comics_collection        → "comics"         (generated comic cache)
detective_cases_collection → "detective_cases"
leaderboard_collection   → "leaderboard"
reviews_collection       → "reviews"
admin_users_collection   → "admin_users"
```

#### DB Error Handling (CRITICAL)
- MongoDB may be **offline** (the app is designed to degrade gracefully).
- **ALL** MongoDB calls MUST be wrapped in `try/except`.
- On DB failure, fall back to: cached data → in-memory data → AI generation → graceful error response.
- Never let a DB exception propagate to a 500 with no fallback.
- Example pattern:
  ```python
  try:
      result = collection.find_one({...})
  except Exception as e:
      print(f"DB error (non-critical): {e}")
      result = None
  if not result:
      # use fallback
  ```

#### Document Schema: Laws (enriched)
Key fields: `ipc_section`, `bns_section`, `title`, `category`, `punishment`, `bns_punishment`, `description`, `simple_explanation`, `keywords`, `bailable`, `cognizable`, `differences`, `real_life_example`.

#### Document Schema: BNS raw
Key fields: `section_number`, `title`, `chapter`, `description`, `punishment` (dict or str), `ai_summary`, `keywords`, `important_definitions`, `is_punishable`.

#### normalize_law_doc()
Always pass raw BNS documents through `normalize_law_doc()` from `app/db/connection.py` before using them as enriched law docs.

---

### AI Integration Patterns

#### Groq Client
```python
from groq import Groq
import os
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
```
- Primary model: `"llama-3.3-70b-versatile"`
- Temperature: 0.3 for factual/legal answers, 0.6-0.7 for creative (comic, detective).
- Always set `max_tokens` explicitly to control cost.
- For structured JSON output: use `response_format={"type": "json_object"}` in the API call.
- Always wrap Groq calls in `try/except` — model may be unavailable.

#### RAG Pipeline
1. `find_relevant_law(question)` — FAISS vector search (fastest)
2. `rag_context_from_db(question)` — keyword fallback from MongoDB
3. `generate_ai_response(question, context, language)` — Groq LLM generation
- If no context found, return a graceful "no info found" message — do NOT call Groq without context for the main `/ask` endpoint.

#### Prompt Structure
- Always identify yourself as an "Indian Legal AI assistant specializing in BNS 2023 and IPC 1860."
- **BNS 2023 is the current law; IPC 1860 is historical.** Always cite BNS first.
- Instruct model to NOT hallucinate section numbers.

---

### Code Organization Rules

#### File Naming
| Type | Convention | Example |
|---|---|---|
| React page | PascalCase + `.jsx` | `DetectiveGame.jsx` |
| React component | PascalCase + `.jsx` | `QuizMode.jsx` |
| Page CSS | Same name as component + `.css` | `DetectiveGame.css` |
| Backend router | snake_case + `.py` | `detective.py` |
| Backend service | snake_case + `.py` | `ai.py`, `rag.py` |

#### Directory Structure (Frontend)
```
frontend/src/
  pages/          ← Full page components (one per route)
  components/     ← Reusable UI components
  context/        ← React context providers
  assets/         ← Static assets (images, 3D models)
  lib/            ← Pure utility functions (no React)
```

#### Directory Structure (Backend)
```
backend/
  app/
    routers/      ← Feature routers (one per domain)
    services/     ← AI, RAG, scenario generation services
    db/           ← MongoDB connection and helpers
  vector/         ← FAISS index and search module
  data/           ← Seed data (bns.json, etc.)
  static/         ← Static file serving
```

---

### Critical DON'Ts (Anti-Patterns to Avoid)

1. **DON'T use TypeScript** — the project is JavaScript/JSX. Adding `.ts`/`.tsx` breaks the build.
2. **DON'T add Tailwind classes to components** — all styling is Vanilla CSS. `tailwind-merge` and `clsx` are only used in `/components/ui/` (shadcn utilities). New components use co-located `.css` files.
3. **DON'T make MongoDB calls without try/except** — the DB may be offline. The app must always degrade gracefully.
4. **DON'T call Groq AI without error handling** — API may be rate-limited or unavailable. Always catch and return fallback data.
5. **DON'T use async def for FastAPI route handlers** unless actually awaiting something — the codebase uses synchronous PyMongo, so routes are `def` not `async def`.
6. **DON'T use Pydantic v1 syntax** — the project uses Pydantic 2.5.0. Old validators (`@validator`, `class Config`) are deprecated.
7. **DON'T use React Router v5 API** — the project uses react-router-dom v7. Old API (`<Switch>`, `<Redirect>`, `useHistory`) does not exist.
8. **DON'T add new routes to `App.jsx` without lazy loading** — all page imports must use `React.lazy()`.
9. **DON'T expose the GROQ_API_KEY or JWT_SECRET on the frontend** — all AI calls go through the backend.
10. **DON'T use CSS modules** — all CSS files are plain CSS with global class names. Not `*.module.css`.
11. **DON'T use `any` Tailwind utility classes in `.jsx` files outside of `/components/ui/`** — it will not render since Tailwind is not configured for those files.
12. **DON'T forget to include `request: Request` as the first parameter** on any endpoint decorated with `@limiter.limit()`.

---

### Security Rules

- JWT secret loaded from `JWT_SECRET` env var — server exits at startup if missing.
- All user input passed to AI or DB must go through `sanitize_input()`.
- CORS is configured with an explicit origins whitelist in `main.py` — do NOT set `allow_origins=["*"]`.
- Passwords hashed with bcrypt — never store plaintext passwords.
- Admin routes are in a separate router (`admin.py`) with their own auth middleware.

---

### Performance Rules

- Frontend uses route-level code splitting via `React.lazy()` — maintain this for all new pages.
- Law data is cached in memory with a 5-minute TTL via `get_all_laws()` — use this cache, don't query the DB directly on every request.
- BNS sections cache uses the same TTL pattern (`_BNS_CACHE` tuple in `quiz.py` and `detective.py`).
- Three.js / 3D scenes are heavy — they are isolated to specific components and not used in feature pages.

---

### Environment Variables Required

```env
GROQ_API_KEY=...         # Groq AI API key
JWT_SECRET=...           # JWT signing secret (required — server exits without it)
MONGO_URI=mongodb://127.0.0.1:27017
DB_NAME=ai_legal_system
HUGGINGFACE_API_KEY=...  # Optional — for embeddings
```

---

_Last updated: 2026-06-07 | Generated by bmad-generate-project-context_

---

## Usage Guidelines

**For AI Agents:**
- Read this entire file before implementing any code in this project
- Follow ALL rules exactly as documented — particularly the DON'Ts
- When in doubt about styling (CSS vs Tailwind), always use co-located Vanilla CSS
- When in doubt about DB reliability, always wrap in try/except with fallback
- Update this file if new patterns emerge during development

**For Humans:**
- Keep this file lean and focused on agent needs — no "obvious" rules
- Update the `Technology Stack` section whenever a dependency is upgraded
- Review quarterly for outdated rules
- Run `bmad-generate-project-context` again after major architectural changes

_Last updated: 2026-06-07 | Generated by bmad-generate-project-context_
