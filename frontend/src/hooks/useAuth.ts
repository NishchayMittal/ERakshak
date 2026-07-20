import { create } from 'zustand';
import { loginRequest } from '../api/endpoints';
import { apiClient } from '../api/client';

// Load token on module initialization to keep active sessions authenticated
const savedToken = localStorage.getItem('er_token');
if (savedToken) {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
}

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
      id: 'INV-001',
      name: 'Leon Lobo',
      role: 'Lead Investigator',
      badgeNumber: 'INV-001',
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

  const login = async (badgeId: string, password?: string) => {
    const data = await loginRequest(badgeId, password);
    if (data && data.access_token) {
      localStorage.setItem('er_token', data.access_token);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
      
      setUser({
        id: data.badge_id,
        name: data.full_name,
        role: data.badge_id === 'INV-001' ? 'Lead Investigator' : 'Investigator',
        badgeNumber: data.badge_id,
      });
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('er_token');
    delete apiClient.defaults.headers.common['Authorization'];
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
