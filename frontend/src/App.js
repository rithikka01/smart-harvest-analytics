import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FarmProvider } from "@/contexts/FarmContext";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Weather from "@/pages/Weather";
import CropHealth from "@/pages/CropHealth";
import YieldPrediction from "@/pages/YieldPrediction";
import Irrigation from "@/pages/Irrigation";
import Chatbot from "@/pages/Chatbot";
import Alerts from "@/pages/Alerts";
import Schemes from "@/pages/Schemes";
import FarmSetup from "@/pages/FarmSetup";
import Settings from "@/pages/Settings";
import Analytics from "@/pages/Analytics";
import CropRecommend from "@/pages/CropRecommend";
import Fertilizer from "@/pages/Fertilizer";
import MobileNav from "@/components/MobileNav";
import TopNav from "@/components/TopNav";

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-pulse text-primary text-xl">Loading...</div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" />;
};

const AppContent = () => {
  const { user } = useAuth();

  return (
    <div className="App">
      {user && <TopNav />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
        <Route path="/farm-setup" element={<PrivateRoute><FarmSetup /></PrivateRoute>} />
        <Route path="/farm-setup/:farmId" element={<PrivateRoute><FarmSetup /></PrivateRoute>} />
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/weather" element={<PrivateRoute><Weather /></PrivateRoute>} />
        <Route path="/crop-health" element={<PrivateRoute><CropHealth /></PrivateRoute>} />
        <Route path="/yield" element={<PrivateRoute><YieldPrediction /></PrivateRoute>} />
        <Route path="/irrigation" element={<PrivateRoute><Irrigation /></PrivateRoute>} />
        <Route path="/chatbot" element={<PrivateRoute><Chatbot /></PrivateRoute>} />
        <Route path="/alerts" element={<PrivateRoute><Alerts /></PrivateRoute>} />
        <Route path="/schemes" element={<PrivateRoute><Schemes /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
        <Route path="/crop-recommend" element={<PrivateRoute><CropRecommend /></PrivateRoute>} />
        <Route path="/fertilizer" element={<PrivateRoute><Fertilizer /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      {user && <MobileNav />}
      <Toaster position="top-center" />
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FarmProvider>
          <AppContent />
        </FarmProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
