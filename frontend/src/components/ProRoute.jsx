import React from 'react';
import { Navigate } from 'react-router-dom';
import usePlanStatus from '../hooks/usePlanStatus';
import PageLoader from './PageLoader';
import { getToken } from '../utils/authHeaders';

/**
 * Wrapper for Pro-only routes/components.
 * - Not logged in            -> redirect to /login
 * - Logged in but not Pro     -> redirect to /pricing
 * - Pro (webhook-confirmed)   -> render children
 *
 * Mirrors ProtectedRoute, but gates on the server-verified plan_status.
 */
export default function ProRoute({ children }) {
  const token = getToken();          // null for a missing, malformed or expired token
  const { isPro, loading } = usePlanStatus();

  if (!token) return <Navigate to="/login" replace />;
  if (loading) return <PageLoader />;
  if (!isPro) return <Navigate to="/pricing" replace />;

  return children;
}
