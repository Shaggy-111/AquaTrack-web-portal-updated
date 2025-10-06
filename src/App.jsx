import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthScreen from './pages/AuthScreen';
import SuperAdminDashboard from './SuperAdminDashboard';
import LoginScreen from './pages/LoginScreen'; // We still need this file for the component definition
import PartnerDashboard from './PartnerDashboard'; 

const App = () => {
  return (
    <Routes>
      {/* Route for the role selection screen (optional, if you want to keep it accessible) */}
      <Route path="/roles" element={<LoginScreen />} /> 
      
      {/* 1. MAKE AUTH SCREEN THE DEFAULT HOME PAGE (SS1) */}
      <Route path="/" element={<Navigate to="/login/superadmin" replace />} /> 
      
      {/* 2. THE ACTUAL LOGIN FORM ROUTE (SS1) */}
      <Route path="/login/:role" element={<AuthScreen />} />
      
      {/* 3. DASHBOARD ROUTE */}
      <Route path="/dashboard/superadmin" element={<SuperAdminDashboard />} />
      <Route path="/dashboard/partner" element={<PartnerDashboard />} />
    </Routes>
  );
};

export default App;