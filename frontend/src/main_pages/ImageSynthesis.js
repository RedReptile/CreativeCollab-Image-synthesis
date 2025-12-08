import { useState, useRef, useEffect } from "react";
import { Sparkles, Trash2, Download, X } from "lucide-react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

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

  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const handleDownload = async (resolution) => {
    if (!resultBlob) {
      setError("Generate an image before downloading.");
      return;
    }

    setDownloadLoading(true);
    setActiveResolution(resolution);
    setError(null);

    try {
      if (resolution === "original") {
        triggerDownload(resultBlob, "spade-original.jpg");
      } else {
        const formData = new FormData();
        formData.append("image", resultBlob, "spade-output.jpg");
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
        triggerDownload(enhancedBlob, `spade-${resolution}.jpg`);
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
            <a href="/services" className="px-4 hover:text-[#4A78EF]">Tutorials</a>
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
                  <div className="absolute right-0 bottom-full mb-2 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-52 z-50">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-black">Download Options</h3>
                      <button onClick={() => setShowDownloadMenu(false)} className="text-gray-400 hover:text-black">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-500 mb-1.5 font-medium">Resolution</p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {['original', '720p', '1080p'].map((res) => (
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
  );
}