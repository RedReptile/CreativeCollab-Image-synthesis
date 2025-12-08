# ~~~~~~~~~~~~~~~~~~~~ app.py ~~~~~~~~~~~~~~~~~~~~
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import os
import sys
import traceback
import io
import time
import uuid
from PIL import Image, ImageFilter
import torch
from torchvision import transforms
import re

app = Flask(__name__)
CORS(app)

# ---------- Paths ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

NEURAL_STYLE_DIR = os.path.join(PROJECT_ROOT, 'fast_neural_style', 'neural_style')
SPADE_DIR = os.path.join(PROJECT_ROOT, 'spade', 'gaugan')

for p in [NEURAL_STYLE_DIR, SPADE_DIR]:
    if os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)
        print(f"Added to path: {p}")

# ---------- Flags ----------
SPADE_AVAILABLE = False
STYLE_AVAILABLE = False

# ---------- Device ----------
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Using device: {DEVICE}")

# ---------- Import SPADE ----------
try:
    spade_handler_path = os.path.join(BASE_DIR, 'spade_handler.py')
    if os.path.exists(spade_handler_path):
        from spade_handler import generate_image
        SPADE_AVAILABLE = True
        print(" SPADE loaded successfully")
except Exception as e:
    print(f" SPADE not available: {e}")

# ---------- Import Neural Style ----------
try:
    # Import TransformerNet from transformer_net.py
    transformer_path = os.path.join(NEURAL_STYLE_DIR, 'transformer_net.py')
    if os.path.exists(transformer_path):
        sys.path.insert(0, NEURAL_STYLE_DIR)
        from transformer_net import TransformerNet
        STYLE_AVAILABLE = True
        print(" Neural Style (TransformerNet) loaded successfully")
    else:
        print(f" transformer_net.py not found at {transformer_path}")
except Exception as e:
    print(f" Neural Style not available: {e}")
    traceback.print_exc()

# ---------- Model Cache ----------
_model_cache = {}

# ---------- Helper Functions ----------
def load_style_model(model_path: str, device: str = DEVICE):
    """Load a style transfer model with proper state dict handling"""
    
    # Check cache first
    if model_path in _model_cache:
        print(f" Using cached model: {os.path.basename(model_path)}")
        return _model_cache[model_path]
    
    print(f"Loading model: {os.path.basename(model_path)}")
    
    try:
        # Load checkpoint
        checkpoint = torch.load(model_path, map_location=device)
        
        # Extract state dict from various checkpoint formats
        if isinstance(checkpoint, dict):
            if 'state_dict' in checkpoint:
                state_dict = checkpoint['state_dict']
            elif 'model' in checkpoint:
                state_dict = checkpoint['model']
            else:
                state_dict = checkpoint
        else:
            state_dict = checkpoint
        
        # Remove 'module.' prefix from DataParallel
        cleaned_state = {}
        for k, v in state_dict.items():
            new_key = k.replace('module.', '') if k.startswith('module.') else k
            cleaned_state[new_key] = v
        
        # Remove deprecated InstanceNorm running_mean/var buffers
        keys_to_remove = [
            k for k in cleaned_state.keys() 
            if re.search(r'in\d+\.running_(mean|var)$', k) or 
               'running_mean' in k or 'running_var' in k
        ]
        for k in keys_to_remove:
            del cleaned_state[k]
        
        # Create model and load weights
        model = TransformerNet()
        model.load_state_dict(cleaned_state, strict=False)
        model.to(device)
        model.eval()
        
        # Cache the model
        _model_cache[model_path] = model
        print(f" Model loaded and cached successfully")
        
        return model
        
    except Exception as e:
        print(f" Error loading model: {e}")
        traceback.print_exc()
        raise

