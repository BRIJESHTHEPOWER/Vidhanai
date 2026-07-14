# Application Flow — Vidhan.ai

**Status:** Living document | **Last updated:** 2026-06-15

This document describes the end-to-end user journeys across the main app
(`frontend/`) and admin panel (`admin/`), and how each flow maps onto the
backend API (`backend/`).

---

## 1. High-Level Site Map

```
Vidhan.ai
├── Public
│   ├── / .................... Home (cinematic landing)
│   ├── /login ............... Login (email/password + Google)
│   ├── /signup .............. Signup
│   └── /reviews ............. Public reviews/testimonials
│
├── Authenticated (requires vidhan_token)
│   ├── /profile .............. User profile, XP, history
│   ├── /learn ................ Learning Hub (topics/chapters)
│   │   └── /section/:id ...... Section detail (IPC ↔ BNS)
│   ├── /quiz .................. Quiz Hub
│   ├── /ask-ai ................ AI legal assistant (chat)
│   ├── /compare ............... IPC vs BNS comparison tool
│   │   └── /compare-detail/:bns  Detailed comparison view
│   ├── /awareness ............. Legal awareness / tips
│   ├── /comic .................. AI-generated comic stories
│   └── /tutor ................... Voice AI law tutor (JD)
│
└── Admin (separate app, requires vadmin_token)
    ├── /login / /signup ....... Admin auth
    └── /  (Dashboard tabs)
        ├── Overview ........... Platform stats
        ├── Laws ............... IPC/BNS CRUD
        ├── Users .............. User management
        ├── Queries ............ AI query logs
        ├── Reviews ............ Review moderation
        └── Settings ........... Admin accounts, platform toggle
```

---

## 2. Entry & Authentication Flow

```
┌──────────┐    visit /     ┌──────────────┐
│  Visitor │ ─────────────► │  VidhanHome   │
└──────────┘                └──────┬───────┘
                                    │ click "Get Started" / try a feature
                                    ▼
                          ┌────────────────────┐
                          │ vidhan_token in     │
                          │ localStorage?       │
                          └─────┬──────────┬────┘
                          no    │          │ yes
                                ▼          ▼
                        ┌──────────┐  ┌──────────────┐
                        │ /login   │  │ Feature page  │
                        │ /signup  │  │ (Learn, Quiz, │
                        └────┬─────┘  │ Ask AI, etc.) │
                             │         └──────────────┘
            ┌────────────────┴─────────────────┐
            ▼                                   ▼
   POST /auth/login                    POST /auth/signup
   { email, password }                 { name, email, password }
   or POST /auth/google                (client validates name/email/
   { token }                            password + confirm before submit)
            │                                   │
            ▼                                   ▼
   200 → { access_token, name, email,   200 → { access_token, ... }
           picture? }                   → store in localStorage
   → store vidhan_token / vidhan_user /  → navigate to "/"
     vidhan_email / vidhan_avatar
   → navigate to "/"
```

**Login page (`/login`)** — `frontend/src/pages/Login.jsx`
- Split-panel layout (`Login.css`): left = animated "scales of justice" +
  branding + feature highlights; right = `.auth-card` form.
- Toggles between **Sign In** and **Sign Up** forms in-place
  (`AnimatePresence`), or user can navigate to the standalone `/signup` page.
- Sign-in form: email, password (show/hide toggle), "or continue with"
  Google button (`GoogleLogin`).
- Sign-up form (in `Login.jsx` or standalone `Signup.jsx`): name, email,
  password (with live strength meter), confirm password (live match
  indicator), inline validation hints (name format, email format, password
  length), and a "🔒 your password is encrypted" security note. Submission is
  blocked client-side until all fields validate, then `POST /auth/signup`.

**Signup page (`/signup`)** — `frontend/src/pages/Signup.jsx`
- Same split-panel design (shares `Login.css`), full registration form with
  the same credential-safety UX as above.
