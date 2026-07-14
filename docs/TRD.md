# Technical Requirements Document (TRD)
## Vidhan.ai — Architecture & Implementation Reference

**Status:** Living document | **Last updated:** 2026-06-15

---

## 1. System Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   frontend/ (User)   │     │   admin/ (Operator)  │
│  React 19 + Vite     │     │  React + Vite        │
│  port: 3000 (dev)    │     │  port: 3001 (dev)    │
└──────────┬───────────┘     └──────────┬───────────┘
           │  fetch (REST, JSON, Bearer JWT)         │
           └─────────────────┬────────────────────────┘
                              ▼
                  ┌────────────────────────┐
                  │  backend/ (FastAPI)     │
                  │  uvicorn app.main:app   │
                  │  port: 8000             │
                  └─────────┬───────────────┘
                             │
        ┌────────────────────┼─────────────────────┬───────────────┐
        ▼                    ▼                     ▼               ▼
 ┌─────────────┐     ┌───────────────┐     ┌──────────────┐  ┌───────────┐
 │ MongoDB      │     │ FAISS vector   │     │ Groq LLM API │  │ Kokoro TTS │
 │ (PyMongo)    │     │ index (vector/)│     │ llama-3.3-70b│  │ (voice)    │
 └─────────────┘     └───────────────┘     └──────────────┘  └───────────┘
```

---

## 2. Technology Stack

### 2.1 Frontend (`frontend/`)
- **React** 19.x, **Vite** 8.x + `@vitejs/plugin-react`
- **React Router DOM** v7 (`<Routes>`, `<Route>`, `useNavigate`)
- **Framer Motion** + **Motion** — page/component animation
- **Three.js** + `@react-three/fiber` + `@react-three/drei` +
  `@react-three/rapier` — 3D hero/scene visuals
- **GSAP** — scroll-driven hero timelines (isolated to `CinematicHero.jsx`)
- **canvas-confetti** — quiz/game reward effects
- **lucide-react** — icon set
- **@react-oauth/google** — Google sign-in
- Styling: plain CSS, co-located per component (`Component.jsx` +
  `Component.css`); no Tailwind, no CSS Modules
- Path alias `@` → `./src`
- All page components are `React.lazy()`-loaded for route-level code splitting

### 2.2 Admin (`admin/`)
- Separate Vite + React app (`vidhan-admin`), own `src/api.js` for backend
  calls, own JWT (`vadmin_token` in localStorage)
- Same general conventions as `frontend/` (plain CSS, PascalCase components)

### 2.3 Backend (`backend/`)
- **FastAPI** 0.104.1, **Uvicorn** 0.24.0 — `uvicorn app.main:app --reload`
- **PyMongo** 4.6.0 — synchronous Mongo driver (no Motor/async)
- **Pydantic** 2.5.x — v2 API only
- **Groq SDK** — model `llama-3.3-70b-versatile`
- **FAISS-CPU** 1.7.4 — vector similarity search (`backend/vector/`)
- **sentence-transformers** (`all-MiniLM-L6-v2`) — embeddings for the RAG pipeline (`backend/vector/build_index.py`, `app/services/rag.py`)
- **SlowAPI** — rate limiting (`app.state.limiter`)
- **JWT (HS256, 7-day expiry)** + **bcrypt** — auth
- **python-dotenv** — config via `.env`

### 2.4 Database — MongoDB collections

| Collection | Purpose |
|---|---|
| `laws_collection` ("laws") | Enriched IPC+BNS data (cross-referenced) |
| `bns_collection` ("bns_sections") | Raw BNS 2023 (from `bns.json`) |
| `queries_collection` ("queries") | Chat / quiz / Ask-AI history |
| `users_collection` ("users") | Auth users, XP, profile |
| `comics_collection` ("comics") | Generated comic cache |
| `detective_cases_collection` ("detective_cases") | Generated detective cases |
| `leaderboard_collection` ("leaderboard") | Detective game leaderboard |
| `reviews_collection` ("reviews") | User testimonials/reviews |
| `admin_users_collection` ("admin_users") | Admin accounts |

**Document schema — enriched law (`laws`):** `ipc_section`, `bns_section`,
`title`, `category`, `punishment`, `bns_punishment`, `description`,
`simple_explanation`, `keywords`, `bailable`, `cognizable`, `differences`,
`real_life_example`. Several of these fields (`punishment`, `bailable`,
`category`) may be **nested objects** (e.g. `{available, reason}`,
`{death_penalty, life_imprisonment, fine}`) rather than scalars — any UI
rendering these fields MUST flatten/stringify them first (see
`admin/src/components/sections/LawsPanel.jsx`'s `displayText()` helper).

**Document schema — raw BNS (`bns_sections`):** `section_number`, `title`,
`chapter`, `description`, `punishment` (dict or str), `ai_summary`,
`keywords`, `important_definitions`, `is_punishable`. Must be passed through
`normalize_law_doc()` (`app/db/connection.py`) before being treated as an
enriched law doc.

**DB error handling (critical):** MongoDB may be offline. All Mongo calls are
wrapped in `try/except`; on failure the app falls back to cached data →
in-memory data → AI generation → graceful error — never a bare 500.

---

## 3. Backend API Surface

Base URL (dev): `http://localhost:8000`

