# Product Requirements Document (PRD)
## Vidhan.ai — India's AI-Powered Legal Learning Platform

**Status:** Living document | **Last updated:** 2026-06-15

---

## 1. Overview

Vidhan.ai is a web platform that helps Indian citizens, students, and aspirants
understand criminal law — specifically the transition from the **Indian Penal
Code (IPC), 1860** to the new **Bharatiya Nyaya Sanhita (BNS), 2023**. It
combines a structured law database with an AI legal assistant and a set of
gamified learning experiences (quizzes, comics, and a voice-based AI tutor)
to make dense legal text approachable.

The product has three surfaces:
1. **Main app** (`frontend/`) — the public/user-facing learning platform.
2. **Admin panel** (`admin/`) — a separate React app for platform operators to
   manage laws, users, reviews, and AI query logs.
3. **Backend API** (`backend/`) — FastAPI service powering both, backed by
   MongoDB, FAISS vector search, and the Groq LLM API.

---

## 2. Problem Statement

- India replaced the 160-year-old IPC with the BNS 2023, renumbering and
  rewording most sections. Students, lawyers-in-training, police personnel,
  and ordinary citizens have no easy way to cross-reference old vs. new law.
- Legal text is dense, written in formal/archaic language, and inaccessible
  to non-experts and non-English speakers.
- Existing legal reference sites are static, English-only, and not
  interactive — poor for retention and engagement.

---

## 3. Target Users / Personas

| Persona | Need |
|---|---|
| **Law/CLAT/judiciary exam aspirant** | Quiz drills, side-by-side IPC↔BNS comparison, structured chapters |
| **General citizen** | Plain-language explanation of "what happens if I do X", in their own language |
| **Police/paralegal staff** | Quick lookup of sections, punishments, bailability, cognizability |
| **Curious learner / student** | Gamified content — comics, quizzes, AI tutor |
| **Platform admin/operator** | Manage law data, monitor AI query volume, moderate reviews, manage users |

---

## 4. Goals & Success Metrics

| Goal | Metric |
|---|---|
| Make IPC↔BNS mapping understandable | % of "Compare" sessions completed |
| Increase legal literacy via AI | # of `/ask` (Ask AI) queries per active user |
| Drive habitual learning | Quiz completion rate, streak retention |
| Multilingual reach | % of sessions using non-English language toggle |
| Operational health | Admin dashboard: query volume, user growth, review sentiment |

---

## 5. Core Features (Main App)

### 5.1 Home (`/`)
Cinematic landing page (3D hero, animated sections) introducing the platform,
feature highlights, testimonials, and CTAs to sign up / explore.

### 5.2 Authentication (`/login`, `/signup`)
- Email/password signup & login (JWT-based, 7-day expiry).
- Google OAuth sign-in.
- Password strength meter, show/hide toggles, confirm-password match
  validation, inline name/email/password validation, and a security note
  ("your password is encrypted") — implemented for credential-safety UX.

### 5.3 Learning Hub (`/learn`)
Browse legal topics/chapters; drill into a topic to get a structured
explanation, AI-assisted Q&A on that topic (`/learn/ask-ai`).

### 5.4 Section Detail (`/section/:id`)
Deep-dive view for a single IPC/BNS section: title, description, plain-language
explanation, punishment, bailable/cognizable status, real-life example, and the
IPC↔BNS cross-reference.

### 5.5 Ask AI (`/ask-ai`)
Conversational legal assistant. User asks a question in natural language
(any supported language); backend runs a RAG pipeline (FAISS vector search →
MongoDB keyword fallback → Groq LLM) and returns a grounded answer citing BNS
(and IPC where relevant). Supports streaming responses and "simplify" /
"visualize" follow-ups, plus an "unfold case" feature that expands a scenario
into applicable sections.

### 5.6 Compare (`/compare`, `/compare-detail/:bns`)
Side-by-side IPC vs. BNS comparison tool — search/select a section and view
what changed (renumbering, punishment changes, wording differences), with an
AI-generated comparison summary.

### 5.7 Quiz Hub (`/quiz`)
Auto-generated quizzes (from law data + AI) on IPC/BNS topics, with scoring,
celebratory effects (confetti), and submission tracking.

### 5.8 Comic Story (`/comic`)
AI-generated illustrated "comic strip" explanations of legal scenarios/sections
— makes a law section into a short visual story with an explain-this-panel
feature.

### 5.9 Law Tutor (`/tutor`)
Voice-based AI teacher ("JD") that walks through law chapters/sections as a
spoken lesson (Kokoro TTS), assesses understanding, answers doubts, and
advances through a syllabus session.

### 5.10 Awareness (`/awareness`)
Curated awareness content — legal rights, safety tips, "did you know" facts
(`tips.json`-backed), aimed at general public legal literacy.

### 5.11 Reviews (`/reviews`)
Public testimonials/reviews page; users can submit reviews, which admins can
feature or remove.

### 5.12 Profile (`/profile`)
User account info, avatar, XP/progress, query history, bookmarked
answers, and PDF export of past Q&A.

### 5.13 Multilingual & Voice
- Global `LanguageContext` — UI and AI responses can be toggled to regional
  languages (translation endpoint).
- Floating `VoiceButton` + `JDAssistantContext` — voice intent detection,
  speech-to-text query, and TTS playback of AI answers.

---

## 6. Admin Panel Features (`admin/`)

| Section | Capability |
|---|---|
| **Overview** | Platform stats dashboard (user count, query volume, etc.) |
| **Laws** | CRUD for IPC & BNS law entries (sections, punishments, categories, bailable/cognizable flags, descriptions) |
| **Users** | List/search/delete platform users |
| **Queries** | View logged AI query history (`/ask` queries from users) |
| **Reviews** | Moderate user reviews — feature or delete |
| **Settings** | Admin account management, platform on/off toggle, admin user management |
| **Auth** | Separate admin login/signup with its own JWT, branded with VidhanAI logo |

---

## 7. Non-Goals (Out of Scope)

- Civil law, family law, or other law codes beyond IPC/BNS criminal law (and
  their cross-reference) — current dataset is IPC 1860 + BNS 2023 only.
- Legal advice / representation — the platform is explicitly educational, not
  a substitute for a licensed advocate.
- Native mobile apps — web-only (responsive) for now.

---

## 8. Constraints & Assumptions

- AI responses depend on Groq API availability; the system must degrade
  gracefully (cached/static fallback) if the LLM or MongoDB is unreachable.
- Legal accuracy is best-effort and sourced from the seeded `ipc.json` /
  `bns.json` datasets plus AI generation — not an official government source.
- Single-region deployment assumed (MongoDB local/Atlas, no multi-tenant
  requirements at this stage).

---

## 9. Future Considerations

- Expand dataset to other Sanhitas (BSA — evidence act, BNSS — procedure code).
- Spaced-repetition / personalized quiz difficulty.
- Offline/PWA support for low-connectivity users.
- Admin analytics: trend charts for query topics, drop-off funnels.
