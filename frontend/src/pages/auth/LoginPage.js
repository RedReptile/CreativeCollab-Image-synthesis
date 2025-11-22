import React, { useState } from "react";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import AuthLayout from "../components/AuthLayout";
import { auth, db } from "../../firebase";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // --------------------------
  // EMAIL LOGIN
  // --------------------------
  const handleLogin = async () => {
    if (!email || !password) {
      toast.error("Please enter both email and password!");
      return;
    }

    try {
      setLoading(true);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        console.log("User profile:", userDoc.data());
      }

      toast.success("Logged in successfully!");
      navigate("/homepage");

    } catch (error) {
      console.error("Login error:", error);
      toast.error(error.message || "Login failed!");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------
  // GOOGLE LOGIN
  // --------------------------
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

      toast.success("Logged in with Google! 🎉");
      navigate("/homepage");

    } catch (error) {
      console.error("Google Signup Error:", error);
      toast.error(error.message || "Google login failed!");
    }
  };

  return (
    <AuthLayout title="Login" subtitle="Welcome back! Please login to your account.">

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

      {/* Password */}
      <div className="relative w-full mb-4">
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

      {/* Remember + Forgot */}
      <div className="flex justify-between w-full text-xs mb-4">
        <label>
          <input type="checkbox" className="mr-1" /> Remember Me
        </label>
        <Link to="/forgotpassword" className="text-blue-600 hover:underline">
          Forgot Password?
        </Link>
      </div>

      {/* Login Button */}
      <button
        onClick={handleLogin}
        disabled={loading}
        className={`w-full bg-blue-600 text-white py-2 rounded-md text-xs font-semibold shadow hover:bg-blue-700 transition mb-3 ${
          loading ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        {loading ? "Logging in..." : "Login"}
      </button>

      {/* Divider */}
      <div className="flex items-center my-2 text-[11px] w-full pb-3">
        <div className="flex-grow border-t"></div>
        <span className="mx-1 text-gray-400">Or</span>
        <div className="flex-grow border-t"></div>
      </div>

      {/* Google Login */}
      <button
        onClick={handleGoogleSignup}
        className="w-full flex items-center justify-center border py-1.5 rounded-md text-xs hover:bg-gray-50"
      >
        <img
          src="https://www.svgrepo.com/show/355037/google.svg"
          alt="Google"
          className="w-3.5 h-3.5 mr-1"
        />
        <span>Google</span>
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

export default LoginPage;
