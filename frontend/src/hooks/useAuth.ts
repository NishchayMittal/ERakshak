import { create } from 'zustand';

export interface Investigator {
  id: string;
  name: string;
  role: string;
  badgeNumber: string;
}

interface AuthState {
  user: Investigator | null;
  setUser: (user: Investigator | null) => void;
}

// Inner global Zustand store to share authentication state across all hook consumers reactively
const useAuthStore = create<AuthState>((set) => ({
  user: (() => {
    try {
      const saved = localStorage.getItem('er_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved auth credentials:', e);
    }
    // Default logged-in investigator for prototype convenience
    return {
      id: 'inv-042',
      name: 'Leon Lobo',
      role: 'Lead Investigator',
      badgeNumber: 'ER-2026-042',
    };
  })(),
  setUser: (user) => {
    try {
      if (user) {
        localStorage.setItem('er_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('er_user');
      }
    } catch (e) {
      console.warn('Failed to persist auth state to localStorage:', e);
    }
    set({ user });
  }
}));

export function useAuth() {
  const { user, setUser } = useAuthStore();

  const login = (username?: string) => {
    setUser({
      id: 'inv-042',
      name: username || 'Leon Lobo',
      role: 'Lead Investigator',
      badgeNumber: 'ER-2026-042',
    });
  };

  const logout = () => {
    setUser(null);
  };

  return {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    setUser,
  };
}
