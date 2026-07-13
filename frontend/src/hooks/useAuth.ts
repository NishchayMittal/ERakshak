import { useState } from 'react';

export interface Investigator {
  id: string;
  name: string;
  role: string;
  badgeNumber: string;
}

export function useAuth() {
  // Hardcoded lead investigator session for the hackathon prototype
  const [user, setUser] = useState<Investigator | null>({
    id: 'inv-042',
    name: 'Leon Lobo',
    role: 'Lead Investigator',
    badgeNumber: 'ER-2026-042',
  });

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
  };
}
