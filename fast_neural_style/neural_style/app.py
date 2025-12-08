# ~~~~~~~~~~~~~~~~~~~~ app.py ~~~~~~~~~~~~~~~~~~~~
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import os
import uuid
import io
import traceback
from PIL import Image, ImageFilter
import torch
from torchvision import transforms

# Import your TransformerNet model from style.py
from style import TransformerNet

# ---------- Flask setup ----------
app = Flask(__name__)
CORS(app)

# ---------- device ----------
DEVICE = 'cuda:0' if torch.cuda.is_available() else 'cpu'

# ---------- helper functions ----------
def load_model(weights_path: str, device: str = DEVICE):
    """Load a standard PyTorch .pth checkpoint model, fixing old InstanceNorm keys."""
    model = TransformerNet()
    state_dict = torch.load(weights_path, map_location=device)

    # Remove all unexpected running stats for InstanceNorm
    keys_to_remove = [k for k in state_dict.keys() if "running_mean" in k or "running_var" in k]
    for k in keys_to_remove:
        del state_dict[k]

    model.load_state_dict(state_dict, strict=False)
    model.to(device)
    model.eval()
    return model


def stylize(model, content_path: str, output_path: str, device: str = DEVICE):
    """Run inference and save stylized JPG."""
    transform = transforms.Compose([
        transforms.Resize((512, 512)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225])
    ])
    image = Image.open(content_path).convert('RGB')
    tensor = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        out_tensor = model(tensor)

    # De-normalize
    out_tensor = out_tensor.squeeze().cpu().clamp(0, 1)
    out_img = transforms.ToPILImage()(out_tensor)
    out_img.save(output_path, quality=95)

def enhance_image_simple(data: bytes, upscale: float = 1.5) -> bytes:
    """Basic image enhancement: resize + sharpen."""
    img = Image.open(io.BytesIO(data)).convert('RGB')
    w, h = img.size
    img = img.resize((int(w * upscale), int(h * upscale)), Image.LANCZOS)
    img = img.filter(ImageFilter.SHARPEN)
    out = io.BytesIO()
    img.save(out, format='JPEG', quality=95)
    out.seek(0)
    return out.getvalue()

# ---------- routes ----------
@app.get('/')
def home():
    return jsonify(status='running', style_available=True)

@app.get('/health')
def health():
    return jsonify(status='healthy', style_available=True)

# ---------- STYLE TRANSFER ----------
@app.post('/stylize')
def stylize_image():
    if 'image' not in request.files:
        return jsonify(error='No image file provided'), 400
    if 'style' not in request.form:
        return jsonify(error='No style name provided'), 400

    image_file = request.files['image']
    style_name = request.form['style']

    # Ensure folders exist
    os.makedirs('images/content-images', exist_ok=True)
    os.makedirs('images/output-images', exist_ok=True)

    # Save input image
    file_ext = os.path.splitext(image_file.filename)[1] or '.jpg'
    safe_filename = f'{uuid.uuid4().hex}{file_ext}'
    in_path = os.path.join('images/content-images', safe_filename)
    out_path = os.path.join('images/output-images', f'{style_name}_{safe_filename}')
    image_file.save(in_path)

    # Load model
    model_path = os.path.join('saved_models', f'{style_name}.pth')
    if not os.path.exists(model_path):
        return jsonify(error=f"Model '{style_name}.pth' not found"), 404

    try:
        model = load_model(model_path, DEVICE)
        stylize(model, in_path, out_path, DEVICE)
        return send_file(out_path, mimetype='image/jpeg')
    except Exception as e:
        traceback.print_exc()
        return jsonify(error=str(e), type=type(e).__name__), 500

# ---------- ENHANCE ----------
@app.post('/enhance')
def enhance():
    if 'image' not in request.files:
        return jsonify(error='No image uploaded'), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify(error='No file selected'), 400
    try:
        enhanced = enhance_image_simple(file.read(), upscale=1.5)
        return send_file(io.BytesIO(enhanced),
                         mimetype='image/jpeg',
                         download_name='enhanced.jpg',
                         as_attachment=False)
    except Exception as e:
        traceback.print_exc()
        return jsonify(error=str(e), type=type(e).__name__), 500

# ---------- bootstrap ----------
if __name__ == '__main__':
    print('\nRegistered routes:')
    for r in app.url_map.iter_rules():
        print(' ', r)
    print()
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