### 3.1 Core (`app/main.py`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/ai-search` | AI-assisted law search |
| POST | `/ask` | Main Ask-AI endpoint (RAG + Groq) |
| POST | `/ask-stream` | Streaming version of `/ask` |
| POST | `/simplify` | Simplify a legal passage |
| POST | `/visualize` | Generate a visualization/diagram for a scenario |
| POST | `/unfold-case` | Expand a scenario into applicable sections |
| GET | `/`, `/test`, `/health` | Health/status checks |

### 3.2 Auth (`/auth`, `app/auth.py`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/signup` | Create user, return JWT |
| POST | `/auth/login` | Email/password login, return JWT |
| POST | `/auth/google` | Google OAuth token exchange |
| POST | `/auth/update-picture` | Update avatar |
| POST | `/auth/forgot-password` | Password reset flow |
| POST | `/auth/logout` | Logout (token invalidation/clear) |

### 3.3 Search & Compare (`app/routers/search.py`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/search-law` | Keyword search across laws |
| GET | `/get-section/{section_id}` | Fetch a single section |
| GET | `/compare-laws` | IPC↔BNS structural comparison |
| GET | `/ai-compare` | AI-generated comparison summary |
| GET | `/compare-search` | Search within comparison context |
| GET | `/suggest` | Search-bar autosuggestions |
| GET | `/law-of-day` | Featured "law of the day" |

### 3.4 Learn (`app/routers/learn.py`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/learn/topics` | List learning topics/chapters |
| GET | `/learn/topic/{ipc_section}` | Topic detail |
| POST | `/learn/ask-ai` | Topic-scoped AI Q&A |

### 3.5 Quiz (`app/routers/quiz.py`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/quiz/generate` | Generate quiz questions |
| POST | `/quiz/submit` | Submit answers, get score |

### 3.6 Explore (`app/routers/explore.py`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/explore/law/{ipc_section}` | Exploratory deep-link into a section |

### 3.7 History (`app/routers/history.py`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/ask` (history-aware) | Log + answer a query |
| GET | `/history` | User's query history |
| PUT | `/bookmark/{history_id}` | Toggle bookmark |
| GET | `/export-pdf/{history_id}` | Export a Q&A as PDF |

### 3.8 Awareness (`app/routers/awareness.py`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/awareness` | Awareness content/tips |

### 3.9 Voice (`app/routers/voice.py`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/translate` | Translate text |
| POST | `/voice/ask` | Voice-driven Ask-AI |
| POST | `/voice/intent` | Voice intent classification |

### 3.10 Detective (`app/routers/detective.py`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/generate` | Generate a detective case |
| POST | `/solve` | Submit a solution |
| GET | `/leaderboard` | Leaderboard |

### 3.11 Reviews (`app/routers/reviews.py`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/reviews` | Submit a review |
| GET | `/reviews` | List reviews |
| DELETE | `/reviews/{review_id}` | Delete a review |

### 3.12 Comic (`app/routers/comic.py`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/comic/image` | Fetch generated comic image |
| POST | `/comic-story` | Generate a comic story |
| POST | `/comic/explain` | Explain a comic panel |

