import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, _hasHydrated } = useAuthStore();
  const location = useLocation();

  if (!_hasHydrated) return null;

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
