// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Pages
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import ForgotPasswordPage from "./pages/auth/ForgotPassword";
import SendOtp from "./pages/auth/SendOtp";
import HomePage from "./pages/dashboard/HomePage";
import APITestPage from "./pages/apitest/APITest.js";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgotpassword" element={<ForgotPasswordPage />} />
        <Route path="/sendotp" element={<SendOtp />} />
        <Route path="/homepage" element={<HomePage />} />
        <Route path="/apitest" element={<APITestPage />} />
      </Routes>
    </Router>
  );
}

export default App;
