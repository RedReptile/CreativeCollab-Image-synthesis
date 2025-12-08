import React, { useEffect, useState } from "react";
import {
  FaUser,
  FaEnvelope,
  FaCalendarAlt,
  FaCreditCard,
  FaSignOutAlt,
  FaCrown,
} from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";  
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { toast } from "react-toastify";

const ProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          } else {
            setUserData({
              fullName: currentUser.displayName || "User",
              email: currentUser.email || "",
              photoURL: currentUser.photoURL || "",
              subscriptionTier: "free",
            });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          toast.error("Failed to load user information");
        } finally {
          setLoading(false);
        }
      } else {
        navigate("/login");
        toast.error("Please log in to view your profile");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin mb-3"></div>
          <div className="text-sm text-gray-600">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (!user || !userData) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout. Please try again.");
    }
  };

  const subscriptionTier = userData.subscriptionTier || "free";
  const isSubscribed =
    subscriptionTier === "subscription" || subscriptionTier === "premium";

  return (
    <div className="min-h-screen bg-white">
      
      {/* Header */}
      <header className="text-black px-20 py-10 flex items-center justify-between">
        <Link to="/homepage" className="text-lg font-bold">
          CreativeCollab
        </Link>

        <div className="flex flex-1 items-center justify-center">
          <nav className="space-x-7 flex text-sm font-medium">
            <Link to="/homepage" className="px-4 hover:text-[#4A78EF]">Home</Link>
            <Link to="/services" className="px-4 hover:text-[#4A78EF]">Tutorials</Link>
          </nav>
        </div>

        <Link to="/profile" className="px-4 text-sm font-medium hover:text-[#4A78EF] flex items-center gap-2">
          <FaUser className="text-[#4A78EF]" /> Profile
        </Link>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex px-20">

        {/* SIDEBAR */}
        <aside className="w-64 bg-white flex flex-col min-h-[calc(100vh-60px)]">
          <div className="p-5 border-b border-gray-200">
            <div className="flex flex-col items-center">

              <div className="relative mb-3">
                <div
                  className={`relative w-20 h-20 rounded-full flex items-center justify-center border-2 ${
                    isSubscribed
                      ? "border-yellow-400 bg-yellow-50"
                      : "border-black bg-gray-50"
                  }`}
                >
                  {userData.photoURL ? (
                    <img
                      src={userData.photoURL}
                      alt="Profile"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <FaUser className={`${isSubscribed ? "text-yellow-600" : "text-black"} text-2xl`} />
                  )}

                  {isSubscribed && (
                    <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-1 border-2 border-white">
                      <FaCrown className="text-white text-xs" />
                    </div>
                  )}
                </div>
              </div>

              <h2 className="text-base font-bold text-black mb-1.5 text-center">
                {userData.fullName || "User"}
              </h2>

              <div
                className={`px-2.5 py-1 rounded-full text-xs font-semibold mb-2 ${
                  isSubscribed
                    ? "bg-yellow-400 text-black"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {isSubscribed ? (
                  <span className="flex items-center gap-1">
                    <FaCrown className="text-xs" /> Premium
                  </span>
                ) : (
                  "Free User"
                )}
              </div>

              <p className="text-xs text-gray-500 text-center truncate w-full">
                {userData.email}
              </p>
            </div>
          </div>

          {/* Sidebar Tabs */}
          <nav className="py-4 px-3 space-y-1">
            <button
              onClick={() => setActiveTab("profile")}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === "profile"
                  ? "bg-[#4A78EF] text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-black"
              }`}
            >
              <FaUser className="text-sm" />
              <span>Profile</span>
            </button>

            <button
              onClick={() => setActiveTab("billing")}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === "billing"
                  ? "bg-[#4A78EF] text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-black"
              }`}
            >
              <FaCreditCard className="text-sm" />
              <span>Billing Details</span>
            </button>
          </nav>

          {/* Logout Button */}
          <div className="p-3 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition"
            >
              <FaSignOutAlt className="text-sm" />
              Logout
            </button>
          </div>
        </aside>

        {/* RIGHT SIDE CONTENT */}
        <main className="flex-1 min-h-[calc(100vh-60px)]">
          <div className="max-w-4xl mx-auto p-6">

            {/* PROFILE TAB */}
            {activeTab === "profile" && (
              <div className="space-y-5">
                <div className="mb-5">
                  <h1 className="text-xl font-bold text-black mb-1">
                    Profile Information
                  </h1>
                  <p className="text-sm text-gray-500">
                    Manage your account details and preferences
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex flex-col">
                      <div className="w-10 h-10 bg-[#4A78EF] rounded-lg flex items-center justify-center mb-3">
                        <FaEnvelope className="text-white text-sm" />
                      </div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        Email Address
                      </h3>
                      <p className="text-sm font-semibold text-black">
                        {userData.email}
                      </p>
                    </div>
                  </div>

                  {userData.createdAt && (
                    <div className="bg-white rounded-lg border border-gray-200 p-5">
                      <div className="flex flex-col">
                        <div className="w-10 h-10 bg-[#4A78EF] rounded-lg flex items-center justify-center mb-3">
                          <FaCalendarAlt className="text-white text-sm" />
                        </div>

                        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">
                          Member Since
                        </h3>

                        <p className="text-sm font-semibold text-black">
                          {userData.createdAt.toDate
                            ? userData.createdAt
                                .toDate()
                                .toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                            : new Date(userData.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }
                              )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-black mb-3">Account Status</h3>
                  <div className="flex items-center justify-between py-2.5 px-3] rounded-lg">
                    <span className="text-sm text-gray-600">Verification Status</span>
                    <span className="text-xs font-semibold px-2.5 py-1 text-green-700 rounded-full">
                      Verified
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* BILLING TAB */}
            {activeTab === "billing" && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-xl font-bold text-black mb-1">
                    Billing & Subscription
                  </h1>
                  <p className="text-sm text-gray-500">
                    Manage your subscription and billing information
                  </p>
                </div>

                <div className="bg-white">

                  <div className="space-y-3">

                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-2.5 px-3">
                        <span className="text-sm">
                          Current Plan
                        </span>

                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            isSubscribed
                              ? "bg-yellow-100 text-yellow-700"
                              : "text-gray-700"
                          }`}
                        >
                          {isSubscribed ? "Premium" : "Free"}
                        </span>
                      </div>

                      {isSubscribed ? (
                        <>
                          <div className="flex justify-between items-center py-2.5 px-3 rounded-lg border">
                            <span className="text-sm text-gray-600">
                              Billing Cycle
                            </span>
                            <span className="text-sm font-semibold text-black">
                              Monthly
                            </span>
                          </div>

                          <div className="flex justify-between items-center py-2.5 px-3">
                            <span className="text-sm text-gray-600">
                              Next Billing Date
                            </span>
                            <span className="text-sm font-semibold text-black">
                              {userData.nextBillingDate || "N/A"}
                            </span>
                          </div>

                          <div className="flex justify-between items-center py-2.5 px-3">
                            <span className="text-sm text-gray-600">
                              Payment Method
                            </span>
                            <span className="text-sm font-semibold text-black">
                              {userData.paymentMethod || "Not set"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="mt-4 p-5 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-sm text-gray-700 mb-3">
                            Upgrade to premium for advanced features, unlimited usage, and priority support.
                          </p>

                          <button className="px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition">
                            Upgrade to Premium
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
};

export default ProfilePage;