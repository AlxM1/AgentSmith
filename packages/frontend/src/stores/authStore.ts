import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IUserPublicData, IAuthTokens } from '@agentsmith/shared';

interface AuthState {
  user: IUserPublicData | null;
  tokens: IAuthTokens | null;
  isAuthenticated: boolean;
  login: (user: IUserPublicData, tokens: IAuthTokens) => void;
  logout: () => void;
  updateUser: (user: Partial<IUserPublicData>) => void;
  updateTokens: (tokens: IAuthTokens) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      login: (user, tokens) =>
        set({
          user,
          tokens,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
        }),
      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),
      updateTokens: (tokens) =>
        set({
          tokens,
        }),
    }),
    {
      name: 'agentsmith-auth',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
