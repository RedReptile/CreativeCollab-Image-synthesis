import React, { useState } from "react";
import { FaEnvelope } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import AuthLayout from "../components/AuthLayout";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendOtp = (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Please enter your email address!");
      return;
    }

    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address!");
      return;
    }

    // If validation passes, navigate to send OTP page
    navigate("/sendotp");
  };

  return (
    <AuthLayout
      title="Forgot Password?"
      subtitle="Verify your email to reset your password."
    >
      {/* Email */}
      <div className="relative w-full mb-4">
        <span className="absolute left-2 bottom-2 text-gray-400 text-sm">
          <FaEnvelope />
        </span>
        <input
          type="email"
          placeholder="Email Address"
          className="w-full border-b border-blue-600 py-1.5 pl-8 pr-2 text-xs outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {/* Send OTP */}
      <button
        onClick={handleSendOtp}
        className="w-full bg-blue-600 text-white py-2 rounded-md text-xs font-semibold shadow hover:bg-blue-700 transition mb-3 text-center"
      >
        Send OTP
      </button>

      {/* Signup Link */}
      <div className="w-full text-center mt-3 text-xs">
        <span className="text-gray-600">Don't have an account? </span>
        <Link to="/signup" className="text-blue-600 font-semibold hover:underline">
          Sign up
        </Link>
      </div>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
