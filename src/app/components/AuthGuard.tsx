import React from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';

export function AuthGuard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.img
            src="/logo.png"
            alt="MyLui"
            className="w-20 h-20 object-contain"
            animate={{ rotate: [-8, 8, -8, 8, -5, 5, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.6, ease: 'easeInOut' }}
          />
          <p className="text-sm text-muted-foreground font-medium">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
