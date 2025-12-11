import { useState, useRef, useEffect } from "react";
import { Sparkles, Trash2, Download, X } from "lucide-react";
import { auth } from "../firebase";
import { setUserSubscriptionStatus } from "../utils/subscription";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";
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

export default function ImageSynthesis() {
  const [segImage, setSegImage] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(10);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  
  const semanticColors = [
    { color: "#759edf", label: "Sky", id: 156, text: "#ffffff" },
    { color: "#b7d24e", label: "Grass", id: 123, text: "#1a1a1a" },
    { color: "#352613", label: "Tree", id: 168, text: "#ffffff" },
    { color: "#3c3b4b", label: "Mountain", id: 134, text: "#ffffff" },
    { color: "#384f83", label: "Sea", id: 154, text: "#ffffff" },
    { color: "#32604d", label: "River", id: 147, text: "#ffffff" },
    { color: "#987e6a", label: "Road", id: 148, text: "#ffffff" },
    { color: "#5d6e32", label: "Bush", id: 96, text: "#ffffff" },
    { color: "#e670b6", label: "Flower", id: 118, text: "#ffffff" },
    { color: "#c1c3c9", label: "Fog", id: 119, text: "#1a1a1a" },
    { color: "#776c2d", label: "Hill", id: 126, text: "#ffffff" },
  ];
  
  const defaultBackground = semanticColors[0].color;
  const [selectedColor, setSelectedColor] = useState(defaultBackground);
  const [resultBlob, setResultBlob] = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [activeResolution, setActiveResolution] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [pendingResolution, setPendingResolution] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState("png");
  
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = defaultBackground;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = defaultBackground;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = brushSize;
  }, [selectedColor, brushSize]);

  const getEventPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if (e.touches && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const pos = getEventPos(e);
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const pos = getEventPos(e);
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = brushSize;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    ctx.closePath();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = defaultBackground;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setSegImage(null);
    setResultImage(null);
    setResultBlob(null);
  };

  const handleGenerate = async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setError("Please draw something");
      return;
    }
    
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    
    if (!blob) {
      setError("Failed to capture drawing");
      return;
    }
    
    const imageToSend = new File([blob], "canvas-drawing.png", { type: "image/png" });

    setLoading(true);
    setError(null);
    setResultImage(null);
    setResultBlob(null);

    try {
      const formData = new FormData();
      formData.append("segmentation", imageToSend);

      const response = await fetch(`${API_BASE}/spade`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        // try to get useful debug info (JSON or text)
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Server error ${response.status}`);
        } else {
          const text = await response.text().catch(() => "");
          throw new Error(text || `Server error: ${response.status} ${response.statusText}`);
        }
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.startsWith("image/")) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setResultImage(url);
        setResultBlob(blob);
      } else {
        throw new Error("Unexpected response format from server");
      }
    } catch (err) {
      setError(err.message || "Failed to generate image. Please try again.");
      console.error("Error:", err);
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
        triggerDownload(blobToDownload, `spade-original`, selectedFormat);
      } else {
        const formData = new FormData();
        formData.append("image", resultBlob, "spade-output.png");
        formData.append("resolution", resolution.replace('p', ''));

        const response = await fetch(`${API_BASE}/enhance`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Enhancement failed" }));
          throw new Error(errorData.error || "Failed to enhance image");
        }

        const enhancedBlob = await response.blob();
        blobToDownload = await convertBlobToFormat(enhancedBlob, selectedFormat);
        triggerDownload(blobToDownload, `spade-${resolution}`, selectedFormat);
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
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="text-black px-20 py-10 flex items-center justify-between bg-white">
        <a href="/homepage" className="text-lg font-bold">
          CreativeCollab
        </a>

        <div className="flex flex-1 items-center justify-center">
          <nav className="space-x-7 flex text-sm font-medium">
            <a href="/homepage" className="px-4 hover:text-[#4A78EF]">Home</a>
          </nav>
        </div>

        <a href="/profile" className="px-4 text-sm font-medium hover:text-[#4A78EF] flex items-center gap-2">
          <svg className="w-5 h-5 text-[#4A78EF]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
          </svg>
          Profile
        </a>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 p-6 overflow-hidden">
        {/* Left Column - Color Palette & Controls */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-4">
          <div className="bg-white p-4">
                     <div className="mb-5">
            <h1 className="text-xl font-bold text-black mb-1">Image Synthesis</h1>
            <p className="text-xs text-gray-500">Transform art into images with AI</p>
          </div>
            
            {/* Color Palette */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {semanticColors.map((item) => (
                <button
                  key={item.color}
                  type="button"
                  onClick={() => setSelectedColor(item.color)}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold transition border-2 ${
                    selectedColor === item.color 
                      ? "border-blue-600 ring-2 ring-blue-200 shadow-md" 
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  style={{ 
                    backgroundColor: item.color,
                    color: item.text
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Brush Size */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-700">Brush Size</label>
                <span className="text-xs font-semibold text-black-600">{brushSize}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
              />
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white p-4 space-y-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="w-full px-4 py-2.5 bg-blue-400 text-white rounded-lg hover:bg-gray-500 disabled:bg-gray-400 font-semibold flex items-center justify-center gap-2 text-sm transition"
            >
              <Sparkles className="w-4 h-4" />
              {loading ? "Synthesising..." : "Synthesise"}
            </button>
            
            <button
              type="button"
              onClick={clearCanvas}
              className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium flex items-center justify-center gap-2 text-sm transition"
            >
              <Trash2 className="w-4 h-4" />
              Clear Canvas
            </button>
          </div>
        </div>

        {/* Middle Column - Canvas */}
        <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col">
          <div className="flex-1 border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50">
            <canvas
              ref={canvasRef}
              width={512}
              height={512}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="cursor-crosshair w-full h-full block"
              style={{ touchAction: "none" }}
            />
          </div>
        </div>

        {/* Right Column - Output */}
        <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col">
          
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <span className="text-xs">{error}</span>
            </div>
          )}

          <div className="flex-1 rounded-lg border-2 border-gray-200 overflow-hidden flex items-center justify-center mb-3">
            {loading ? (
              <div className="text-center  items-center justify-center">
                <div className="text-center">
                  <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Your styled image will appear here</p>
                </div>
              </div>
            ) : resultImage ? (
              <img
                src={resultImage}
                alt="Generated"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center p-4">
                  <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Your styled image will appear here</p>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between">
            <p className="text-xs text-gray-600">
              {resultImage ? "Image is ready to download." : "Draw a segmentation map to begin"}
            </p>

            {resultImage && (
              <div className="relative">
                <button
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                  disabled={downloadLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-gray-700 transition text-xs disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadLoading ? "Processing..." : "Download"}
                </button>

                {showDownloadMenu && (
                  <div className="absolute right-0 bottom-full mb-2 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-56 z-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-black">Download Options</h3>
                      <button onClick={() => setShowDownloadMenu(false)} className="text-gray-400 hover:text-black transition">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Format - First */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1.5 font-medium">Format</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {['png', 'jpg'].map((fmt) => (
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
                          {['480p', '720p', '1080p'].map((res) => (
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
      </div>
    </div>
  );
}