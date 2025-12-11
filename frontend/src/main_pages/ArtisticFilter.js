// Import React hooks for component state management
import React, { useState } from "react";
// Import axios for making HTTP requests to the backend API
import axios from "axios";
// Import icons from lucide-react for UI elements
import { FileText, Sparkles, Download, X } from "lucide-react";
// Import Link component for navigation between pages
import { Link } from "react-router-dom";
// Import user icon from react-icons for profile display
import { FaUser } from "react-icons/fa";
// Import Firebase authentication instance
import { auth } from "../firebase";
// Import utility function to update user subscription status
import { setUserSubscriptionStatus } from "../utils/subscription";
// Import style preview images for the filter selection UI
import floral from "../images/floral.jpg";
import mosaicBG from "../images/mosaic.jpg";
import oil_painting from "../images/oil_painting.jpg";
import cubsim from "../images/cubisme.jpg";

// Main ArtisticFilter component - handles image upload, style selection, and stylization
export default function ArtisticFilter() {
  // State to store the uploaded image file object
  const [image, setImage] = useState(null);
  // State to store the name of the uploaded file for display
  const [fileName, setFileName] = useState("");
  // State to store the currently selected artistic style (default: "candy")
  const [style, setStyle] = useState("candy");
  // State to store the URL of the stylized result image
  const [resultImage, setResultImage] = useState(null);
  // State to store the output image URL for display
  const [output, setOutput] = useState(null);
  // State to track if the stylization process is currently running
  const [loading, setLoading] = useState(false);
  // State to control visibility of the download options dropdown menu
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  // State to track if download processing is in progress
  const [downloadLoading, setDownloadLoading] = useState(false);
  // State to track which resolution is currently being processed for download
  const [activeResolution, setActiveResolution] = useState(null);

  // Additional states for enhanced functionality
  // State to store the blob data of the stylized image for download
  const [resultBlob, setResultBlob] = useState(null);
  // State to store any error messages that occur during processing
  const [error, setError] = useState(null);
  // State to track if a download operation is in progress
  const [downloading, setDownloading] = useState(false);
  // State to control visibility of the subscription upgrade modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  // State to store the resolution that was requested but requires subscription
  const [pendingResolution, setPendingResolution] = useState(null);
  // State to store the selected download format (PNG or JPG)
  const [selectedFormat, setSelectedFormat] = useState("png");

  // Base URL for the backend API server
  const API_BASE = "http://localhost:5000"; // backend URL
  // Base URL for the payment API (Stripe checkout), with fallback to localhost
  const PAYMENT_API_BASE = process.env.REACT_APP_PAYMENT_API || "http://localhost:4242";
  
  // Function to check if the current user has an active subscription
  const hasSubscription = () => {
    // Get the currently authenticated user from Firebase
    const user = auth.currentUser;
    // If no user is logged in, return false
    if (!user) return false;
    // Check localStorage cache first (synchronous) for quick access
    // Cache key is based on user ID to ensure per-user caching
    const cached = localStorage.getItem(`cc_has_subscription_${user.uid}`);
    // Return true if cached value is 'true', false otherwise
    return cached === 'true';
  };
  
  // Function to initiate the subscription checkout process via Stripe
  // onSuccess: callback function to execute after successful subscription
  const goToSubscription = async (onSuccess) => {
    try {
      // Create checkout session by calling the payment API
      const res = await fetch(`${PAYMENT_API_BASE}/create-checkout-session`, { method: 'POST' });
      // Check if the API request was successful
      if (!res.ok) {
        throw new Error('Failed to create checkout session');
      }
      // Parse the JSON response containing checkout session details
      const data = await res.json();
      // Verify that the checkout URL is present in the response
      if (!data.url) {
        throw new Error('Stripe checkout URL missing');
      }

      // Open Stripe checkout in a popup window for better UX
      const popup = window.open(
        data.url, // Stripe checkout URL
        'stripe-checkout', // Window name
        'width=600,height=700,scrollbars=yes,resizable=yes' // Window dimensions and properties
      );

      // Check if popup was blocked by browser
      if (!popup) {
        alert('Please allow popups to proceed with checkout');
        return;
      }

      // Listen for postMessage from popup window to handle checkout completion
      const messageHandler = (event) => {
        // Verify origin for security - only accept messages from same origin
        if (event.origin !== window.location.origin) {
          return;
        }
        
        // Handle successful checkout completion message
        if (event.data.type === 'STRIPE_CHECKOUT_SUCCESS') {
          // Extract session ID from the message
          const sessionId = event.data.sessionId;
          if (sessionId) {
            // Verify payment status by checking with the payment API
            fetch(`${PAYMENT_API_BASE}/session-status?session_id=${sessionId}`)
              .then(res => res.json())
              .then(async (statusData) => {
                // If payment is complete, update user subscription status
                if (statusData.status === 'complete') {
                  const user = auth.currentUser;
                  if (user) {
                    // Update subscription status in Firebase
                    await setUserSubscriptionStatus(user.uid, true);
                  }
                  // Remove event listener to prevent memory leaks
                  window.removeEventListener('message', messageHandler);
                  // Execute success callback if provided
                  if (onSuccess) onSuccess();
                }
              })
              .catch(err => console.error('Failed to verify payment:', err));
          }
        } else if (event.data.type === 'STRIPE_CHECKOUT_CLOSED') {
          // Popup was closed, check if payment succeeded before closing
          window.removeEventListener('message', messageHandler);
          // Check subscription status and execute callback if subscription exists
          if (hasSubscription()) {
            if (onSuccess) onSuccess();
          }
        }
      };
      
      // Register the message handler to listen for popup messages
      window.addEventListener('message', messageHandler);
      
      // Fallback: Check if popup is closed (may not work due to CORS restrictions)
      const checkPopup = setInterval(() => {
        try {
          // Check if popup window has been closed
          if (popup.closed) {
            // Clear the interval to stop checking
            clearInterval(checkPopup);
            // Remove event listener
            window.removeEventListener('message', messageHandler);
            // Check if payment succeeded after popup closed
            if (hasSubscription()) {
              if (onSuccess) onSuccess();
            }
          }
        } catch (e) {
          // Ignore CORS errors that may occur when checking popup status
        }
      }, 1000); // Check every second

      // Cleanup after 10 minutes to prevent memory leaks
      setTimeout(() => {
        clearInterval(checkPopup);
        window.removeEventListener('message', messageHandler);
      }, 600000); // 10 minutes in milliseconds
    } catch (err) {
      // Log error and show user-friendly error message
      console.error('Checkout error:', err);
      alert('Failed to start checkout. Please try again.');
    }
  };

  // Array of available artistic styles with their display names, API values, and preview images
  const styles = [
    { name: "Geometric Floral", value: "floral", image: floral },
    { name: "Mosaic", value: "mosaic", image: mosaicBG },
    { name: "Oil Painting", value: "oilpaint", image: oil_painting },
    { name: "Cubsim", value: "cubism", image: cubsim },
  ];

  // Handler function called when user selects a file to upload
  const handleFileChange = (e) => {
    // Get the first file from the file input element
    const file = e.target.files[0];
    if (file) {
      // Store the file object in state
      setImage(file);
      // Store the file name for display purposes
      setFileName(file.name);
      // Clear any previous output image URL
      setOutput(null);
      // Clear any previous result blob data
      setResultBlob(null);
    }
  };

  // Function to remove the uploaded file and reset related state
  const removeFile = () => {
    // Clear the image file from state
    setImage(null);
    // Clear the file name
    setFileName("");
    // Clear the output image URL
    setOutput(null);
    // Clear the result blob data
    setResultBlob(null);
  };

  // Main function to apply style transfer to the uploaded image
  const handleStylize = async () => {
    // Validate that an image has been uploaded
    if (!image) {
      alert("Please upload an image first!");
      return;
    }

    // Set loading state to true to show loading indicator
    setLoading(true);
    // Clear any previous output
    setOutput(null);
    // Clear any previous result blob
    setResultBlob(null);

    // Create FormData object to send multipart/form-data to backend
    const form = new FormData();
    // Append the image file to the form data
    form.append("image", image);
    // Append the selected style name to the form data
    form.append("style", style);

    try {
      // Send POST request to backend stylize endpoint
      const res = await axios.post(`${API_BASE}/stylize`, form, {
        responseType: "blob", // Expect binary image data in response
      });
      // Store the blob data for download purposes
      setResultBlob(res.data);
      // Create a temporary URL from the blob for display
      const url = URL.createObjectURL(res.data);
      // Set the output URL for display
      setOutput(url);
      // Also store in resultImage state
      setResultImage(url);
    } catch (err) {
      // Log error details to console for debugging
      console.error("Axios error:", err);
      // Show user-friendly error message
      alert(
        `Error stylizing image. Check backend is running and CORS is enabled.\n${err.message}`
      );
    } finally {
      // Always set loading to false when request completes (success or error)
      setLoading(false);
    }
  };

  // Function to trigger browser download of a blob file
  // blob: The blob data to download
  // filename: Base name for the downloaded file
  // format: File format extension (default: "png")
  const triggerDownload = (blob, filename, format = "png") => {
    // Create a temporary URL from the blob
    const url = URL.createObjectURL(blob);
    // Create a temporary anchor element for download
    const link = document.createElement("a");
    // Set the href to the blob URL
    link.href = url;
    // Determine file extension based on format
    const ext = format === "jpg" ? "jpg" : "png";
    // Ensure filename has correct extension
    link.download = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
    // Temporarily add link to DOM (required for some browsers)
    document.body.appendChild(link);
    // Programmatically click the link to trigger download
    link.click();
    // Remove the link from DOM
    link.remove();
    // Revoke the blob URL after a short delay to free memory
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  // Function to convert blob image data to a different format (PNG or JPG)
  // blob: The source image blob
  // format: Target format ("png" or "jpg")
  // Returns: Promise that resolves to converted blob
  const convertBlobToFormat = async (blob, format) => {
    // If target format is PNG, return blob as-is (no conversion needed)
    if (format === "png") {
      return blob; // Already PNG or can be used as-is
    }
    
    // Convert to JPG using HTML5 Canvas API
    return new Promise((resolve) => {
      // Create a new Image object to load the blob
      const img = new Image();
      // Set up onload handler to process image after it loads
      img.onload = () => {
        // Create a canvas element to draw the image
        const canvas = document.createElement("canvas");
        // Set canvas dimensions to match image dimensions
        canvas.width = img.width;
        canvas.height = img.height;
        // Get 2D rendering context
        const ctx = canvas.getContext("2d");
        // Fill canvas with white background (JPG doesn't support transparency)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Draw the image onto the canvas
        ctx.drawImage(img, 0, 0);
        // Convert canvas to blob in JPEG format with 95% quality
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.95);
      };
      // Set image source to blob URL to trigger loading
      img.src = URL.createObjectURL(blob);
    });
  };

  // Function to proceed with downloading the image at specified resolution
  // resolution: Target resolution ("original", "480p", "720p", or "1080p")
  const proceedDownload = async (resolution) => {
    // Validate that a result image exists
    if (!resultBlob) {
      setError("Generate an image before downloading.");
      return;
    }

    // Set loading state and track active resolution
    setDownloadLoading(true);
    setActiveResolution(resolution);
    // Clear any previous errors
    setError(null);

    try {
      // Variable to hold the blob that will be downloaded
      let blobToDownload = resultBlob;
      
      // If downloading original resolution, no enhancement needed
      if (resolution === "original") {
        // Convert to selected format and download
        blobToDownload = await convertBlobToFormat(resultBlob, selectedFormat);
        triggerDownload(blobToDownload, `stylized-original`, selectedFormat);
      } else {
        // For HD resolutions, send to backend for upscaling/enhancement
        const formData = new FormData();
        // Append the result blob as image file
        formData.append("image", resultBlob, "stylized-output.png");
        // Append resolution (remove 'p' suffix, e.g., "480p" -> "480")

        formData.append("resolution", resolution.replace("p", ""));

        // Send enhancement request to backend
        const response = await fetch(`${API_BASE}/enhance`, {
          method: "POST",
          body: formData,
        });

        // Check if request was successful
        if (!response.ok) {
          // Try to parse error response, fallback to generic error
          const errorData = await response
            .json()
            .catch(() => ({ error: "Enhancement failed" }));
          throw new Error(errorData.error || "Failed to enhance image");
        }

        // Get enhanced image blob from response
        const enhancedBlob = await response.blob();
        // Convert to selected format
        blobToDownload = await convertBlobToFormat(enhancedBlob, selectedFormat);
        // Trigger download with resolution in filename
        triggerDownload(blobToDownload, `stylized-${resolution}`, selectedFormat);
      }

      // Close download menu after successful download
      setShowDownloadMenu(false);
    } catch (err) {
      // Log error and set error message for user
      console.error("Download error:", err);
      setError(err.message || "Failed to prepare download");
    } finally {
      // Always reset loading states when done
      setDownloadLoading(false);
      setActiveResolution(null);
    }
  };

  // Function to handle download button click with subscription check
  // resolution: Target resolution for download
  const handleDownload = (resolution) => {
    // Determine if this resolution requires a subscription
    const needsSubscription = resolution === "480p" || resolution === "720p" || resolution === "1080p";
    // If subscription required and user doesn't have one, show upgrade modal
    if (needsSubscription && !hasSubscription()) {
      // Store the requested resolution for later use
      setPendingResolution(resolution);
      // Show subscription upgrade modal
      setShowPlanModal(true);
      // Close download menu
      setShowDownloadMenu(false);
      return;
    }

    // If no subscription needed or user has subscription, proceed with download
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
