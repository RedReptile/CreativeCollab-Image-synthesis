import React, { useState } from "react";
import axios from "axios";
import { FileText, Sparkles, Download, X } from "lucide-react";
import { Link } from "react-router-dom";
import { FaUser } from "react-icons/fa";
import floral from "../images/floral.jpg";
import mosaicBG from "../images/mosaic.jpg";
import oil_painting from "../images/oil_painting.jpg";
import cubsim from "../images/cubisme.jpg";
import { UPSCALE_ENDPOINT, getScaleForResolution } from "../utils/upscale";


export default function ArtisticFilter() {
  const [image, setImage] = useState(null);
  const [fileName, setFileName] = useState("");
  const [style, setStyle] = useState("candy");
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [activeResolution, setActiveResolution] = useState("");

  const styles = [
    { 
      name: "Geometric Floral", 
      value: "floral",
      image: floral,
      bgImage: floral,
    },
    { 
      name: "Mosaic", 
      value: "mosaic", 
      image: mosaicBG,
      bgImage: mosaicBG,
    },
    { 
      name: "Oil Painting", 
      value: "oilpaint", 
      image: oil_painting,
      bgImage: oil_painting,
    },
    { 
      name: "Cubsim", 
      value: "cubism", 
      image: cubsim,
      bgImage: cubsim,
    },
  ];


  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setFileName(file.name);
      setOutput(null);
    }
  };

  const handleStylize = async () => {
    if (!image) {
      alert("Please upload an image first!");
      return;
    }

    setLoading(true);
    setOutput(null);

    const form = new FormData();
    form.append("image", image);
    form.append("style", style);

    try {
      const res = await axios.post("http://localhost:5000/stylize", form, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      setOutput(url);
    } catch (err) {
      console.error("Axios error:", err);
      alert(`Error stylizing image. Check backend is running and CORS is enabled.\n${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (resolution, format) => {
    if (!output) return;

    const scale = getScaleForResolution(resolution);
    if (!scale) {
      alert("Unsupported resolution selected.");
      return;
    }

    setIsUpscaling(true);
    setActiveResolution(resolution);

    try {
      const response = await fetch(output);
      const blob = await response.blob();

      const uploadName = fileName || "styled-image.png";
      const formData = new FormData();
      formData.append("image", blob, uploadName);
      formData.append("scale", scale);
      formData.append("format", format);

      const upscaleResponse = await axios.post(UPSCALE_ENDPOINT, formData, {
        responseType: "blob",
      });

      const downloadUrl = window.URL.createObjectURL(upscaleResponse.data);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `styled_${resolution}_${Date.now()}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(downloadUrl);
      setShowDownloadMenu(false);
    } catch (err) {
      console.error("Upscale download error:", err);
      alert(
        "Error downloading image backend might not br running"
      );
    } finally {
      setIsUpscaling(false);
      setActiveResolution("");
    }
  };

  const removeFile = () => {
    setImage(null);
    setFileName("");
    setOutput(null);
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
            <Link to="/homepage" className="px-4 hover:text-[#4A78EF]">Home</Link>
            <Link to="/services" className="px-4 hover:text-[#4A78EF]">Tutorials</Link>
          </nav>
        </div>

        <Link to="/profile" className="px-4 text-sm font-medium hover:text-[#4A78EF] flex items-center gap-2">
          <FaUser className="text-[#4A78EF]" /> Profile
        </Link>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 px-20">
        {/* Left Panel */}
        <div className="w-72 bg-white p-5 flex flex-col">
          <div className="mb-5">
            <h1 className="text-xl font-bold text-black mb-1">Neural Style Transfer</h1>
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
                <input id="file-input" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg p-2.5 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="w-4 h-4 text-black flex-shrink-0" />
                  <span className="text-xs text-gray-700 truncate">{fileName}</span>
                </div>
                <button onClick={removeFile} className="ml-2 p-0.5 hover:bg-gray-200 rounded transition">
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
                    <img 
                      src={s.image} 
                      alt={s.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} flex items-center justify-center`} style={{display: 'none'}}>
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
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
                {output ? "Image is ready to download." : "Upload an image to begin"}
              </p>

              {output && (
                <div className="relative">
                  <button
                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    disabled={isUpscaling}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-gray-800 transition text-xs disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {isUpscaling ? "Processing..." : "Download"}
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
                            {['480p', '720p', '1080p'].map((res) => (
                              <button
                                key={res}
                                onClick={() => {
                                  const fmt =
                                    document.querySelector(
                                      'input[name="format"]:checked'
                                    )?.value || "png";
                                  handleDownload(res, fmt);
                                }}
                                disabled={
                                  isUpscaling && activeResolution === res
                                }
                                className={`px-2 py-1.5 text-black text-xs rounded transition font-medium ${
                                  isUpscaling && activeResolution === res
                                    ? "bg-gray-200 cursor-not-allowed"
                                    : "bg-gray-100 hover:bg-gray-200"
                                }`}
                              >
                                {isUpscaling && activeResolution === res
                                  ? "Processing..."
                                  : res}
                              </button>
                            ))}
                          </div>
                        </div>a

                        <div>
                          <p className="text-xs text-gray-500 mb-1.5 font-medium">Format</p>
                          <div className="space-y-1.5">
                            {['png', 'jpg'].map((fmt) => (
                              <label key={fmt} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="format"
                                  value={fmt}
                                  defaultChecked={fmt === 'png'}
                                  className="w-3.5 h-3.5"
                                />
                                <span className="text-xs text-gray-700 uppercase font-medium">{fmt}</span>
                              </label>
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
    </div>
  );
}
