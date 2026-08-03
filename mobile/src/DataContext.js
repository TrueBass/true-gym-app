import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import * as storage from './storage';

const DataContext = createContext(null);

/**
 * Holds the records and weight entries for the signed-in user.
 *
 * The screens used to load in `useEffect` on mount, and switching tabs unmounts
 * one screen and mounts the next — so every tab switch cost a round trip for
 * data that had not changed. Loading here instead means it happens once per
 * session, and writes update this state from the response the server already
 * sends back rather than asking for the whole list again.
 */
export function DataProvider({ children }) {
  const { user } = useAuth();
  const [prs, setPRs] = useState([]);
  const [weights, setWeights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextPRs, nextWeights] = await Promise.all([storage.getPRs(), storage.getWeights()]);
      setPRs(nextPRs);
      setWeights(nextWeights);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setPRs([]);
      setWeights([]);
      setError('');
      return;
    }
    load();
  }, [user?.id, load]);

  /** Saving is idempotent by exercise, so the answer either replaces a row or is a new one. */
  const savePR = useCallback(async (input) => {
    const record = await storage.savePR(input);
    setPRs((prev) =>
      prev.some((p) => p.id === record.id)
        ? prev.map((p) => (p.id === record.id ? record : p))
        : [record, ...prev]
    );
  }, []);

  const deletePR = useCallback(async (recordId) => {
    await storage.deletePR(recordId);
    setPRs((prev) => prev.filter((p) => p.id !== recordId));
  }, []);

  const addWeight = useCallback(async (kg) => {
    const entry = await storage.addWeight(kg);
    // The list is newest-first and this reading is now.
    setWeights((prev) => [entry, ...prev]);
  }, []);

  const deleteWeight = useCallback(async (entryId) => {
    await storage.deleteWeight(entryId);
    setWeights((prev) => prev.filter((e) => e.id !== entryId));
  }, []);

  const value = useMemo(
    () => ({ prs, weights, loading, error, refresh: load, savePR, deletePR, addWeight, deleteWeight }),
    [prs, weights, loading, error, load, savePR, deletePR, addWeight, deleteWeight]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside a DataProvider');
  return ctx;
}