- On success: shows "Account created! Redirecting to login…" then navigates
  to `/login` after 1.5s.
- Footer: "Already have an account? **Sign in**" → `/login`.

---

## 3. Learning Hub Flow

```
/learn  ──GET /learn/topics──►  list of IPC/BNS topics & chapters
   │
   │ user selects a topic
   ▼
/section/:id ──GET /learn/topic/{ipc_section}──► section detail:
                                                   - title, description
                                                   - simple_explanation
                                                   - punishment / bailable /
                                                     cognizable
                                                   - IPC ↔ BNS cross-reference
                                                   - real_life_example
   │
   │ "Ask AI about this section"
   ▼
POST /learn/ask-ai  { question, ipc_section } ──► topic-scoped AI answer
```

---

## 4. Ask AI (Conversational Assistant) Flow

```
/ask-ai
  │
  │ user types/speaks a legal question (any supported language)
  ▼
POST /ask  (or /ask-stream for streaming)
  { question, language, history? }
  │
  ▼ backend RAG pipeline
  1. FAISS vector search over law embeddings (vector/)
  2. fallback: MongoDB keyword search (rag_context_from_db)
  3. Groq LLM (llama-3.3-70b-versatile) generates grounded answer
     citing BNS first, IPC second
  │
  ▼
Response rendered in AIChatInterface
  │
  ├── "Simplify" → POST /simplify  (plain-language rewrite)
  ├── "Visualize" → POST /visualize (diagram/visual summary)
  └── "Unfold this case" → POST /unfold-case (expands scenario → sections)

All exchanges also logged via POST /ask (history router) →
  queries_collection, retrievable at GET /history, bookmarkable via
  PUT /bookmark/{history_id}, exportable via GET /export-pdf/{history_id}.
```

Voice variant: `VoiceButton` (global, all authenticated pages) →
`POST /voice/intent` (classify) → `POST /voice/ask` (answer) → TTS playback
via `/tts/speak`.

---

## 5. Compare (IPC ↔ BNS) Flow

```
/compare
  │  search/select a section
  ▼
GET /compare-laws | /compare-search | /suggest
  │  shows matched IPC section + corresponding BNS section side-by-side
  │
  │ click "View full comparison"
  ▼
/compare-detail/:bns ──GET /get-section/{section_id} + /ai-compare──►
  - old (IPC) text/punishment vs new (BNS) text/punishment
  - AI-generated summary of what changed and why
```

---

## 6. Quiz Flow

```
/quiz
  │
  ▼
GET /quiz/generate ──► set of MCQs derived from law data (+ AI)
  │
  │ user answers questions
  ▼
POST /quiz/submit  { answers }
  │
  ▼
Score + feedback, confetti celebration on pass/high score,
XP updated (profile / localStorage)
```

---

## 7. Comic Story Flow

```
/comic
  │  user picks a section or scenario
  ▼
POST /comic-story  { section or prompt } ──► AI generates a multi-panel
                                              comic script + images
  │
  ├── GET /comic/image ──► fetch panel image(s)
  └── POST /comic/explain ──► plain-language explanation of a given panel
```

---

## 8. Law Tutor (JD Voice Teacher) Flow

```
/tutor
  │  pick law code (IPC/BNS) and chapter
  ▼
GET /tutor/chapters/{law_code}
GET /tutor/chapter/{law_code}/{chapter_num}/sections
  │
  │ "Start lesson"
  ▼
POST /jd/teach/start ──► session begins; AI ("JD") speaks the lesson
  │   (audio via GET /jd/teach/audio/{session_id}/{turn_id}, Kokoro TTS)
  │
  ├── User has a doubt → POST /tutor/doubt or /jd/teach/interrupt
  │     → AI answers → POST /jd/teach/doubt-resolved
  │
  ├── POST /tutor/assess + /tutor/analyze ──► checks understanding,
  │     adapts pacing
  │
  └── POST /jd/teach/next ──► advance to next section/turn
        GET /jd/teach/session/{session_id} ──► resume/check session state
```

