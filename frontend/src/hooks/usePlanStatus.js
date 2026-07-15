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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    const token = localStorage.getItem('vidhan_token');
    if (!token) {
      setData(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/api/user/plan-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Could not load plan status.');
      const json = await res.json();
      setData(json);
      return json;
    } catch (err) {
      setError(err.message || 'Could not load plan status.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data,
    planStatus: data?.plan_status ?? 'free',
    isPro: data?.is_pro ?? false,
    isTestMode: data?.is_test_mode ?? true,
    // Cancelled but still inside the paid period — Pro now, no renewal.
    cancelAtCycleEnd: data?.cancel_at_cycle_end ?? false,
    currentPeriodEnd: data?.current_period_end ?? null,
    // Free-plan daily question usage ({questions_limit, questions_used_today,
    // questions_remaining} — all null for Pro).
    usage: data?.usage ?? null,
    loading,
    error,
    refetch,
  };
}
