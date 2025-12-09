import React, { useState } from "react";
import axios from "axios";
import { FileText, Sparkles, Download, X } from "lucide-react";
import { Link } from "react-router-dom";
import { FaUser } from "react-icons/fa";
import { auth } from "../firebase";
import { setUserSubscriptionStatus } from "../utils/subscription";
import floral from "../images/floral.jpg";
import mosaicBG from "../images/mosaic.jpg";
import oil_painting from "../images/oil_painting.jpg";
import cubsim from "../images/cubisme.jpg";

export default function ArtisticFilter() {
  const [image, setImage] = useState(null);
  const [fileName, setFileName] = useState("");
  const [style, setStyle] = useState("candy");
  const [resultImage, setResultImage] = useState(null);
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [activeResolution, setActiveResolution] = useState(null);

  // Added states
  const [resultBlob, setResultBlob] = useState(null);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [pendingResolution, setPendingResolution] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState("png");

  const API_BASE = "http://localhost:5000"; // backend URL
  const PAYMENT_API_BASE = process.env.REACT_APP_PAYMENT_API || "http://localhost:4242";
  
  const hasSubscription = () => {
    const user = auth.currentUser;
    if (!user) return false;
    // Check localStorage cache first (synchronous)
    const cached = localStorage.getItem(`cc_has_subscription_${user.uid}`);
    return cached === 'true';
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
          if (hasSubscription()) {
            if (onSuccess) onSuccess();
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
            if (hasSubscription()) {
              if (onSuccess) onSuccess();
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
      alert('Failed to start checkout. Please try again.');
    }
  };

  const styles = [
    { name: "Geometric Floral", value: "floral", image: floral },
    { name: "Mosaic", value: "mosaic", image: mosaicBG },
    { name: "Oil Painting", value: "oilpaint", image: oil_painting },
    { name: "Cubsim", value: "cubism", image: cubsim },
  ];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setFileName(file.name);
      setOutput(null);
      setResultBlob(null);
    }
  };

  const removeFile = () => {
    setImage(null);
    setFileName("");
    setOutput(null);
    setResultBlob(null);
  };

  const handleStylize = async () => {
    if (!image) {
      alert("Please upload an image first!");
      return;
    }

    setLoading(true);
    setOutput(null);
    setResultBlob(null);

    const form = new FormData();
    form.append("image", image);
    form.append("style", style);

    try {
      const res = await axios.post(`${API_BASE}/stylize`, form, {
        responseType: "blob",
      });
      setResultBlob(res.data);
      const url = URL.createObjectURL(res.data);
      setOutput(url);
      setResultImage(url);
    } catch (err) {
      console.error("Axios error:", err);
      alert(
        `Error stylizing image. Check backend is running and CORS is enabled.\n${err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const triggerDownload = (blob, filename, format = "png") => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const ext = format === "jpg" ? "jpg" : "png";
    link.download = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const convertBlobToFormat = async (blob, format) => {
    if (format === "png") {
      return blob; // Already PNG or can be used as-is
    }
    
    // Convert to JPG
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.95);
      };
      img.src = URL.createObjectURL(blob);
    });
  };

  const proceedDownload = async (resolution) => {
    if (!resultBlob) {
      setError("Generate an image before downloading.");
      return;
    }

    setDownloadLoading(true);
    setActiveResolution(resolution);
    setError(null);

    try {
      let blobToDownload = resultBlob;
      
      if (resolution === "original") {
        blobToDownload = await convertBlobToFormat(resultBlob, selectedFormat);
        triggerDownload(blobToDownload, `stylized-original`, selectedFormat);
      } else {
        // Send to backend for upscaling
        const formData = new FormData();
        formData.append("image", resultBlob, "stylized-output.png");
        formData.append("resolution", resolution.replace("p", ""));

        const response = await fetch(`${API_BASE}/enhance`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Enhancement failed" }));
          throw new Error(errorData.error || "Failed to enhance image");
        }

        const enhancedBlob = await response.blob();
        blobToDownload = await convertBlobToFormat(enhancedBlob, selectedFormat);
        triggerDownload(blobToDownload, `stylized-${resolution}`, selectedFormat);
      }

      setShowDownloadMenu(false);
    } catch (err) {
      console.error("Download error:", err);
      setError(err.message || "Failed to prepare download");
    } finally {
      setDownloadLoading(false);
      setActiveResolution(null);
    }
  };

  const handleDownload = (resolution) => {
    const needsSubscription = resolution === "480p" || resolution === "720p" || resolution === "1080p";
    if (needsSubscription && !hasSubscription()) {
      setPendingResolution(resolution);
      setShowPlanModal(true);
      setShowDownloadMenu(false);
      return;
    }

    proceedDownload(resolution);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="text-black px-20 py-10 flex items-center justify-between">
        <Link to="/homepage" className="text-lg font-bold">
          CreativeCollab
        </Link>

        <div className="flex flex-1 items-center justify-center">
          <nav className="space-x-7 flex text-sm font-medium">
            <Link to="/homepage" className="px-4 hover:text-[#4A78EF]">
              Home
            </Link>
            <Link to="/services" className="px-4 hover:text-[#4A78EF]">
              Tutorials
            </Link>
          </nav>
        </div>

        <Link
          to="/profile"
          className="px-4 text-sm font-medium hover:text-[#4A78EF] flex items-center gap-2"
        >
          <FaUser className="text-[#4A78EF]" /> Profile
        </Link>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 px-20">
        {/* Left Panel */}
        <div className="w-72 bg-white p-5 flex flex-col">
          <div className="mb-5">
            <h1 className="text-xl font-bold text-black mb-1">Artistic Filter</h1>
            <p className="text-xs text-gray-500">Transform images with AI</p>
          </div>

          {/* Upload Section */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-black mb-2">Upload Image</h2>
            {!fileName ? (
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition cursor-pointer"
                onClick={() => document.getElementById("file-input").click()}
              >
                <FileText className="w-7 h-7 mx-auto mb-2 text-gray-400" />
                <p className="text-xs text-gray-600">
                  <span className="text-black font-medium">Click to upload</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP</p>
                <input
                  id="file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg p-2.5 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="w-4 h-4 text-black flex-shrink-0" />
                  <span className="text-xs text-gray-700 truncate">{fileName}</span>
                </div>
                <button
                  onClick={removeFile}
                  className="ml-2 p-0.5 hover:bg-gray-200 rounded transition"
                >
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
            )}
          </div>

          {/* Style Selection  */}
          <div className="mb-4 py-2">
            <h2 className="text-xs font-semibold text-black mb-2">Choose Style</h2>
            <div className="grid grid-cols-2 gap-3">
              {styles.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className={`rounded-lg overflow-hidden transition border-2 ${
                    style === s.value
                      ? "border-blue-600 ring-1 ring-blue-500"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="relative h-16">
                    <img src={s.image} alt={s.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-black py-1.5">
                    <span className="text-xs font-medium text-white">{s.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Apply Button */}
          <button
            onClick={handleStylize}
            disabled={loading || !image}
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm mb-2"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? "Stylizing..." : "Apply Style"}
          </button>
        </div>

        {/* Right Panel */}
        <div className="flex-1 p-5">
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            {/* Output Display */}
            <div className="flex-1 bg-white rounded-lg border border-gray-200 mb-3 flex items-center justify-center min-h-[400px]">
              {loading ? (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-300 border-t-black mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Processing...</p>
                </div>
              ) : output ? (
                <img
                  src={output}
                  alt="Styled Output"
                  className="rounded-lg max-w-full max-h-[450px] object-contain p-4"
                />
              ) : (
                <div className="text-center">
                  <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Your styled image will appear here</p>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between">
              <p className="text-xs text-gray-600">
                {resultImage ? "Image is ready to download." : "Upload an image to begin"}
              </p>

              {resultImage && (
                <div className="relative">
                  <button
                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    disabled={downloadLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-gray-800 transition text-xs disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {downloadLoading ? "Processing..." : "Download"}
                  </button>

                  {showDownloadMenu && (
                    <div className="absolute right-0 bottom-full mb-2 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-56 z-50">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-black">Download Options</h3>
                        <button
                          onClick={() => setShowDownloadMenu(false)}
                          className="text-gray-400 hover:text-black transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        {/* Format - First */}
                        <div>
                          <p className="text-xs text-gray-500 mb-1.5 font-medium">Format</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {["png", "jpg"].map((fmt) => (
                              <button
                                key={fmt}
                                onClick={() => setSelectedFormat(fmt)}
                                className={`px-2 py-1.5 text-black text-xs rounded transition font-medium uppercase ${
                                  selectedFormat === fmt
                                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                                    : "bg-gray-100 hover:bg-gray-200"
                                }`}
                              >
                                {fmt}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Resolution - Second */}
                        <div>
                          <p className="text-xs text-gray-500 mb-1.5 font-medium">Resolution</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {["480p", "720p", "1080p"].map((res) => (
                              <button
                                key={res}
                                onClick={() => handleDownload(res)}
                                disabled={downloadLoading && activeResolution === res}
                                className={`px-2 py-1.5 text-black text-xs rounded transition font-medium ${
                                  downloadLoading && activeResolution === res
                                    ? "bg-gray-200 cursor-not-allowed"
                                    : "bg-gray-100 hover:bg-gray-200"
                                }`}
                              >
                                {downloadLoading && activeResolution === res
                                  ? "..."
                                  : res}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => handleDownload("original")}
                            disabled={downloadLoading && activeResolution === "original"}
                            className={`w-full mt-1.5 px-2 py-1.5 text-black text-xs rounded transition font-medium ${
                              downloadLoading && activeResolution === "original"
                                ? "bg-gray-200 cursor-not-allowed"
                                : "bg-gray-100 hover:bg-gray-200"
                            }`}
                          >
                            {downloadLoading && activeResolution === "original"
                              ? "Processing..."
                              : "Original"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Plan choice modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Upgrade Required</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Unlock HD downloads</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPlanModal(false);
                  setPendingResolution(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5">
              <p className="text-sm text-gray-700 leading-relaxed">
                HD downloads (<span className="font-semibold text-blue-700">480p/720p/1080p</span>) require a subscription. 
                You can continue with <span className="font-semibold">free original quality</span> or subscribe to unlock HD resolution.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowPlanModal(false);
                  proceedDownload("original");
                }}
                className="w-full px-4 py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Continue with Free (Original)
              </button>
              <button
                onClick={() => {
                  setShowPlanModal(false);
                  goToSubscription(() => {
                    // After successful subscription, proceed with the pending download
                    if (pendingResolution) {
                      proceedDownload(pendingResolution);
                      setPendingResolution(null);
                    }
                  });
                }}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm font-semibold transition shadow-md flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Subscribe for HD ({pendingResolution})
              </button>
              <button
                onClick={() => {
                  setShowPlanModal(false);
                  setPendingResolution(null);
                }}
                className="w-full px-4 py-2.5 bg-white text-gray-600 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
