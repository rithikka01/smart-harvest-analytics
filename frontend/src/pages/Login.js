import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Sprout, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@/i18n';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (sessionStorage.getItem('sessionExpired')) {
      sessionStorage.removeItem('sessionExpired');
      toast.error(t('common.session_expired'), { duration: 8000 });
    }
  }, [t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        email,
        password,
      });

      login(response.data.token, response.data.user);
      toast.success('Welcome back!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div
        className="hidden md:flex md:w-1/2 bg-cover bg-center relative"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1628179148156-d9cfac053d6f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwxfHxpbmRpYW4lMjBmYXJtZXIlMjBpbiUyMGdyZWVuJTIwZmllbGQlMjB1c2luZyUyMHNtYXJ0cGhvbmV8ZW58MHx8fHwxNzcwNTY4OTQwfDA&ixlib=rb-4.1.0&q=85)'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70"></div>
        <div className="relative z-10 p-12 flex flex-col justify-center text-white">
          <h1 className="font-heading text-5xl font-bold mb-4">AgriSmart</h1>
          <p className="text-xl opacity-90">Smart farming for better yields</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary text-white mb-4">
              <Sprout className="w-8 h-8" />
            </div>
            <h2 className="font-heading text-3xl font-bold text-foreground">{t('auth.welcome_back')}</h2>
            <p className="mt-2 text-muted-foreground">{t('auth.sign_in_hint')}</p>
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="mt-3 h-9 rounded-full border bg-background px-3 text-sm"
              data-testid="login-language-select"
            >
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="email">Email or Mobile</Label>
              <Input
                id="email"
                type="email"
                placeholder="farmer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
                data-testid="login-email-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12"
                data-testid="login-password-input"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full font-bold shadow-lg hover:shadow-xl transition-all active:scale-95"
              data-testid="login-submit-button"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t('auth.signing_in')}
                </>
              ) : (
                t('auth.sign_in')
              )}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-muted-foreground">
              {t('auth.no_account')}{' '}
              <Link to="/register" className="text-primary font-semibold hover:underline" data-testid="register-link">
                {t('auth.register_here')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;