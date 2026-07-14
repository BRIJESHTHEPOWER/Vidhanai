import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const AdminLogin    = lazy(() => import('./pages/AdminLogin'));
const AdminSignup   = lazy(() => import('./pages/AdminSignup'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));

function PrivateRoute({ children }) {
  const token = localStorage.getItem('vadmin_token');
  return token ? children : <Navigate to="/login" replace />;
}

function Loader() {
  return (
    <div style={{
      minHeight: '100vh', background: '#030712',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 40, height: 40,
        border: '3px solid rgba(99,102,241,0.2)',
        borderTopColor: '#6366f1',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/login"  element={<AdminLogin />} />
          <Route path="/signup" element={<AdminSignup />} />
          <Route path="/*"      element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
