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

  const changeEmail = useCallback(
    async (form) => setUser(await storage.changeEmail(user.id, form)),
    [user]
  );

  const changePassword = useCallback(
    (form) => storage.changePassword(user.id, form),
    [user]
  );

  const deleteAccount = useCallback(
    async (password) => {
      await storage.deleteAccount(user.id, password);
      setUser(null);
    },
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, signUp, logIn, logOut, changeEmail, changePassword, deleteAccount }),
    [user, loading, signUp, logIn, logOut, changeEmail, changePassword, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}
