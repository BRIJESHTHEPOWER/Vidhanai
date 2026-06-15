/**
 * PERF-H1: Route-level code splitting.
 * ALL pages are React.lazy() — each loads as a separate JS chunk
 * only when the user navigates to that route.
 * Initial bundle drops from ~2MB → ~150KB.
 */
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './LanguageContext';
import { JDAssistantProvider } from './context/JDAssistantContext';
import PageLoader from './components/PageLoader';
import ProtectedRoute from './components/ProtectedRoute';
import VoiceButton from './components/VoiceButton';
import './index.css';

// Lazy-load every page — creates separate JS chunks per route
const VidhanHome    = lazy(() => import('./pages/VidhanHome'));
const LearningHub  = lazy(() => import('./pages/LearningHub'));
const QuizHub      = lazy(() => import('./pages/QuizHub'));
const AskAI        = lazy(() => import('./pages/AskAI'));
const Login        = lazy(() => import('./pages/Login'));
const Signup       = lazy(() => import('./pages/Signup'));
const Compare      = lazy(() => import('./pages/Compare'));
const ComparisonView = lazy(() => import('./pages/ComparisonView'));
const Awareness    = lazy(() => import('./pages/Awareness'));
const SectionDetail = lazy(() => import('./pages/SectionDetail'));
const DetectiveGame = lazy(() => import('./pages/DetectiveGame'));
const ComicStory    = lazy(() => import('./pages/ComicStory'));
const NotFound     = lazy(() => import('./pages/NotFound'));
const Reviews      = lazy(() => import('./pages/Reviews'));
const Profile       = lazy(() => import('./pages/Profile'));
const LawTutor      = lazy(() => import('./pages/LawTutor'));
const AdminPanel    = lazy(() => import('./pages/AdminPanel'));

function App() {
  return (
    <LanguageProvider>
      <Router>
        <JDAssistantProvider>
          {/* PageLoader shown while the page chunk downloads */}
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/"            element={<VidhanHome />} />
              <Route path="/login"       element={<Login />} />
              <Route path="/signup"      element={<Signup />} />
              <Route path="/reviews"     element={<Reviews />} />
              
              
              {/* Protected Routes */}
              <Route path="/profile"     element={<ProtectedRoute><Profile /></ProtectedRoute>} /> 
              <Route path="/learn"       element={<ProtectedRoute><LearningHub /></ProtectedRoute>} />
              <Route path="/quiz"        element={<ProtectedRoute><QuizHub /></ProtectedRoute>} />
              <Route path="/ask-ai"      element={<ProtectedRoute><AskAI /></ProtectedRoute>} />
              <Route path="/compare"     element={<ProtectedRoute><Compare /></ProtectedRoute>} />
              <Route path="/compare-detail/:bns" element={<ProtectedRoute><ComparisonView /></ProtectedRoute>} />
              <Route path="/awareness"   element={<ProtectedRoute><Awareness /></ProtectedRoute>} />
              <Route path="/section/:id" element={<ProtectedRoute><SectionDetail /></ProtectedRoute>} />
              <Route path="/detective"   element={<ProtectedRoute><DetectiveGame /></ProtectedRoute>} />
              <Route path="/comic"       element={<ProtectedRoute><ComicStory /></ProtectedRoute>} />
              <Route path="/tutor"       element={<ProtectedRoute><LawTutor /></ProtectedRoute>} />

              {/* Admin Panel — self-contained auth, no JD/nav */}
              <Route path="/admin"       element={<AdminPanel />} />
              <Route path="/admin/*"     element={<AdminPanel />} />

              <Route path="*"            element={<NotFound />} />
            </Routes>
          </Suspense>
          <VoiceButton />
        </JDAssistantProvider>
      </Router>
    </LanguageProvider>
  );
}

export default App;