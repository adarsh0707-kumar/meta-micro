import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { authApi } from "../api/api";
import { setLanguage } from "../i18n/i18n";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [institute, setInstitute] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem("meta_micro_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await authApi.me();
      setUser(data.user);
      setInstitute(data.institute);
      setLanguage(data.institute.default_language);
    } catch {
      localStorage.removeItem("meta_micro_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (email, password) => {
    const { data } = await authApi.login({ email, password });
    localStorage.setItem("meta_micro_token", data.access_token);
    await refreshMe();
  };

  const signup = async (payload) => {
    const { data } = await authApi.signup(payload);
    localStorage.setItem("meta_micro_token", data.access_token);
    await refreshMe();
  };

  const logout = () => {
    localStorage.removeItem("meta_micro_token");
    setUser(null);
    setInstitute(null);
  };

  return (
    <AuthContext.Provider value={{ user, institute, loading, login, signup, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
