import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('safipoints_user')); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const saveSession = (token, userData) => {
    localStorage.setItem('safipoints_token', token);
    localStorage.setItem('safipoints_user', JSON.stringify(userData));
    setUser(userData);
  };

  const registerMerchant = useCallback(async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/merchant/register', data);
      saveSession(res.data.token, { ...res.data.merchant, role: 'merchant' });
      return res.data;
    } finally { setLoading(false); }
  }, []);

  const loginMerchant = useCallback(async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/merchant/login', data);
      saveSession(res.data.token, { ...res.data.merchant, role: 'merchant' });
      return res.data;
    } finally { setLoading(false); }
  }, []);

  const registerCustomer = useCallback(async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/customer/register', data);
      saveSession(res.data.token, { ...res.data.customer, role: 'customer' });
      return res.data;
    } finally { setLoading(false); }
  }, []);

  const loginCustomer = useCallback(async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/customer/login', data);
      saveSession(res.data.token, { ...res.data.customer, role: 'customer' });
      return res.data;
    } finally { setLoading(false); }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('safipoints_token');
    localStorage.removeItem('safipoints_user');
    setUser(null);
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('safipoints_token');
    if (!token) { setUser(null); }
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, loading,
      registerMerchant, loginMerchant,
      registerCustomer, loginCustomer,
      logout,
      isAuthenticated: !!user,
      isMerchant: user?.role === 'merchant',
      isCustomer: user?.role === 'customer',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
