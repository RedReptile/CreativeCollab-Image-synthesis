import React, { useRef, useState } from "react";

const API_KEY = ""; // 

export default function SketchToImage() {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [outputImage, setOutputImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Start drawing
  const startDrawing = (e) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setDrawing(true);
  };

  // Draw while mouse moves
  const draw = (e) => {
    if (!drawing) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  // Stop drawing
  const stopDrawing = () => setDrawing(false);

  // Clear canvas
  const clearCanvas = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  // Generate image from doodle + prompt
  const generateImage = async () => {
    if (!prompt.trim()) {
      setError("Please enter a description.");
      return;
    }

    setError("");
    setLoading(true);
    setOutputImage(null);

    // Get canvas image as base64
    const base64Image = canvasRef.current.toDataURL("image/png").split(",")[1];

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: base64Image,
                    },
                  },
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["IMAGE"],
              imageConfig: {
                aspectRatio: "1:1",
              },
            },
          }),
        }
      );

      const data = await response.json();
      console.log("Gemini response:", data);

      // Extract base64 image (if any)
      const base64Output = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (base64Output) {
        setOutputImage(`data:image/png;base64,${base64Output}`);
      } else {
        setError("No image generated. Check console for details.");
      }
    } catch (err) {
      console.error(err);
      setError("Error generating image. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: "center", maxWidth: 800, margin: "auto" }}>
      <h2>🎨 Sketch to Image Generator (Gemini 2.5 Flash)</h2>

      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        style={{
          border: "1px solid #ccc",
          background: "#fff",
          marginBottom: 10,
          cursor: "crosshair",
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />

      <div style={{ marginBottom: 10 }}>
        <button onClick={clearCanvas}>Clear</button>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe how you want your sketch to look (e.g., 'make it a realistic mountain landscape')"
        style={{
          width: "100%",
          height: 80,
          marginBottom: 10,
          padding: 8,
        }}
      />

      <button
        onClick={generateImage}
        disabled={loading}
        style={{
          padding: "10px 20px",
          background: "#1a73e8",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        {loading ? "Generating..." : "Generate Image"}
      </button>

      {error && <p style={{ color: "red" }}>⚠️ {error}</p>}

      {outputImage && (
        <div style={{ marginTop: 20 }}>
          <img
            src={outputImage}
            alt="Generated result"
            style={{
              width: 400,
              borderRadius: 10,
              boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
            }}
          />
        </div>
      )}
    </div>
  );
}
