// components/AuthLayout.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AuthImage from "../../images/auth.png";

const AuthLayout = ({ children, title, subtitle }) => {
  const navigate = useNavigate();

  useEffect(() => {
    // Allow access to auth pages (login/signup) without token check
    const currentPath = window.location.pathname;
    const authPaths = ['/login', '/signup', '/signuppage', '/forgotpassword', '/sendotp'];
    
    if (authPaths.includes(currentPath)) {
      return; // Allow access to auth pages
    }

    const token = localStorage.getItem("token");
    // For other pages, redirect to login if no token
    if (!token) {
      navigate("/login");
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-white relative">
      {/* Logo */}
      <div className="absolute top-10 left-4 md:left-20">
        <h1 className="text-base md:text-lg font-bold">CreativeCollab</h1>
      </div>

      <div className="flex flex-col md:flex-row w-full max-w-4xl mx-auto h-full items-center">
        {/* Left Side */}
        <div className="hidden md:flex w-1/2 flex-col items-start justify-center p-6 mr-12">
          <h1 className="text-blue-600 font-bold mb-1 text-left text-lg w-72">
            Creative Collab - Image Synthesis Platform
          </h1>
          <p className="text-gray-500 mb-4 text-xs text-left">
            AI-Powered Design Platform
          </p>
          <img
            src={AuthImage}
            onContextMenu={(e) => e.preventDefault()}
            alt="Creative Home"
            className="w-[300px] h-[300px] object-contain"
          />
        </div>

        {/* Right Side (Dynamic Content) */}
        <div className="w-full md:w-1/2 p-6 flex flex-col items-start">
          <h2 className="text-blue-600 text-lg font-semibold mb-1">{title}</h2>
          <p className="mb-4 text-gray-600 text-xs">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
