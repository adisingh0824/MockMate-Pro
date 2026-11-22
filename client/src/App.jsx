import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Loader from './components/Loader';

const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Register = lazy(() => import('./pages/Register'));
const VerifyOtp = lazy(() => import('./pages/VerifyOtp'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const RoleSelect = lazy(() => import('./pages/RoleSelect'));
const PracticeSelect = lazy(() => import('./pages/PracticeSelect'));
const Session = lazy(() => import('./pages/Session'));
const FeedBack = lazy(() => import('./pages/Feedback'));
const History = lazy(() => import('./pages/History'));
const CompanyPrep = lazy(() => import('./pages/CompanyPrep'));
const Premium = lazy(() => import('./pages/Premium'));
const Profile = lazy(() => import('./pages/Profile'));
const Home = lazy(() => import('./pages/Home'));
const InterviewSetup = lazy(() => import('./pages/InterviewSetup'));
const LiveInterview = lazy(() => import('./pages/LiveInterview'));

const App = () => (
  <AuthProvider>
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: { fontFamily: 'Inter, sans-serif', fontSize: 14, borderRadius: 10 },
      }}
    />
    <Suspense fallback={<Loader text="Loading MockMate Pro..." />}>
      <Routes>
        <Route path="/"                element={<Home />} />
        <Route path="/login"           element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/register"        element={<Register />} />
        <Route path="/verify-otp"      element={<VerifyOtp />} />

        <Route path="/dashboard"       element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/role-select"     element={<ProtectedRoute><RoleSelect /></ProtectedRoute>} />
        <Route path="/practice-select" element={<ProtectedRoute><PracticeSelect /></ProtectedRoute>} />
        <Route path="/session/:id"     element={<ProtectedRoute><Session /></ProtectedRoute>} />
        <Route path="/feedback/:id"    element={<ProtectedRoute><FeedBack /></ProtectedRoute>} />
        <Route path="/history"         element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/company-prep"    element={<ProtectedRoute><CompanyPrep /></ProtectedRoute>} />
        <Route path="/premium"         element={<ProtectedRoute><Premium /></ProtectedRoute>} />
        <Route path="/profile"         element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* ── Live AI Interview routes ── */}
        <Route path="/interview-setup"        element={<ProtectedRoute><InterviewSetup /></ProtectedRoute>} />
        <Route path="/live-interview/:id"     element={<ProtectedRoute><LiveInterview /></ProtectedRoute>} />

        <Route path="*" element={<Home />} />
      </Routes>
    </Suspense>
  </AuthProvider>
);

export default App;
