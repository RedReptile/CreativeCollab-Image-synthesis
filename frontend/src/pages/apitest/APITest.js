import React, { useState } from 'react';
import { Wand2, Download, Image, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FaUser } from 'react-icons/fa';

export default function TextToImageApp() {
  const [selectedModel, setSelectedModel] = useState('gemini');
  const [prompt, setPrompt] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('jpg');
  const [selectedResolution, setSelectedResolution] = useState('480p');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=AIzaSyD6zxsvuUqyt5YQvemNjAGit039_bBcww8`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { response_modalities: ["Text", "Image"] },
          }),
        }
      );

      const data = await response.json();
      const base64Data =
        data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
          ?.inlineData?.data;

      if (base64Data) {
        setGeneratedImage(`data:image/png;base64,${base64Data}`);
      } else {
        alert("No image data found in response.");
      }
    } catch (error) {
      console.error("Error generating image:", error);
      alert("Failed to generate image.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `generated-image.${selectedFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="text-black px-20 py-8 flex items-center justify-between border-b border-gray-200 bg-white shadow-sm">
        <Link to="/" className="text-lg font-bold tracking-tight">
          CreativeCollab
        </Link>

        <nav className="flex flex-1 justify-center space-x-7 text-sm font-medium">
          <Link to="/homepage" className="px-3 hover:text-[#4A78EF] transition-colors">
            Home
          </Link>
          <Link to="/about" className="px-3 hover:text-[#4A78EF] transition-colors">
            About
          </Link>
          <Link to="/services" className="px-3 hover:text-[#4A78EF] transition-colors">
            Tutorials
          </Link>
        </nav>

        <Link
          to="/contact"
          className="px-3 text-sm font-medium hover:text-[#4A78EF] flex items-center gap-2 transition-colors"
        >
          <FaUser className="text-[#4A78EF]" /> Profile
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Text To Image</h1>
          <p className="text-gray-600 text-xs">Turn words into beautiful visuals instantly</p>
        </div>

        {/* Model Selection */}
        <div className="flex gap-3 mb-4">
          {['gemini', 'deepfloyd'].map((model) => (
            <button
              key={model}
              onClick={() => setSelectedModel(model)}
              className={`px-5 py-2 rounded-md font-medium text-sm transition-all ${
                selectedModel === model
                  ? 'bg-blue-600 text-white border border-blue-600 shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              {model === 'gemini' ? 'Gemini' : 'DeepFloyd IF'}
            </button>
          ))}
        </div>

        {/* Input + Generate */}
        <div className="flex items-center gap-3 mb-4">

          <div className="relative">
            <Image className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image..."
              className="w-[635px] pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

                    <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:bg-blue-400"
          >
            <Wand2 size={16} />
            {'Generate'}
          </button>

        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          {/* Image Preview */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div
              className="bg-gray-50 rounded-lg border border-gray-200 flex flex-col items-center justify-center overflow-hidden"
              style={{ minHeight: '380px' }}
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-2"></div>
                  <h3 className="text-base font-semibold mb-1">Generating Image...</h3>
                  <p className="text-sm text-gray-500">Please wait</p>
                </>
              ) : generatedImage ? (
                <img
                  src={generatedImage}
                  alt="Generated"
                  className="w-auto h-auto max-w-full max-h-[380px] object-contain rounded-md"
                />
              ) : (
                <>
                  <Sparkles className="text-gray-400 mb-3" size={48} />
                  <h3 className="text-base font-semibold mb-1">Generate your Image</h3>
                  <p className="text-sm text-gray-500">It will appear here</p>
                </>
              )}
            </div>
          </div>

          {/* Settings Panel */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              {/* File Type */}
              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2">File Type</h3>
                <div className="grid grid-cols-3 gap-2">
                  {['JPG', 'PNG', 'WebP'].map((format) => (
                    <button
                      key={format}
                      onClick={() => setSelectedFormat(format.toLowerCase())}
                      className={`py-2 rounded-md text-xs font-semibold transition-all ${
                        selectedFormat === format.toLowerCase()
                          ? 'bg-blue-600 text-white border border-blue-600 shadow-sm'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution */}
              <div>
                <h3 className="font-bold text-sm mb-2">Resolution</h3>
                <div className="grid grid-cols-2 gap-2">
                  {['480p', '720p', '1080p', '4k'].map((res, i) => (
                    <button
                      key={res}
                      onClick={() => setSelectedResolution(res)}
                      className={`py-2 rounded-md text-xs font-semibold transition-all relative ${
                        selectedResolution === res
                          ? 'bg-blue-600 text-white border border-blue-600 shadow-sm'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {res}
                      {i >= 2 && <span className="absolute -top-2 -right-2 text-sm">👑</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              disabled={!generatedImage}
              className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400"
            >
              <Download size={16} /> Download
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
