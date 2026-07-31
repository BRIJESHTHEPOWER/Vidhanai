import { useState, useEffect, useCallback } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

/**
 * Fetches the logged-in user's plan status from the backend.
 * Returns { planStatus, isPro, isTestMode, loading, error, data, refetch }.
 *
 * `plan-status` is the gate — it reflects webhook-confirmed state, never the
 * client-side checkout callback.
 */
export default function usePlanStatus() {
  const [data, setData] = useState(() => {
    try {
      const cached = sessionStorage.getItem('vidhan_plan_cache');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => !data);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    const token = localStorage.getItem('vidhan_token');
    if (!token) {
      setData(null);
      setLoading(false);
      sessionStorage.removeItem('vidhan_plan_cache');
      return null;
    }
    
    // Only show loading if we don't already have cached data
    if (!data) setLoading(true);
    setError('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout max

    try {
      const res = await fetch(`${BASE_URL}/api/user/plan-status`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('Could not load plan status.');
      const json = await res.json();
      setData(json);
      try {
        sessionStorage.setItem('vidhan_plan_cache', JSON.stringify(json));
      } catch (_) {}
      return json;
    } catch (err) {
      clearTimeout(timeoutId);
      setError(err.message || 'Could not load plan status.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    refetch();
  }, []);

  return {
    data,
    planStatus: data?.plan_status ?? 'free',
    isPro: data?.is_pro ?? false,
    isTestMode: data?.is_test_mode ?? true,
    // Cancelled but still inside the paid period — Pro now, no renewal.
    cancelAtCycleEnd: data?.cancel_at_cycle_end ?? false,
    currentPeriodEnd: data?.current_period_end ?? null,
    usage: data?.usage ?? null,
    loading,
    error,
    refetch,
  };
}
