import React, { useState } from "react";
import { FaEnvelope, FaLock, FaUser } from "react-icons/fa";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import SignupPageImage from "../../images/auth.png";
import { Link } from "react-router-dom";

const SignupPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  return (
    <div className="min-h-screen bg-white relative">
      {/* Logo */}
      <div className="absolute top-10 left-4 md:left-20">
        <h1 className="text-base md:text-lg font-bold">CreativeCollab</h1>
      </div>

      <div className="flex flex-col md:flex-row w-full max-w-4xl mx-auto h-full items-center">
        {/* Left Side (Image + Info) */}
        <div className="hidden md:flex w-1/2 flex-col items-start justify-center p-6 mr-12">
          <h1 className="text-blue-600 font-bold mb-1 text-left text-lg w-72">
            Creative Collab - Image Synthesis Platform
          </h1>
          <p className="text-gray-500 mb-4 text-xs text-left">
            AI-Powered Design Platform
          </p>
          <img
            src={SignupPageImage}
            alt="Creative Home"
            className="w-[300px] h-[300px] object-contain"
          />
        </div>

        {/* Right Side (Form) */}
        <div className="w-full md:w-1/2 p-6 flex flex-col items-start">
          <h2 className="text-blue-600 text-lg font-bold mb-2">Sign Up</h2>
          <p className="mb-4 text-gray-600 text-xs">
            Create your new account to get started.
          </p>

          {/* Full Name Input */}
          <div className="relative w-full mb-2">
            <span className="absolute left-2 bottom-3 text-gray-400">
              <FaUser />
            </span>
            <input
              type="text"
              placeholder="Full Name"
              className="w-full border-b-2 border-blue-600 py-2 pl-8 pr-2 text-xs outline-none pt-4"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Email Input */}
          <div className="relative w-full mb-2">
            <span className="absolute left-2 bottom-3 text-gray-400">
              <FaEnvelope />
            </span>
            <input
              type="email"
              placeholder="Email Address"
              className="w-full border-b-2 border-blue-600 py-2 pl-8 pr-2 text-xs outline-none pt-4"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password Input */}
          <div className="relative w-full mb-2">
            <span className="absolute left-2 bottom-3 text-gray-400">
              <FaLock />
            </span>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full border-b-2 border-blue-600 py-2 pl-8 pr-8 text-xs outline-none pt-4"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span
              className="absolute right-2 bottom-3 text-gray-400 cursor-pointer"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
            </span>
          </div>

          {/* Confirm Password Input */}
          <div className="relative w-full mb-2">
            <span className="absolute left-2 bottom-3 text-gray-400">
              <FaLock />
            </span>
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm Password"
              className="w-full border-b-2 border-blue-600 py-2 pl-8 pr-8 text-xs outline-none pt-4"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <span
              className="absolute right-2 bottom-3 text-gray-400 cursor-pointer"
              onClick={() =>
                setShowConfirmPassword(!showConfirmPassword)
              }
            >
              {showConfirmPassword ? (
                <AiOutlineEyeInvisible />
              ) : (
                <AiOutlineEye />
              )}
            </span>
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between mb-3 text-xs w-full pt-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="mr-1"
              />
              I agree to the Terms & Conditions
            </label>
          </div>

          {/* Signup Button */}
          <a
            href="/dashboard"
            className="w-full bg-blue-600 text-white py-2 rounded text-xs font-bold shadow hover:bg-blue-700 transition mb-3 text-center"
          >
            Sign Up
          </a>

          {/* Divider */}
          <div className="flex items-center my-2 text-xs w-full pb-4">
            <div className="flex-grow border-t"></div>
            <span className="mx-2 text-gray-400">Or sign up with</span>
            <div className="flex-grow border-t"></div>
          </div>

          {/* Google Signup */}
          <button className="w-full flex items-center justify-center border py-2 rounded text-xs hover:bg-gray-50">
            <img
              src="https://www.svgrepo.com/show/355037/google.svg"
              alt="Google"
              className="w-4 h-4 mr-2"
            />
            <span>Google</span>
          </button>

          {/* Login Link */}
          <div className="w-full text-center mt-3 text-xs">
            <span className="text-gray-600">Already have an account? </span>
            <Link
              to="/login"
              className="text-blue-600 font-bold hover:underline"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
