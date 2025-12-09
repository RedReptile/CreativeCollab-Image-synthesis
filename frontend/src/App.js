// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Pages
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import ForgotPasswordPage from "./pages/auth/ForgotPassword";
import HomePage from "./pages/dashboard/HomePage";
import APITestPage from "./pages/apitest/APITest.js";
import Profile from "./pages/profile/ProfilePage.js";
import ImageSynthesis from "./main_pages/ImageSynthesis";
import ArtisticFilter from "./main_pages/ArtisticFilter";
import PaymentApp from "./payment/App";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgotpassword" element={<ForgotPasswordPage />} />
        <Route path="/homepage" element={<HomePage />} />
        <Route path="/imagesynthesis" element={<ImageSynthesis />} />
        <Route path="/artisticfilter" element={<ArtisticFilter />} />
        <Route path="/apitest" element={<APITestPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/payment/*" element={<PaymentApp />} />
      </Routes>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </Router>
  );
}

export default App;
