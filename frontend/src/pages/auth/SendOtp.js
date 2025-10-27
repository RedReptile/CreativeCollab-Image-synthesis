import React from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";

const SendOtp = () => {
  return (
    <AuthLayout
      title="Verify OTP"
      subtitle="Enter the 6-digit code we sent to your email address."
    >
      {/* OTP Inputs */}
      <div className="flex justify-center gap-6 w-full my-4">
        {[...Array(6)].map((_, i) => (
          <input
            key={i}
            type="text"
            maxLength={1}
            className="w-10 h-12 text-center text-lg border-2 border-blue-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        ))}
      </div>

      {/* Verify OTP */}
      <Link
        to="/login"
        className="w-full bg-blue-600 text-white py-2 rounded-md text-xs font-semibold shadow hover:bg-blue-700 transition mb-3 text-center"
      >
        Verify OTP
      </Link>

      {/* Resend */}
      <div className="w-full mt-2 text-xs flex justify-between">
        <span className="text-gray-600">Didn't receive the code?</span>
        <button className="text-blue-600 font-semibold hover:underline">
          Resend OTP
        </button>
      </div>

      {/* Signup Link */}
      <div className="w-full text-center mt-8 text-xs">
        <span className="text-gray-600">Don't have an account? </span>
        <Link to="/signup" className="text-blue-600 font-semibold hover:underline">
          Sign up
        </Link>
      </div>
    </AuthLayout>
  );
};

export default SendOtp;
