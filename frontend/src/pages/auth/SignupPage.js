import React, { useState } from "react";
import { FaEnvelope, FaLock, FaUser } from "react-icons/fa";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";

const SignupPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <AuthLayout title="Sign Up" subtitle="Create your new account to get started.">
      {/* Full Name */}
      <div className="relative w-full mb-3">
        <span className="absolute left-2 bottom-2 text-gray-400 text-sm">
          <FaUser />
        </span>
        <input
          type="text"
          placeholder="Full Name"
          className="w-full border-b border-blue-600 py-1.5 pl-8 pr-2 text-xs outline-none"
        />
      </div>

      {/* Email */}
      <div className="relative w-full mb-3">
        <span className="absolute left-2 bottom-2 text-gray-400 text-sm">
          <FaEnvelope />
        </span>
        <input
          type="email"
          placeholder="Email Address"
          className="w-full border-b border-blue-600 py-1.5 pl-8 pr-2 text-xs outline-none"
        />
      </div>

      {/* Password */}
      <div className="relative w-full mb-3">
        <span className="absolute left-2 bottom-2 text-gray-400 text-sm">
          <FaLock />
        </span>
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          className="w-full border-b border-blue-600 py-1.5 pl-8 pr-2 text-xs outline-none"
        />
        <span
          className="absolute right-2 bottom-2 text-gray-400 cursor-pointer text-sm"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
        </span>
      </div>

      {/* Confirm Password */}
      <div className="relative w-full mb-3">
        <span className="absolute left-2 bottom-2 text-gray-400 text-sm">
          <FaLock />
        </span>
        <input
          type={showConfirmPassword ? "text" : "password"}
          placeholder="Confirm Password"
          className="w-full border-b border-blue-600 py-1.5 pl-8 pr-2 text-xs outline-none"
        />
        <span
          className="absolute right-2 bottom-2 text-gray-400 cursor-pointer text-sm"
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
        >
          {showConfirmPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
        </span>
      </div>

      {/* Terms */}
      <label className="flex items-center text-xs mb-3">
        <input type="checkbox" className="mr-1" /> I agree to the Terms &
        Conditions
      </label>

      {/* Signup Button */}
      <Link
        to="/dashboard"
        className="w-full bg-blue-600 text-white py-2 rounded-md text-xs font-semibold shadow hover:bg-blue-700 transition mb-3 text-center"
      >
        Sign Up
      </Link>

      {/* Divider */}
      <div className="flex items-center my-2 text-xs w-full pb-3">
        <div className="flex-grow border-t"></div>
        <span className="mx-2 text-gray-400">Or sign up with</span>
        <div className="flex-grow border-t"></div>
      </div>

      {/* Google Signup */}
      <button className="w-full flex items-center justify-center border py-1.5 rounded-md text-xs hover:bg-black hover:text-white bg-gray-50 text-black">
        <img
          src="https://www.svgrepo.com/show/355037/google.svg"
          alt="Google"
          className="w-4 h-6 mr-2"
        />
        <span>Google</span>
      </button>

      {/* Login Link */}
      <div className="w-full text-center mt-3 text-xs">
        <span className="text-gray-600">Already have an account? </span>
        <Link to="/login" className="text-blue-600 font-semibold hover:underline">
          Log in
        </Link>
      </div>
    </AuthLayout>
  );
};

export default SignupPage;