`JDAssistantContext` (global) tracks the active session/turn so the floating
voice assistant UI stays in sync across the page.

---

## 9. Awareness & Reviews Flow

```
/awareness ──GET /awareness──► curated rights/safety tips (tips.json-backed)

/reviews
  │  GET /reviews ──► public testimonials
  │
  │ logged-in user submits a review
  ▼
POST /reviews  { rating, text } ──► stored in reviews_collection
                                     (pending admin moderation)
```

---

## 10. Profile Flow

```
/profile
  │
  ├── GET /history ──► past Ask-AI queries (with bookmark state)
  ├── PUT /bookmark/{history_id} ──► toggle bookmark
  ├── GET /export-pdf/{history_id} ──► download Q&A as PDF
  └── POST /auth/update-picture ──► change avatar
```

---

## 11. Admin Panel Flow

### 11.1 Admin Auth
```
/admin (admin app root)
  │
  │ vadmin_token in localStorage?
  │
  no ──► /login ──POST /admin/login──► { access_token, name, email }
  │        or /signup ──POST /admin/register──►
  │
  yes ──► Dashboard (PrivateRoute)
```
Admin login/signup pages (`AdminLogin.jsx`, `AdminSignup.jsx`) use the
VidhanAI logo (purple/silver "VA" mark) in the header and as favicon; the
previous "default credentials" hint and shield icon have been removed for a
cleaner look.

### 11.2 Dashboard Tabs
```
Dashboard
├── Overview   ──GET /admin/stats──────────► platform-wide metrics
│
├── Laws       ──GET /admin/laws, /admin/ipc-laws, /admin/laws-summary
│               ──POST/PUT/DELETE /admin/laws/{id}, /admin/ipc-laws/{id}
│               (LawsPanel.jsx — table view + edit modal;
│                object-valued fields like `punishment`/`bailable`/
│                `category` are flattened via displayText() before
│                rendering or populating the edit form)
│
├── Users      ──GET /admin/users
│               ──DELETE /admin/users/{user_id}
│
├── Queries    ──GET /admin/queries────────► AI query log viewer
│
├── Reviews    ──GET /admin/reviews
│               ──PATCH /admin/reviews/{id}/feature
│               ──DELETE /admin/reviews/{id}
│
└── Settings   ──GET /admin/me, /admin/admins
                ──POST /admin/change-password
                ──DELETE /admin/admins/{admin_id}
                ──GET /admin/platform-status
                ──POST /admin/platform/toggle  (enable/disable user-facing app)
                ──POST /admin/rebuild-faiss    (rebuild vector index after
                                                 law data edits)
```

### 11.3 Typical Admin Workflow — Updating Law Data
```
1. Admin logs in at admin /login
2. Navigates to "Laws" tab
3. Edits a section's punishment/category/bailable info (form fields are
   flattened display strings; saved back as structured data)
4. PUT /admin/laws/{law_id} (or /admin/ipc-laws/{law_id})
5. (Optional) POST /admin/rebuild-faiss to refresh AI vector search with
   the updated content
6. Changes immediately reflected in main app's /learn, /section/:id,
   /compare, and /ask-ai (via get_all_laws() cache, 5-min TTL)
```

---

## 12. Cross-Cutting: Voice Assistant Overlay

A floating `<VoiceButton />` is mounted globally (outside the route switch) in
`App.jsx`. It is available on every authenticated page and:
1. Captures voice input → `POST /voice/intent` to classify what the user wants
   (ask a question, navigate, start quiz, etc.)
2. Routes the intent to the relevant endpoint (`/voice/ask`, navigation, etc.)
3. Plays back responses via `/tts/speak` (Kokoro TTS)

State is shared via `JDAssistantContext` so the Law Tutor page and the global
voice button don't conflict during an active tutoring session.