### 3.13 Tutor / JD Voice Teacher
| Method | Path | Purpose |
|---|---|---|
| GET | `/tutor/chapters/{law_code}` | List chapters for IPC/BNS |
| GET | `/tutor/chapter/{law_code}/{chapter_num}/sections` | Sections in a chapter |
| POST | `/tutor/lesson` | Generate a lesson |
| POST | `/tutor/assess` | Assess user understanding |
| POST | `/tutor/analyze` | Analyze user response |
| POST | `/tutor/doubt` | Answer a doubt |
| POST | `/jd/chat` | JD assistant chat |
| POST | `/jd/teach/start` | Start a voice-taught session |
| GET | `/jd/teach/audio/{session_id}/{turn_id}` | Fetch turn audio |
| POST | `/jd/teach/interrupt` | Interrupt current lesson |
| POST | `/jd/teach/doubt-resolved` | Mark doubt resolved |
| POST | `/jd/teach/next` | Advance lesson |
| GET | `/jd/teach/session/{session_id}` | Session state |
| GET | `/tts/voices` | List TTS voices |
| POST | `/tts/speak` | Synthesize speech (Kokoro) |

### 3.14 Admin (`/admin`, `app/routers/admin.py`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/admin/rebuild-faiss` | Rebuild the FAISS vector index |
| POST | `/admin/login` | Admin login |
| POST | `/admin/register` | Admin registration |
| GET | `/admin/me` | Current admin profile |
| POST | `/admin/change-password` | Change admin password |
| GET | `/admin/stats` | Dashboard stats |
| GET | `/admin/users` | List users |
| DELETE | `/admin/users/{user_id}` | Delete user |
| GET | `/admin/reviews` | List reviews (moderation) |
| PATCH | `/admin/reviews/{review_id}/feature` | Feature/unfeature a review |
| DELETE | `/admin/reviews/{review_id}` | Delete a review |
| GET | `/admin/queries` | AI query logs |
| GET/POST | `/admin/laws` | List/create enriched law entries |
| PUT/DELETE | `/admin/laws/{law_id}` | Update/delete a law entry |
| GET/POST | `/admin/ipc-laws` | List/create IPC-specific entries |
| PUT/DELETE | `/admin/ipc-laws/{law_id}` | Update/delete IPC entry |
| GET | `/admin/laws-summary` | Aggregate law counts |
| GET | `/admin/platform-status` | Platform on/off status |
| POST | `/admin/platform/toggle` | Toggle platform availability |
| GET | `/admin/admins` | List admin accounts |
| DELETE | `/admin/admins/{admin_id}` | Remove an admin account |

---

## 4. AI / RAG Pipeline

1. **Vector search** — `find_relevant_law(question)` via FAISS index in
   `backend/vector/` (fastest path).
2. **Keyword fallback** — `rag_context_from_db(question)` (MongoDB
   keyword-scored retrieval) if vector search yields nothing.
3. **LLM generation** — `generate_ai_response(question, context, language)`
   via Groq (`llama-3.3-70b-versatile`).
4. If no context is found at all, return a graceful "no info found" message —
   **never** call Groq with empty context for `/ask`.

**Prompting rules:**
- The assistant identifies as an "Indian Legal AI assistant specializing in
  BNS 2023 and IPC 1860."
- BNS 2023 is the *current* law and is cited first; IPC 1860 is historical
  context.
- The model is instructed not to hallucinate section numbers.
- Temperature: 0.3 for factual/legal answers; 0.6–0.7 for creative content
  (comic generation, detective case generation).
- `max_tokens` always set explicitly; JSON-mode (`response_format={"type":
  "json_object"}`) used for structured outputs.
- All Groq calls wrapped in `try/except` (API may be rate-limited/unavailable).

---

## 5. Security

- JWT secret from `JWT_SECRET` env var — **server refuses to start** if
  missing.
- Passwords hashed with **bcrypt**; never stored in plaintext.
- All user-supplied text passed to AI or DB goes through `sanitize_input()`
  (strips HTML, collapses whitespace, `max_len=2000`).
- CORS uses an explicit origin whitelist — never `allow_origins=["*"]`.
- Admin routes (`/admin/*`) have separate auth (`admin_users_collection`,
  own JWT) from regular users.
- Rate limiting via SlowAPI (`@limiter.limit("30/minute")`); rate-limited
  endpoints must declare `request: Request` as the first parameter.
- `GROQ_API_KEY` / `JWT_SECRET` are server-side only — never exposed to either
  frontend.

---

## 6. Frontend Routing

### 6.1 Main app (`frontend/src/App.jsx`)
| Path | Component | Access |
|---|---|---|
| `/` | `VidhanHome` | Public |
| `/login` | `Login` | Public |
| `/signup` | `Signup` | Public |
| `/reviews` | `Reviews` | Public |
| `/profile` | `Profile` | Protected |
| `/learn` | `LearningHub` | Protected |
| `/quiz` | `QuizHub` | Protected |
| `/ask-ai` | `AskAI` | Protected |
| `/compare` | `Compare` | Protected |
| `/compare-detail/:bns` | `ComparisonView` | Protected |
| `/awareness` | `Awareness` | Protected |
| `/section/:id` | `SectionDetail` | Protected |
| `/detective` | `DetectiveGame` | Protected |
| `/comic` | `ComicStory` | Protected |
| `/tutor` | `LawTutor` | Protected |
| `/admin`, `/admin/*` | `AdminPanel` | Self-contained auth |
| `*` | `NotFound` | — |

