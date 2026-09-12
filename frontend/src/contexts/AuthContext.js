import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import i18n from '@/i18n';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('selectedFarmId');
  delete axios.defaults.headers.common['Authorization'];
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = axios.interceptors.response.use(
      (res) => res,
      (error) => {
        const url = error.config?.url || '';
        if (error.response?.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/register')) {
          clearSession();
          setToken(null);
          setUser(null);
          sessionStorage.setItem('sessionExpired', '1');
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        if (parsed.language && !localStorage.getItem('language')) i18n.changeLanguage(parsed.language);
      }
    }
    setLoading(false);
  }, [token]);

  const login = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setToken(token);
    setUser(user);
  };

  const logout = () => {
    clearSession();
    setToken(null);
    setUser(null);
  };

  const updateUser = (patch) => {
    const next = { ...user, ...patch };
    localStorage.setItem('user', JSON.stringify(next));
    setUser(next);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
