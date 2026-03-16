import { create } from "zustand";
import { api } from "../lib/api";
import { tokenRef } from "../lib/tokenRef";
import type { AuthResponse, User } from "../types/auth";

const AUTH_BASE = "/api/auth";

interface AuthState {
  accessToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

/** Decode the payload section of a JWT (no verification — that's server-side) */
function decodeJwtPayload(token: string): User | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    return { id: payload.id, email: payload.email };
  } catch {
    return null;
  }
}

/** Sync Zustand state and the shared tokenRef in one place */
function applyToken(
  set: (partial: Partial<AuthState>) => void,
  accessToken: string,
) {
  const user = decodeJwtPayload(accessToken);
  tokenRef.current = accessToken;
  set({ accessToken, user, isAuthenticated: true, isLoading: false });
}

function clearToken(set: (partial: Partial<AuthState>) => void) {
  tokenRef.current = null;
  set({
    accessToken: null,
    user: null,
    isAuthenticated: false,
    error: null,
  });
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post<AuthResponse>(`${AUTH_BASE}/login`, {
        email,
        password,
      });
      applyToken(set, data.accessToken);
    } catch (err: any) {
      const message =
        err.response?.data?.error ??
        err.response?.data?.message ??
        err.message ??
        "Login failed";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  signup: async (username, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post<AuthResponse>(`${AUTH_BASE}/signup`, {
        username,
        email,
        password,
      });
      applyToken(set, data.accessToken);
    } catch (err: any) {
      const message =
        err.response?.data?.error ??
        err.response?.data?.message ??
        err.message ??
        "Signup failed";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.post(`${AUTH_BASE}/logout`);
    } catch {
      // best-effort
    } finally {
      clearToken(set);
    }
  },

  clearError: () => set({ error: null }),
}));
