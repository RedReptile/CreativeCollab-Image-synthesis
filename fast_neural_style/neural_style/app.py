from flask import Flask, request, send_file
from flask_cors import CORS
import style  # your neural style transfer code
import os

app = Flask(__name__)
CORS(app)  # allow requests from React frontend

# Home route
@app.get("/")
def home():
    return "Neural Style Transfer Backend is running!"

# Info for GET /stylize
@app.get("/stylize")
def stylize_info():
    return "Send a POST request with 'image' and 'style' to get stylized image."

# POST /stylize
@app.post("/stylize")
def stylize_image():
    if 'image' not in request.files or 'style' not in request.form:
        return "Missing image or style", 400

    image_file = request.files['image']
    style_name = request.form['style']

    # Save uploaded image temporarily
    input_path = os.path.join("images/content-images", image_file.filename)
    image_file.save(input_path)

    output_filename = f"{style_name}_{image_file.filename}"
    output_path = os.path.join("images/output-images", output_filename)

    # Load model and stylize
    model_path = os.path.join("saved_models", f"{style_name}.pth")
    model = style.load_model(model_path)
    style.stylize(model, input_path, output_path)

    # Return output image
    return send_file(output_path, mimetype='image/jpeg')

if __name__ == "__main__":
    os.makedirs("images/content-images", exist_ok=True)
    os.makedirs("images/output-images", exist_ok=True)
    app.run(host="0.0.0.0", port=5000, debug=True)
