import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * A wrapper for routes that require authentication.
 * If the user is not logged in (no token), it redirects to /login.
 */
export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('vidhan_token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
