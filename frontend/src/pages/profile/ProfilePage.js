import React, { useEffect, useState, useRef } from "react";
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
import { getUserSubscriptionStatus, setUserSubscriptionStatus } from "../../utils/subscription";

const PAYMENT_API_BASE = process.env.REACT_APP_PAYMENT_API || "http://localhost:4242";

const ProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");

  const [hasSubscription, setHasSubscription] = useState(false);
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        // 🔥 CHECK REAL SUBSCRIPTION STATUS
        const status = await getUserSubscriptionStatus(currentUser.uid);
        setHasSubscription(status);

        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));

          if (userDoc.exists()) {
            setUserData(userDoc.data());
          } else {
            setUserData({
              fullName: currentUser.displayName || "User",
              email: currentUser.email || "",
              photoURL: currentUser.photoURL || "",
              createdAt: new Date(),
            });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          toast.error("Failed to load user information");
        } finally {
          setLoading(false);
        }
      } else {
        // Don't show error toast when logging out - handleLogout already shows success toast
        navigate("/login");
        if (!isLoggingOutRef.current) {
          toast.error("Please log in to view your profile");
        }
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

  if (!user || !userData) return null;

  const handleLogout = async () => {
    try {
      // Set ref synchronously before signOut to prevent error toast
      isLoggingOutRef.current = true;
      
      // Clear subscription status from localStorage before signing out
      const user = auth.currentUser;
      if (user) {
        localStorage.removeItem(`cc_has_subscription_${user.uid}`);
      }
      localStorage.removeItem('cc_has_subscription');
      
      await signOut(auth);
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      isLoggingOutRef.current = false;
      toast.error("Failed to logout. Please try again.");
    }
  };

  const goToSubscription = async (onSuccess) => {
    try {
      // Create checkout session
      const res = await fetch(`${PAYMENT_API_BASE}/create-checkout-session`, { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to create checkout session');
      }
      const data = await res.json();
      if (!data.url) {
        throw new Error('Stripe checkout URL missing');
      }

      // Open Stripe checkout in popup
      const popup = window.open(
        data.url,
        'stripe-checkout',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        alert('Please allow popups to proceed with checkout');
        return;
      }

      // Listen for postMessage from popup
      const messageHandler = (event) => {
        // Verify origin for security
        if (event.origin !== window.location.origin) {
          return;
        }
        
        if (event.data.type === 'STRIPE_CHECKOUT_SUCCESS') {
          const sessionId = event.data.sessionId;
          if (sessionId) {
            // Verify payment status
            fetch(`${PAYMENT_API_BASE}/session-status?session_id=${sessionId}`)
              .then(res => res.json())
              .then(async (statusData) => {
                if (statusData.status === 'complete') {
                  const user = auth.currentUser;
                  if (user) {
                    await setUserSubscriptionStatus(user.uid, true);
                    setHasSubscription(true);
                  }
                  window.removeEventListener('message', messageHandler);
                  if (onSuccess) onSuccess();
                }
              })
              .catch(err => console.error('Failed to verify payment:', err));
          }
        } else if (event.data.type === 'STRIPE_CHECKOUT_CLOSED') {
          // Popup was closed, check if payment succeeded
          window.removeEventListener('message', messageHandler);
          const user = auth.currentUser;
          if (user) {
            const cached = localStorage.getItem(`cc_has_subscription_${user.uid}`);
            if (cached === 'true') {
              if (onSuccess) onSuccess();
            }
          }
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Fallback: Check if popup is closed (may not work due to CORS)
      const checkPopup = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(checkPopup);
            window.removeEventListener('message', messageHandler);
            // Check if payment succeeded
            const user = auth.currentUser;
            if (user) {
              const cached = localStorage.getItem(`cc_has_subscription_${user.uid}`);
              if (cached === 'true') {
                if (onSuccess) onSuccess();
              }
            }
          }
        } catch (e) {
          // Ignore CORS errors
        }
      }, 1000);

      // Cleanup after 10 minutes
      setTimeout(() => {
        clearInterval(checkPopup);
        window.removeEventListener('message', messageHandler);
      }, 600000);
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Failed to start checkout. Please try again.');
    }
  };

  // ⭐ NEW — USE REAL SUBSCRIPTION STATUS
  const isSubscribed = hasSubscription;

  return (
    <div className="min-h-screen bg-white">
      {/* HEADER */}
      <header className="text-black px-20 py-10 flex items-center justify-between">
        <Link to="/homepage" className="text-lg font-bold">
          CreativeCollab
        </Link>

        <div className="flex flex-1 items-center justify-center">
          <nav className="space-x-7 flex text-sm font-medium">
            <Link to="/homepage" className="px-4 hover:text-[#4A78EF]">Home</Link>
          </nav>
        </div>

        <Link to="/profile" className="px-4 text-sm font-medium hover:text-[#4A78EF] flex items-center gap-2">
          <FaUser className="text-[#4A78EF]" /> Profile
        </Link>
      </header>

      <div className="flex px-20">
        {/* SIDEBAR */}
        <aside className="w-64 bg-white flex flex-col min-h-[calc(100vh-60px)]">
          <div className="p-5 border-b border-gray-200">
            <div className="flex flex-col items-center">
                <div className="relative mb-3">
                  <div
                    className={`relative w-20 h-20 rounded-full flex items-center justify-center border-2 ${
                      isSubscribed ? "border-yellow-400 bg-yellow-50" : "border-black bg-gray-50"
                    }`}
                  >
                    <FaUser className={`${isSubscribed ? "text-yellow-600" : "text-black"} text-2xl`} />

                    {isSubscribed && (
                      <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-1 border-2 border-white">
                        <FaCrown className="text-white text-xs" />
                      </div>
                    )}
                  </div>
                </div>

              <h2 className="text-base font-bold text-black mb-1.5 text-center">
                {userData.fullName}
              </h2>

              {/* REAL SUBSCRIPTION STATUS */}
              <div
                className={`px-2.5 py-1 rounded-full text-xs font-semibold mb-2 ${
                  isSubscribed ? "bg-yellow-400 text-black" : "bg-gray-100 text-gray-700"
                }`}
              >
                {isSubscribed ? "Premium" : "Free User"}
              </div>

              <p className="text-xs text-gray-500 text-center truncate w-full">
                {userData.email}
              </p>
            </div>
          </div>

          {/* TABS */}
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

          {/* LOGOUT */}
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

        {/* MAIN CONTENT */}
        <main className="flex-1 min-h-[calc(100vh-60px)]">
          <div className="max-w-4xl mx-auto p-6">
            {/* PROFILE TAB */}
            {activeTab === "profile" && (
              <>
                <h1 className="text-xl font-bold text-black mb-1">
                  Profile Information
                </h1>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-white rounded-lg border p-5">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Email Address</h3>
                    <p className="text-sm font-semibold text-black">{userData.email}</p>
                  </div>

                  {userData.createdAt && (
                    <div className="bg-white rounded-lg border p-5">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Member Since</h3>
                      <p className="text-sm font-semibold text-black">
                        {new Date(userData.createdAt).toLocaleDateString("en-US")}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* BILLING TAB */}
            {activeTab === "billing" && (
              <>
                <h1 className="text-xl font-bold text-black mb-1">
                  Billing & Subscription
                </h1>

                <div className="mt-4 p-5 bg-white border rounded-lg">
                  <div className="flex justify-between items-center">
                    <span>Subscription Status</span>
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        isSubscribed ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {isSubscribed ? "Active" : "Not Active"}
                    </span>
                  </div>

                  {!isSubscribed && (
                    <div className="mt-4">
                      <button
                        onClick={() => {
                          goToSubscription(() => {
                            // Refresh subscription status after successful payment
                            const user = auth.currentUser;
                            if (user) {
                              getUserSubscriptionStatus(user.uid).then(status => {
                                setHasSubscription(status);
                                toast.success("Subscription activated successfully!");
                              });
                            }
                          });
                        }}
                        className="px-5 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                      >
                        Upgrade to Premium
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ProfilePage;
