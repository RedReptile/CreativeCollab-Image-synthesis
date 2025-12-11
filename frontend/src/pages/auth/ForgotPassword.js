import React, { useState } from "react";
import { FaEnvelope } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import AuthLayout from "../components/AuthLayout";
import { auth } from "../../firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import LoginPage from "./LoginPage";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Please enter your email address!");
      return;
    }

    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address!");
      return;
    }

    try {
      setLoading(true);
      
      // Check if user exists by trying to send password reset email
      // This will fail if email doesn't exist
      await sendPasswordResetEmail(auth, email);
      
      // Generate 6-digit OTP
      const otp = generateOTP();
      
      // Store OTP in localStorage with expiration (10 minutes)
      // Using localStorage instead of Firestore to avoid permission issues
      const otpData = {
        otp: otp,
        email: email,
        createdAt: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        used: false
      };
      localStorage.setItem(`passwordResetOTP_${email}`, JSON.stringify(otpData));
      
      // Store email in localStorage for SendOtp page
      localStorage.setItem("resetPasswordEmail", email);
      
      // In production, you would send the OTP via email here
      // For now, we'll show it in console and toast (remove in production)
      console.log("OTP for", email, ":", otp);
      toast.info(`OTP sent to ${email}.`);
      
      // Navigate to OTP verification page
      navigate("/login");
    } catch (error) {
      console.error("Error sending OTP:", error);
      if (error.code === "auth/user-not-found") {
        toast.error("No account found with this email address.");
      } else {
        toast.error(error.message || "Failed to send OTP. Please try again.");
      }
    } finally {
      setLoading(false);
    }
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

      {/* Login */}
      <button
        onClick={handleSendOtp}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-md text-xs font-semibold shadow hover:bg-blue-700 transition mb-3 text-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Sending Link ..." : "Send Link"}
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
