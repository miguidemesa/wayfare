import { createContext, useContext, useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { api, login as apiLogin, logout as apiLogout, register as apiRegister } from "@/shared/api";

type AuthState = {
  ready: boolean;
  signedIn: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  ready: true,
  signedIn: false,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    // Session lives in the native cookie store. Probe it with an
    // authenticated endpoint; 401 → signed out.
    api
      .get("/api/trips")
      .then(() => setSignedIn(true))
      .catch(() => setSignedIn(false))
      .finally(() => {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
      });
  }, []);

  const value: AuthState = {
    ready,
    signedIn,
    signIn: async (email, password) => {
      await apiLogin(email, password);
      setSignedIn(true);
    },
    signUp: async (email, password, name) => {
      await apiRegister(email, password, name);
      setSignedIn(true);
    },
    signOut: async () => {
      await apiLogout();
      setSignedIn(false);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}