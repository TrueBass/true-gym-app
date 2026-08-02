import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as storage from './storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storage
      .getCurrentUser()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  const signUp = useCallback(async (form) => setUser(await storage.signUp(form)), []);
  const logIn = useCallback(async (form) => setUser(await storage.logIn(form)), []);
  const logOut = useCallback(async () => {
    await storage.logOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signUp, logIn, logOut }),
    [user, loading, signUp, logIn, logOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}
