/**
 * PERF-H1: Route-level code splitting.
 * ALL pages are React.lazy() — each loads as a separate JS chunk
 * only when the user navigates to that route.
 * Initial bundle drops from ~2MB → ~150KB.
 */
import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { LanguageProvider } from './LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import AntdProvider from './providers/AntdProvider';
import PageLoader from './components/PageLoader';
import ProtectedRoute from './components/ProtectedRoute';
import ProRoute from './components/ProRoute';
import 'antd/dist/reset.css';
import './index.css';

// Lazy-load every page — creates separate JS chunks per route
const VidhanHome    = lazy(() => import('./pages/VidhanHome'));
const QuizHub      = lazy(() => import('./pages/QuizHub'));
const AskAI        = lazy(() => import('./pages/AskAI'));
const Login        = lazy(() => import('./pages/Login'));
const Signup       = lazy(() => import('./pages/Signup'));
const VerifyOtp    = lazy(() => import('./pages/VerifyOtp'));
const Compare      = lazy(() => import('./pages/Compare'));
const ComparisonView = lazy(() => import('./pages/ComparisonView'));
const Awareness    = lazy(() => import('./pages/Awareness'));
const SectionDetail = lazy(() => import('./pages/SectionDetail'));
const ComicStory    = lazy(() => import('./pages/ComicStory'));
const NotFound     = lazy(() => import('./pages/NotFound'));
const Reviews      = lazy(() => import('./pages/Reviews'));
const Profile       = lazy(() => import('./pages/Profile'));
const LawTutor      = lazy(() => import('./pages/LawTutor'));
const AdminPanel    = lazy(() => import('./pages/AdminPanel'));
const Pricing       = lazy(() => import('./pages/Pricing'));
const About         = lazy(() => import('./pages/About'));
const SubscribeSuccess = lazy(() => import('./pages/SubscribeSuccess'));
const ProDemo       = lazy(() => import('./pages/ProDemo'));
const Contact       = lazy(() => import('./pages/Contact'));

/**
 * Scrolls to the element matching the URL hash (e.g. "/#how-it-works").
 * React Router's <Link> updates the hash but does not scroll on its own.
 * The target section can live inside a lazy-loaded page, so we retry until
 * it mounts. The navbar offset is handled by `scroll-padding-top` on <html>.
 */
function HashScroll() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    let cancelled = false;
    let tries = 0;
    const tryScroll = () => {
      if (cancelled) return;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (tries++ < 30) {
        setTimeout(tryScroll, 100);
      }
    };
    const t = setTimeout(tryScroll, 50);
    return () => { cancelled = true; clearTimeout(t); };
  }, [pathname, hash]);
  return null;
}

function App() {
  return (
    <ThemeProvider>
    <AntdProvider>
    <LanguageProvider>
      <Router>
        <HashScroll />
        {/* PageLoader shown while the page chunk downloads */}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/"            element={<VidhanHome />} />
            <Route path="/login"       element={<Login />} />
            <Route path="/signup"      element={<Signup />} />
            <Route path="/verify-otp"  element={<VerifyOtp />} />
            <Route path="/pricing"     element={<Pricing />} />
            <Route path="/about"       element={<About />} />
            <Route path="/contact"     element={<Contact />} />

            {/* Protected Routes */}
            <Route path="/reviews"     element={<ProtectedRoute><Reviews /></ProtectedRoute>} />
            <Route path="/profile"     element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/subscribe/success" element={<ProtectedRoute><SubscribeSuccess /></ProtectedRoute>} />

            {/* Pro-gated (plan_status must be "pro" — set by the Razorpay webhook) */}
            <Route path="/pro"         element={<ProRoute><ProDemo /></ProRoute>} />
            <Route path="/quiz"        element={<ProRoute><QuizHub /></ProRoute>} />
            <Route path="/comic"       element={<ProRoute><ComicStory /></ProRoute>} />
            <Route path="/tutor"       element={<ProRoute><LawTutor /></ProRoute>} />

            {/* Free-plan accessible (login required; AI questions limited server-side) */}
            <Route path="/ask-ai"      element={<ProtectedRoute><AskAI /></ProtectedRoute>} />
            <Route path="/compare"     element={<ProtectedRoute><Compare /></ProtectedRoute>} />
            <Route path="/compare-detail/:bns" element={<ProtectedRoute><ComparisonView /></ProtectedRoute>} />
            <Route path="/awareness"   element={<ProtectedRoute><Awareness /></ProtectedRoute>} />
            <Route path="/section/:id" element={<ProtectedRoute><SectionDetail /></ProtectedRoute>} />

            {/* Admin Panel — self-contained auth, no nav */}
            <Route path="/admin"       element={<AdminPanel />} />
            <Route path="/admin/*"     element={<AdminPanel />} />

            <Route path="*"            element={<NotFound />} />
          </Routes>
        </Suspense>
      </Router>
    </LanguageProvider>
    </AntdProvider>
    </ThemeProvider>
  );
}

export default App;