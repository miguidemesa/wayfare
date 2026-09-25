import { createContext, useContext, useEffect, useRef, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import {
  ApiError,
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  setUnauthorizedHandler,
} from "@/shared/api";
import { clearTripCache } from "@/lib/trip";

type AuthState = {
  ready: boolean;
  signedIn: boolean;
  /** Why the user was sent back to sign in, when it wasn't their choice. */
  notice: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  ready: true,
  signedIn: false,
  notice: null,
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
  const [notice, setNotice] = useState<string | null>(null);
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;

  useEffect(() => {
    // The session lives in the native cookie store. Ask the server whose it
    // is. Only a definite "nobody" signs the user out: offline or a server
    // error says nothing about the session, so keep them in and let the app
    // show what it can. If the session really has lapsed, the first request
    // that reaches the server gets a 401 and the handler below takes over.
    fetchMe()
      .then((user) => setSignedIn(user != null))
      .catch((e) => setSignedIn(!(e instanceof ApiError) || e.status === 0 || e.status >= 500))
      .finally(() => {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
      });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!signedInRef.current) return;
      clearTripCache();
      setNotice("You've been signed out. Sign in again to carry on.");
      setSignedIn(false);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const value: AuthState = {
    ready,
    signedIn,
    notice,
    signIn: async (email, password) => {
      await apiLogin(email, password);
      setNotice(null);
      setSignedIn(true);
    },
    signUp: async (email, password, name) => {
      await apiRegister(email, password, name);
      setNotice(null);
      setSignedIn(true);
    },
    signOut: async () => {
      await apiLogout();
      clearTripCache();
      setNotice(null);
      setSignedIn(false);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