"Protected" = wrapped in `<ProtectedRoute>`, which checks
`localStorage.getItem('vidhan_token')`.

### 6.2 Admin app (`admin/src/App.jsx`)
| Path | Component | Access |
|---|---|---|
| `/login` | `AdminLogin` | Public |
| `/signup` | `AdminSignup` | Public |
| `/*` | `Dashboard` (via `PrivateRoute`) | Requires `vadmin_token` |

Dashboard sections (tabs): **Overview**, **Laws**, **Users**, **Queries**,
**Reviews**, **Settings**.

---

## 7. State Management & Persistence

- No Redux/Zustand — local `useState` + two global contexts:
  `LanguageContext` (UI/AI language), `JDAssistantContext` (voice assistant
  state for the JD tutor).
- `localStorage` keys: `vidhan_token`, `vidhan_user`, `vidhan_email`,
  `vidhan_avatar`, `detective_xp`, `detective_cases` (main app); `vadmin_token`,
  `vadmin_user` (admin app).

---

## 8. Performance

- Route-level code splitting via `React.lazy()` for every page (main app
  initial bundle ~150KB vs ~2MB unsplit).
- `get_all_laws()` caches all law documents in memory with a 5-minute TTL;
  used instead of per-request DB scans. Same TTL pattern (`_BNS_CACHE`) used
  in `quiz.py` and `detective.py`.
- Heavy Three.js/3D scenes isolated to specific landing-page components, not
  loaded on feature pages.

---

## 9. Environment Variables

```env
GROQ_API_KEY=...         # Groq AI API key
JWT_SECRET=...           # JWT signing secret (required — server exits without it)
MONGO_URI=mongodb://127.0.0.1:27017
DB_NAME=ai_legal_system
HUGGINGFACE_API_KEY=...  # Optional — for embeddings
```

---

## 10. Conventions Quick-Reference

- React files: `.jsx` only (no `.tsx`/TypeScript in main app/admin).
- Co-located CSS per component, plain CSS (no Tailwind/CSS Modules) outside
  `/components/ui/`.
- Backend routers: one file per domain in `app/routers/`, registered in
  `app/main.py` via `app.include_router(...)`, tagged for Swagger grouping.
- FastAPI handlers: `def` (sync), not `async def`, unless real async I/O is
  needed (matches sync PyMongo).
- Pydantic v2 only (`model_validator`, `field_validator`, `ConfigDict`).

---

## 11. Implemented but Not Exposed in Primary Navigation

The following are fully coded end-to-end (frontend + backend wired up) but are
**not reachable from the Navbar, home page, or any other primary user flow**.
They are real code in this repo, but are intentionally excluded from the
PRD and App Flow as product features until they are linked in. Treat this as
a "finish wiring up or remove" list.

### 11.1 Detective Game
- Frontend: `frontend/src/pages/DetectiveGame.jsx`, route `/detective`
  (registered in `App.jsx`).
- Backend: `app/routers/detective.py` — `POST /generate`, `POST /solve`,
  `GET /leaderboard`.
- DB: `detective_cases_collection` ("detective_cases"),
  `leaderboard_collection` ("leaderboard").
- `localStorage`: `detective_xp`, `detective_cases`.
- Reachability: absent from `Navbar.jsx` and `VidhanHome.jsx`. Only reachable
  via direct URL or the voice assistant's "open detective" / "play game"
  intents (`JDAssistantContext.jsx`). Also advertised as a marketing bullet
  ("🔍 Detective case simulator") on `Login.jsx` / `Signup.jsx`, which is
  misleading since clicking nothing leads there.
- To turn into a real feature: add a Navbar/home-page link to `/detective`.

### 11.2 Forgot Password
- Backend: `POST /auth/forgot-password` exists in `app/auth.py`.
- Frontend: no "Forgot password?" link, reset-password page, or route exists
  in `Login.jsx` / `Signup.jsx` / `App.jsx`.
- To turn into a real feature: add a "Forgot password?" link on `/login` plus
  a reset-password page and route.