def stylize_image(model, image_path: str, output_path: str, device: str = DEVICE):
    """Apply style transfer to an image"""
    
    print(f" Stylizing image: {os.path.basename(image_path)}")
    
    try:
        # Load and preprocess image
        image = Image.open(image_path).convert('RGB')
        original_size = image.size
        print(f"   Original size: {original_size}")
        
        # Resize if too large (preserve aspect ratio)
        max_size = 1024
        w, h = image.size
        if max(w, h) > max_size:
            if w > h:
                new_w = max_size
                new_h = int(h * max_size / w)
            else:
                new_h = max_size
                new_w = int(w * max_size / h)
            image = image.resize((new_w, new_h), Image.LANCZOS)
            print(f"   Resized to: {image.size}")
        
        # Convert to tensor (multiply by 255 as expected by the model)
        transform = transforms.Compose([
            transforms.ToTensor(),
            transforms.Lambda(lambda x: x.mul(255))
        ])
        
        content_tensor = transform(image).unsqueeze(0).to(device)
        print(f"   Tensor: {content_tensor.shape} on {content_tensor.device}")
        
        # Apply style transfer
        print(f" Applying style transfer...")
        with torch.no_grad():
            output_tensor = model(content_tensor)
        
        print(f"   Output: {output_tensor.shape}")
        
        # Convert back to image
        output_tensor = output_tensor.squeeze(0).cpu().clamp(0, 255)
        output_tensor = output_tensor.div(255)  # Normalize back to [0, 1]
        
        output_image = transforms.ToPILImage()(output_tensor)
        
        # Save with high quality
        output_image.save(output_path, 'JPEG', quality=95)
        print(f"    Saved: {os.path.basename(output_path)}")
        
        return output_path
        
    except Exception as e:
        print(f"    Error during stylization: {e}")
        traceback.print_exc()
        raise

def enhance_image_simple(data: bytes, upscale: float = 1.5) -> bytes:
    """Simple image enhancement"""
    img = Image.open(io.BytesIO(data)).convert('RGB')
    w, h = img.size
    img = img.resize((int(w * upscale), int(h * upscale)), Image.LANCZOS)
    img = img.filter(ImageFilter.SHARPEN)
    out = io.BytesIO()
    img.save(out, format='JPEG', quality=95)
    out.seek(0)
    return out.getvalue()

# ---------- Routes ----------
@app.route('/', methods=['GET'])
def home():
    return jsonify({
        'status': 'running',
        'spade_available': SPADE_AVAILABLE,
        'style_available': STYLE_AVAILABLE,
        'device': DEVICE,
        'cached_models': len(_model_cache),
        'endpoints': {
            'health': 'GET /health',
            'models': 'GET /models',
            'stylize': 'POST /stylize (image, style)',
            'spade': 'POST /spade (segmentation)',
            'enhance': 'POST /enhance (image)'
        }
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'spade_available': SPADE_AVAILABLE,
        'style_available': STYLE_AVAILABLE,
        'device': DEVICE,
        'cached_models': len(_model_cache)
    })

@app.route('/models', methods=['GET'])
def list_models():
    """List available style models"""
    models_dir = os.path.join(NEURAL_STYLE_DIR, 'saved_models')
    
    if not os.path.exists(models_dir):
        return jsonify({
            'models': [],
            'error': f'Models directory not found: {models_dir}'
        })
    
    try:
        files = os.listdir(models_dir)
        models = [
            f.replace('.pth', '').replace('.model', '') 
            for f in files 
            if f.endswith('.pth') or f.endswith('.model')
        ]
        return jsonify({
            'models': models,
            'count': len(models),
            'directory': models_dir
        })
    except Exception as e:
        return jsonify({
            'models': [],
            'error': str(e)
        })

# ---------- SPADE ----------
@app.route('/spade', methods=['POST'])
def spade_route():
    if not SPADE_AVAILABLE:
        return jsonify({'error': 'SPADE handler not available'}), 503
    if 'segmentation' not in request.files:
        return jsonify({'error': 'Missing segmentation map'}), 400
    
    seg_file = request.files['segmentation']
    if seg_file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    temp_dir = os.path.join(BASE_DIR, 'temp_images')
    os.makedirs(temp_dir, exist_ok=True)
    
    base_name = os.path.splitext(seg_file.filename)[0]
    timestamp = int(time.time())
    seg_path = os.path.join(temp_dir, f'{base_name}_{timestamp}.png')
    seg_file.save(seg_path)
    
    try:
        output_name = f'spade_{base_name}_{timestamp}.jpg'
        output_path = generate_image(seg_path, output_name=output_name)
        if not os.path.exists(output_path):
            return jsonify({'error': 'Output file not created'}), 500
        
        return send_file(output_path, mimetype='image/jpeg')
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'type': type(e).__name__}), 500
    finally:
        if os.path.exists(seg_path):
            try: 
                os.remove(seg_path)
            except: 
                pass

