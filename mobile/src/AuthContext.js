import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setOnSessionExpired } from './api';
import * as storage from './storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // The API layer calls this when a refresh fails, which can happen mid-request
  // on any screen — the session is gone, so the app must reflect that.
  useEffect(() => setOnSessionExpired(() => setUser(null)), []);

  useEffect(() => {
    // Clears records left by an older, incompatible shape before the first read.
    storage
      .initStorage()
      .then(() => storage.getCurrentUser())
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  const signUp = useCallback(async (form) => setUser(await storage.signUp(form)), []);
  const logIn = useCallback(async (form) => setUser(await storage.logIn(form)), []);
  const logOut = useCallback(async () => {
    await storage.logOut();
    setUser(null);
  }, []);

  const changeEmail = useCallback(
    async (form) => setUser(await storage.changeEmail(form)),
    [user]
  );

  const changeUsername = useCallback(
    async (form) => setUser(await storage.changeUsername(form)),
    [user]
  );

  const changePassword = useCallback(
    (form) => storage.changePassword(form),
    [user]
  );

  const deleteAccount = useCallback(
    async (password) => {
      await storage.deleteAccount(password);
      setUser(null);
    },
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, signUp, logIn, logOut, changeEmail, changeUsername, changePassword, deleteAccount }),
    [user, loading, signUp, logIn, logOut, changeEmail, changeUsername, changePassword, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}
