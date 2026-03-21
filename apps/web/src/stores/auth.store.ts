import { create } from "zustand";
import { api, API_BASE_URL } from "../lib/api";
import { tokenRef } from "../lib/tokenRef";
import type { AuthResponse, User } from "../types/auth";
import axios from "axios";

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
  fetchMe: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

/** Sync Zustand state and the shared tokenRef in one place */
function applyToken(
  set: (partial: Partial<AuthState>) => void,
  accessToken: string,
) {
  tokenRef.current = accessToken;
  set({ accessToken, isAuthenticated: true, isLoading: false });
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

export const useAuthStore = create<AuthState>()((set, get) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  checkAuth: async () => {
    try {
      const { data } = await axios.post<{ accessToken: string }>(
        `${API_BASE_URL}/api/auth/refresh`,
        {},
        { withCredentials: true }
      );
      applyToken(set, data.accessToken);
      get().fetchMe();
    } catch {
      // Not authenticated, do nothing
      clearToken(set);
    }
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get<{ data: User }>("/api/users/me");
      set({ user: data.data, isAuthenticated: true, accessToken: tokenRef.current });
    } catch {
      // If fetching profile fails, keep what we have
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post<AuthResponse>(`${AUTH_BASE}/login`, {
        email,
        password,
      });
      applyToken(set, data.accessToken);
      // Fetch full profile in background
      get().fetchMe();
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
      // Fetch full profile in background
      get().fetchMe();
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