# ---------- Neural Style ----------
@app.route('/stylize', methods=['POST'])
def stylize_route():
    """Apply neural style transfer to an image"""
    
    print("\n" + "="*70)
    print("STYLIZE REQUEST RECEIVED")
    print("="*70)
    
    if not STYLE_AVAILABLE:
        print(" Neural style module not available")
        return jsonify({'error': 'Neural style module not available'}), 503

    # Validate request
    if 'image' not in request.files:
        print(" No image file in request")
        return jsonify({'error': 'No image file provided (key: image)'}), 400
    
    if 'style' not in request.form:
        print(" No style name in request")
        return jsonify({'error': 'No style name provided (key: style)'}), 400

    image_file = request.files['image']
    style_name = request.form['style']
    
    if image_file.filename == '':
        print(" Empty filename")
        return jsonify({'error': 'No file selected'}), 400

    print(f"Input: {image_file.filename}")
    print(f"Style: {style_name}")

    # Setup directories
    content_dir = os.path.join(BASE_DIR, 'content_images')
    output_dir = os.path.join(BASE_DIR, 'output_images')
    os.makedirs(content_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    # Save input image
    file_ext = os.path.splitext(image_file.filename)[1] or '.jpg'
    unique_id = uuid.uuid4().hex[:8]
    input_filename = f'{unique_id}{file_ext}'
    output_filename = f'{style_name}_{unique_id}.jpg'
    
    input_path = os.path.join(content_dir, input_filename)
    output_path = os.path.join(output_dir, output_filename)
    
    try:
        image_file.save(input_path)
        print(f" Saved input: {input_filename}")
    except Exception as e:
        print(f" Failed to save input: {e}")
        return jsonify({'error': f'Failed to save input: {str(e)}'}), 500

    # Find model
    model_path = os.path.join(NEURAL_STYLE_DIR, 'saved_models', f'{style_name}.pth')
    if not os.path.exists(model_path):
        # Try .model extension
        model_path = os.path.join(NEURAL_STYLE_DIR, 'saved_models', f'{style_name}.model')
        if not os.path.exists(model_path):
            print(f" Model not found: {style_name}")
            models_dir = os.path.join(NEURAL_STYLE_DIR, 'saved_models')
            available = []
            if os.path.exists(models_dir):
                available = [f.replace('.pth','').replace('.model','') 
                           for f in os.listdir(models_dir) 
                           if f.endswith(('.pth','.model'))]
            return jsonify({
                'error': f"Model '{style_name}' not found",
                'available_models': available
            }), 404

    print(f" Model path: {os.path.basename(model_path)}")

    try:
        # Load model and stylize
        model = load_style_model(model_path, DEVICE)
        stylize_image(model, input_path, output_path, DEVICE)
        
        print(f"Returning stylized image")
        print("="*70 + "\n")
        
        return send_file(output_path, mimetype='image/jpeg')
        
    except Exception as e:
        print(f" ERROR during stylization:")
        print(f"   {type(e).__name__}: {str(e)}")
        traceback.print_exc()
        print("="*70 + "\n")
        return jsonify({
            'error': str(e), 
            'type': type(e).__name__,
            'details': 'Check server logs for full traceback'
        }), 500
        
    finally:
        # Cleanup input file
        if os.path.exists(input_path):
            try: 
                os.remove(input_path)
            except: 
                pass

# ---------- Enhance ----------
@app.route('/enhance', methods=['POST'])
def enhance_route():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    try:
        enhanced = enhance_image_simple(file.read())
        return send_file(
            io.BytesIO(enhanced), 
            mimetype='image/jpeg', 
            as_attachment=False
        )
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'type': type(e).__name__}), 500

# ---------- Run ----------
if __name__ == '__main__':
    print("\n" + "="*70)
    print(" UNIFIED BACKEND SERVER - STARTING")
    print("="*70)
    print(f"SPADE:        {' Available' if SPADE_AVAILABLE else ' Not Available'}")
    print(f"Neural Style: {' Available' if STYLE_AVAILABLE else ' Not Available'}")
    print(f"Device:       {DEVICE}")
    print(f"Port:         5000")
    print("="*70)
    
    # Check for models
    if STYLE_AVAILABLE:
        models_dir = os.path.join(NEURAL_STYLE_DIR, 'saved_models')
        if os.path.exists(models_dir):
            models = [f for f in os.listdir(models_dir) if f.endswith(('.pth','.model'))]
            print(f"\n Found {len(models)} style models:")
            for m in models[:5]:  # Show first 5
                print(f"   • {m}")
            if len(models) > 5:
                print(f"   ... and {len(models)-5} more")
        print()
    
    print("="*70 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)