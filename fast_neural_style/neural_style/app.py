from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import style                 # your neural style transfer functions
import os
import uuid                  # to generate safe unique filenames

app = Flask(__name__)
CORS(app)


@app.get("/")
def home():
    return "Neural Style Transfer Backend is running!"


@app.get("/stylize")
def stylize_info():
    return "Send a POST request with 'image' (file) and 'style' (string)."


@app.post("/stylize")
def stylize_image():
    # Validate input
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    if "style" not in request.form:
        return jsonify({"error": "No style name provided"}), 400

    image_file = request.files["image"]
    style_name = request.form["style"]

    # Ensure directories exist
    os.makedirs("images/content-images", exist_ok=True)
    os.makedirs("images/output-images", exist_ok=True)

    # Generate unique safe filename
    file_ext = os.path.splitext(image_file.filename)[1]
    safe_filename = f"{uuid.uuid4().hex}{file_ext}"

    # Paths
    input_path = os.path.join("images/content-images", safe_filename)
    output_filename = f"{style_name}_{safe_filename}"
    output_path = os.path.join("images/output-images", output_filename)

    # Save uploaded image
    image_file.save(input_path)

    # Model path
    model_path = os.path.join("saved_models", f"{style_name}.pth")
    if not os.path.exists(model_path):
        return jsonify({"error": f"Model '{style_name}.pth' not found"}), 404

    # Apply neural style transfer
    model = style.load_model(model_path)
    style.stylize(model, input_path, output_path)

    # Return the result
    return send_file(output_path, mimetype="image/jpeg")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
