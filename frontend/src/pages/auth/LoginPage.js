import React, { useState } from "react";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import LoginPageImage from "../../images/auth.png";
import { Link } from "react-router-dom";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
            src={LoginPageImage}
            alt="Creative Home"
            className="w-[300px] h-[300px] object-contain"
          />
        </div>

        {/* Right Side (Form) */}
        <div className="w-full md:w-1/2 p-4 flex flex-col items-start">
          <h2 className="text-blue-600 text-lg font-semibold mb-1">Login</h2>
          <p className="mb-3 text-gray-600 text-xs">
            Welcome back! Please login to your account.
          </p>

          {/* Email Input */}
          <div className="relative w-full mb-2 mt-3">
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

          {/* Password Input */}
          <div className="relative w-full mb-2 mt-3">
            <span className="absolute left-2 bottom-2 text-gray-400 text-sm">
              <FaLock />
            </span>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full border-b border-blue-600 py-1.5 pl-8 pr-2 text-xs outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span
              className="absolute right-2 bottom-2 text-gray-400 cursor-pointer text-sm"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
            </span>
          </div>

          {/* Remember Me + Forgot Password */}
          <div className="flex items-center justify-between mb-3 text-[11px] w-full pt-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="mr-1 w-3 h-3"
              />
              Remember Me
            </label>

            <button
              type="button"
              className="text-gray-500 hover:underline hover:text-blue-700 bg-transparent border-none p-0"
              onClick={() => (window.location.href = "./forgotpassword")}
            >
              Forgot Password?
            </button>
          </div>

          {/* Login Button */}
          <a
            href="/dashboard"
            className="w-full bg-blue-600 text-white py-2 rounded-md text-xs font-semibold shadow hover:bg-blue-700 transition mb-3 text-center"
          >
            Login
          </a>

          {/* Divider */}
          <div className="flex items-center my-2 text-[11px] w-full pb-3">
            <div className="flex-grow border-t"></div>
            <span className="mx-1 text-gray-400">Or</span>
            <div className="flex-grow border-t"></div>
          </div>

          {/* Google Button */}
          <button className="w-full flex items-center justify-center border py-1.5 rounded-md text-xs hover:bg-gray-50">
            <img
              src="https://www.svgrepo.com/show/355037/google.svg"
              alt="Google"
              className="w-3.5 h-3.5 mr-1"
            />
            <span>Google</span>
          </button>

          {/* Sign Up Link */}
          <div className="w-full text-center mt-3 text-xs">
            <span className="text-gray-600">Don't have an account? </span>
            <Link
              to="/signup"
              className="text-blue-600 font-semibold hover:underline"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
