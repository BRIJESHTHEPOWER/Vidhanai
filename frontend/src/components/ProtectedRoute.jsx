import React from 'react';
import { Navigate } from 'react-router-dom';
import { getToken } from '../utils/authHeaders';

/**
 * A wrapper for routes that require authentication.
 * Redirects to /login when there is no USABLE token — getToken() also rejects
 * an expired one, so a dead session lands on the login page instead of a page
 * where every request 401s.
 */
export default function ProtectedRoute({ children }) {
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
