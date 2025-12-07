from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import os
import sys
import traceback
import tempfile
import uuid
from PIL import Image, ImageFilter
import io

app = Flask(__name__)
CORS(app) 

# Add the paths to Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../fast_neural_style/neural_style')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../spade/gaugan')))

try:
    import style  # NST import
except ImportError:
    print("Warning: style module not found, continuing without NST")
    style = None

try:
    from spade_handler import generate_image
    SPADE_AVAILABLE = True
except Exception as e:
    print(f"Warning: Failed to import spade_handler: {str(e)}")
    SPADE_AVAILABLE = False
    traceback.print_exc()

# Simple image enhancement function
def enhance_image_simple(input_bytes, upscale=1.5):
    """Upscale and sharpen image using PIL."""
    img = Image.open(io.BytesIO(input_bytes)).convert("RGB")
    w, h = img.size
    img = img.resize((int(w*upscale), int(h*upscale)), Image.LANCZOS)
    img = img.filter(ImageFilter.SHARPEN)
    
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=95)
    out.seek(0)
    return out.getvalue()

# Root endpoint
@app.get("/")
def home():
    return jsonify({
        "status": "running",
        "spade_available": SPADE_AVAILABLE
    })

# Health check endpoint
@app.get("/health")
def health():
    return jsonify({
        "status": "healthy",
        "spade_available": SPADE_AVAILABLE
    })

# SPADE endpoint
@app.post("/spade")
def spade_image():
    try:
        if not SPADE_AVAILABLE:
            return jsonify({"error": "SPADE handler is not available. Check server logs."}), 503
        
        if 'segmentation' not in request.files:
            return jsonify({"error": "Missing segmentation map"}), 400

        seg_file = request.files['segmentation']
        
        if seg_file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        print(f"Received file: {seg_file.filename}")
        
        # Save uploaded segmentation map
        os.makedirs("images/content-images", exist_ok=True)
        
        # Get file extension and create a safe filename
        filename = seg_file.filename or "uploaded_image"
        # Remove extension and add timestamp for uniqueness
        import time
        base_name = os.path.splitext(filename)[0]
        timestamp = int(time.time())
        seg_path = os.path.join("images/content-images", f"{base_name}_{timestamp}.png")
        seg_file.save(seg_path)
        
        print(f"Saved segmentation map to: {seg_path}")

        # Generate image using SPADE
        print("Starting SPADE image generation...")
        output_name = f"spade_{base_name}_{timestamp}.jpg"
        output_path = generate_image(seg_path, output_name=output_name)
        
        print(f"Generated image at: {output_path}")
        
        if not os.path.exists(output_path):
            return jsonify({"error": "Failed to generate image - output file not found"}), 500

        # Determine mimetype based on file extension
        ext = os.path.splitext(output_path)[1].lower()
        mimetype = 'image/jpeg' if ext in ['.jpg', '.jpeg'] else 'image/png'
        
        return send_file(output_path, mimetype=mimetype)
    
    except Exception as e:
        error_msg = str(e)
        print(f"Error in spade_image endpoint: {error_msg}")
        traceback.print_exc()
        return jsonify({
            "error": error_msg,
            "type": type(e).__name__
        }), 500


@app.post("/enhance")
def enhance():
    """Enhance image using PIL upscaling and sharpening."""
    try:
        if "image" not in request.files:
            return jsonify({"error": "No image uploaded"}), 400

        file = request.files["image"]
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        raw = file.read()
        print(f"Enhancing image: {file.filename}")

        enhanced = enhance_image_simple(raw, upscale=1.5)

        response = send_file(
            io.BytesIO(enhanced),
            mimetype="image/jpeg",
            download_name="enhanced.jpg",
            as_attachment=False
        )
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response

    except Exception as e:
        error_msg = str(e)
        print(f"Error in enhance endpoint: {error_msg}")
        traceback.print_exc()
        return jsonify({
            "error": error_msg,
            "type": type(e).__name__
        }), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)