import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import MerchantDashboard from './pages/MerchantDashboard';
import MerchantMenu from './pages/MerchantMenu';
import MerchantQR from './pages/MerchantQR';
import CustomerWallet from './pages/CustomerWallet';
import Transactions from './pages/Transactions';
import RedeemPage from './pages/RedeemPage';
import ClaimPage from './pages/ClaimPage';
import MenuPage from './pages/MenuPage';
import PayPage from './pages/PayPage';
import OrderSuccess from './pages/OrderSuccess';
import CreditDashboard from './pages/CreditDashboard';
import LenderPortal from './pages/LenderPortal';
import './App.css';

function ProtectedRoute({ children, role }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (role && user?.role !== role) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { isAuthenticated, isMerchant } = useAuth();

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to={isMerchant ? '/dashboard' : '/wallet'} /> : <Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={
        <ProtectedRoute role="merchant"><Layout><MerchantDashboard /></Layout></ProtectedRoute>
      } />
      <Route path="/menu" element={
        <ProtectedRoute role="merchant"><Layout><MerchantMenu /></Layout></ProtectedRoute>
      } />
      <Route path="/qr-code" element={
        <ProtectedRoute role="merchant"><Layout><MerchantQR /></Layout></ProtectedRoute>
      } />
      <Route path="/wallet" element={
        <ProtectedRoute role="customer"><Layout><CustomerWallet /></Layout></ProtectedRoute>
      } />
      <Route path="/transactions" element={
        <ProtectedRoute><Layout><Transactions /></Layout></ProtectedRoute>
      } />
      <Route path="/redeem" element={
        <ProtectedRoute role="customer"><Layout><RedeemPage /></Layout></ProtectedRoute>
      } />
      {/* ── SafiScore routes ────────────────────────────────────────── */}
      <Route path="/credit" element={
        <ProtectedRoute role="customer"><Layout><CreditDashboard /></Layout></ProtectedRoute>
      } />
      {/* Public: lender verification portal — also accessible at /verify/:id from share links */}
      <Route path="/lender"          element={<LenderPortal />} />
      <Route path="/verify/:attestationId" element={<LenderPortal />} />
      {/* ── Public routes (no auth) ─────────────────────── */}
      {/* Customer ordering journey: scan QR → menu → pay → success → claim */}
      <Route path="/m/:slug" element={<MenuPage />} />
      <Route path="/pay/:orderId" element={<PayPage />} />
      <Route path="/order-success/:orderId" element={<OrderSuccess />} />
      <Route path="/claim/:pendingId" element={<ClaimPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
