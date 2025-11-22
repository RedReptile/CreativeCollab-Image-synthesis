import React, { useState } from "react";
import { FaEnvelope, FaLock, FaUser } from "react-icons/fa";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import AuthLayout from "../components/AuthLayout";

import { auth, db } from "../../firebase";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

const SignupPage = () => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email/Password Signup
  const handleSignup = async () => {
    if (password !== confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        fullName,
        email,
        createdAt: new Date(),
      });

      toast.success("Signup successful! Redirecting to login...");
      navigate("/");
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  };

  // Google Signup
  const handleGoogleSignup = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      await setDoc(
        doc(db, "users", user.uid),
        {
          fullName: user.displayName || "",
          email: user.email,
          photoURL: user.photoURL || "",
          createdAt: new Date(),
        },
        { merge: true }
      );

      toast.success("Login successful!");
      navigate("/home");
    } catch (error) {
      console.error("Google Signup Error:", error);
      toast.error(error.message);
    }
  };

  return (
    <AuthLayout
      title="Sign Up"
      subtitle="Create your new account to get started."
    >
      {/* Full Name */}
      <div className="relative w-full mb-4">
        <span className="absolute left-2 bottom-2 text-gray-400 text-sm">
          <FaUser />
        </span>
        <input
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full border-b border-blue-600 py-1.5 pl-8 pr-2 text-xs outline-none"
        />
      </div>

      {/* Email */}
      <div className="relative w-full mb-4">
        <span className="absolute left-2 bottom-2 text-gray-400 text-sm">
          <FaEnvelope />
        </span>
        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border-b border-blue-600 py-1.5 pl-8 pr-2 text-xs outline-none"
        />
      </div>

      {/* Password */}
      <div className="relative w-full mb-4">
        <span className="absolute left-2 bottom-2 text-gray-400 text-sm">
          <FaLock />
        </span>
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
      <div className="relative w-full mb-4">
        <span className="absolute left-2 bottom-2 text-gray-400 text-sm">
          <FaLock />
        </span>
        <input
          type={showConfirmPassword ? "text" : "password"}
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
      <label className="flex items-center text-xs mb-4">
        <input type="checkbox" className="mr-1 " /> I agree to the Terms &
        Conditions
      </label>

      {/* Signup Button */}
      <button
        onClick={handleSignup}
        className="w-full bg-blue-600 text-white py-2 rounded-md text-xs font-semibold shadow hover:bg-blue-700 transition mb-3"
      >
        Sign Up
      </button>

      {/* Divider */}
      <div className="flex items-center my-2 text-xs w-full pb-3">
        <div className="flex-grow border-t"></div>
        <span className="mx-2 text-gray-400">Or sign up with</span>
        <div className="flex-grow border-t"></div>
      </div>

      {/* Google Signup */}
      <button
        onClick={handleGoogleSignup}
        className="w-full flex items-center justify-center border py-1.5 rounded-md text-xs hover:bg-black hover:text-white bg-gray-50 text-black"
      >
        <img
          src="https://www.svgrepo.com/show/355037/google.svg"
          alt="Google"
          className="w-4 h-6 mr-2"
        />
        <span>Continue with Google</span>
      </button>

      {/* Login Link */}
      <div className="w-full text-center mt-3 text-xs">
        <span className="text-gray-600">Already have an account? </span>
        <Link
          to="/"
          className="text-blue-600 font-semibold hover:underline"
        >
          Log in
        </Link>
      </div>
    </AuthLayout>
  );
};

export default SignupPage;
