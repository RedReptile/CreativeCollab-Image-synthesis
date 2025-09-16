import React, { useState } from "react";
import { FaEnvelope } from "react-icons/fa";
import ForogtPasswordImage from "../../images/auth.png";
import { Link } from "react-router-dom";

const ForogtPasswordPage = () => {
  const [email, setEmail] = useState("");

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
            src={ForogtPasswordImage}
            alt="Creative Home"
            className="w-[300px] h-[300px] object-contain"
          />
        </div>

        {/* Right Side (Form) */}
        <div className="w-full md:w-1/2 p-4 flex flex-col items-start">
          <h2 className="text-blue-600 text-lg font-semibold mb-1">Forogt Password?</h2>
          <p className="mb-3 text-gray-600 text-xs">
            Verify your email to reset your password.
          </p>

          {/* Email Input */}
          <div className="relative w-full mb-5 mt-3">
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

          {/* Login Button */}
          <a
            href="/dashboard"
            className="w-full bg-blue-600 text-white py-2 rounded-md text-xs font-semibold shadow hover:bg-blue-700 transition mb-3 text-center"
          >
            Send OTP
          </a>

          {/* Divider */}
          <div className="flex items-center my-2 text-[11px] w-full pb-3">
            <div className="flex-grow border-t"></div>
            <span className="mx-1 text-gray-400">Or</span>
            <div className="flex-grow border-t"></div>
          </div>

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

export default ForogtPasswordPage;
