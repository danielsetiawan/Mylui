import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

type AuthMode = 'login' | 'register';

export function Login() {
  const { signIn, signUp, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Already signed in → go straight to the dashboard
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error('Sign in failed: ' + (error.message === 'Invalid login credentials' ? 'wrong email or password' : error.message));
      } else {
        toast.success('Welcome back! 👋');
        navigate('/', { replace: true });
      }
    } else {
      if (!fullName.trim()) {
        toast.error('Please enter your full name');
        setLoading(false);
        return;
      }
      if (password.length < 8) {
        toast.error('Password must be at least 8 characters');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName);
      if (error) {
        toast.error('Sign up failed: ' + error.message);
      } else {
        toast.success('Account created! Check your email to confirm it.');
        setMode('login');
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="/logo.png" alt="MyLui Logo" className="w-16 h-16 rounded-2xl shadow-lg shadow-primary/20" />
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tight">MyLui</h1>
            <p className="text-sm text-muted-foreground mt-1">Track your income, expenses and budget plans</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-3xl shadow-xl overflow-hidden">
          {/* Mode Toggle */}
          <div className="flex p-2 bg-accent/40 border-b border-border">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all ${mode === 'login' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all ${mode === 'register' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.div
                  key="fullname"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pb-1">
                    <label className="text-xs font-bold text-muted-foreground">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your name"
                        className="w-full bg-field border-none rounded-2xl py-3 pl-11 pr-4 font-medium outline-none focus:ring-2 ring-primary/20"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-field border-none rounded-2xl py-3 pl-11 pr-4 font-medium outline-none focus:ring-2 ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                  required
                  className="w-full bg-field border-none rounded-2xl py-3 pl-11 pr-11 font-medium outline-none focus:ring-2 ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-3.5 rounded-2xl font-black text-base transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-border"></div>
              <span className="flex-shrink-0 mx-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Or</span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                const { error } = await signInWithGoogle();
                if (error) {
                  toast.error('Google sign in failed: ' + error.message);
                  setLoading(false);
                }
              }}
              className="w-full bg-card border border-border text-foreground py-3.5 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all hover:bg-accent/50 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </form>

          <div className="px-6 pb-6 text-center">
            <p className="text-xs text-muted-foreground">
              You stay signed in for{' '}
              <span className="font-bold text-foreground">14 days</span>
              {' '}— your data is stored securely and encrypted.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
