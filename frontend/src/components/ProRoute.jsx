import React from 'react';
import { Navigate } from 'react-router-dom';
import usePlanStatus from '../hooks/usePlanStatus';
import PageLoader from './PageLoader';

/**
 * Wrapper for Pro-only routes/components.
 * - Not logged in            -> redirect to /login
 * - Logged in but not Pro     -> redirect to /pricing
 * - Pro (webhook-confirmed)   -> render children
 *
 * Mirrors ProtectedRoute, but gates on the server-verified plan_status.
 */
export default function ProRoute({ children }) {
  const token = localStorage.getItem('vidhan_token');
  const { isPro, loading } = usePlanStatus();

  if (!token) return <Navigate to="/login" replace />;
  if (loading) return <PageLoader />;
  if (!isPro) return <Navigate to="/pricing" replace />;

  return children;
}
