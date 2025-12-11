# ~~~~~~~~~~~~~~~~~~~~  app.py  ~~~~~~~~~~~~~~~~~~~~
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import os
import sys
import traceback
import io
import time
from PIL import Image, ImageFilter

app = Flask(__name__)
CORS(app)

# ---------- inject the extra packages ----------
FAST_NST = os.path.abspath(os.path.join(os.path.dirname(__file__),
                                        '../../neural_style_transfer/neural_style'))
SPADE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__),
                                         '../../spade/gaugan'))
for p in (FAST_NST, SPADE_DIR):
    if p not in sys.path:
        sys.path.append(p)

# ---------- availability flags ----------
SPADE_AVAILABLE = False
STYLE_AVAILABLE = False

# SPADE
try:
    from spade_handler import generate_image
    SPADE_AVAILABLE = True
except Exception as e:
    print('SPADE import failed')
    traceback.print_exc()

# Neural-style
try:
    import style  # noqa – keeps linter quiet
    STYLE_AVAILABLE = True
except Exception as e:
    print('Neural-style import failed  !!!')
    traceback.print_exc()

# ---------- helper ----------
def enhance_image_simple(data: bytes, upscale=1.5) -> bytes:
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
    return jsonify(status='running',
                   spade_available=SPADE_AVAILABLE,
                   style_available=STYLE_AVAILABLE)

@app.get('/health')
def health():
    return jsonify(status='healthy',
                   spade_available=SPADE_AVAILABLE,
                   style_available=STYLE_AVAILABLE)

# ~~~~~~~~~~~~ SPADE ~~~~~~~~~~~~
@app.post('/spade')
def spade_image():
    if not SPADE_AVAILABLE:
        return jsonify(error='SPADE handler not available'), 503
    if 'segmentation' not in request.files:
        return jsonify(error='Missing segmentation map'), 400

    seg_file = request.files['segmentation']
    if seg_file.filename == '':
        return jsonify(error='No file selected'), 400

    os.makedirs('images/content-images', exist_ok=True)
    base_name = os.path.splitext(seg_file.filename)[0]
    timestamp = int(time.time())
    seg_path = os.path.join('images/content-images',
                            f'{base_name}_{timestamp}.png')
    seg_file.save(seg_path)

    try:
        output_name = f'spade_{base_name}_{timestamp}.jpg'
        output_path = generate_image(seg_path, output_name=output_name)
        if not os.path.exists(output_path):
            return jsonify(error='Output file not created'), 500
        ext = os.path.splitext(output_path)[1].lower()
        mimetype = 'image/jpeg' if ext in {'.jpg', '.jpeg'} else 'image/png'
        return send_file(output_path, mimetype=mimetype)
    except Exception as e:
        traceback.print_exc()
        return jsonify(error=str(e), type=type(e).__name__), 500

# ~~~~~~~~~~~~ STYLE TRANSFER ~~~~~~~~~~~~
@app.post('/stylize')
def stylize():
    # try to import every time so we can survive “fix-and-retry” cycles
    try:
        import style  # noqa
    except Exception as e:
        traceback.print_exc()
        return jsonify(error=f'Cannot load neural-style module: {e}'), 503

    content_file = request.files.get('content')
    style_file   = request.files.get('style')
    if not content_file or not style_file:
        return jsonify(error='Both content and style images required'), 400

    try:
        out_path = style.transfer(content_file, style_file)
        return send_file(out_path, mimetype='image/jpeg')
    except Exception as e:
        traceback.print_exc()
        return jsonify(error=str(e), type=type(e).__name__), 500

# ~~~~~~~~~~~~ ENHANCE ~~~~~~~~~~~~
@app.post('/enhance')
def enhance():
    if 'image' not in request.files:
        return jsonify(error='No image uploaded'), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify(error='No file selected'), 400
    try:
        enhanced = enhance_image_simple(file.read())
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
        print(f'  {r}')
    print()
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)