# ~~~~~~~~~~~~~~~~~~~~ app.py ~~~~~~~~~~~~~~~~~~~~
# Main Flask backend server for CreativeCollab application
# Handles neural style transfer and SPADE image generation requests

# Import Flask for web server functionality
from flask import Flask, request, send_file, jsonify
# Import CORS to allow cross-origin requests from frontend
from flask_cors import CORS
# Import os for file system operations
import os
# Import sys for path manipulation
import sys
# Import traceback for error reporting
import traceback
# Import io for in-memory file operations
import io
# Import time for timestamp generation
import time
# Import uuid for generating unique identifiers
import uuid
# Import PIL Image and ImageFilter for image processing
from PIL import Image, ImageFilter
# Import PyTorch for deep learning operations
import torch
# Import transforms for image preprocessing
from torchvision import transforms
# Import re for regular expression operations
import re

# Initialize Flask application
app = Flask(__name__)
# Enable CORS for all routes (allows frontend to make requests)
CORS(app)

# ---------- Paths ----------
# Get absolute path of current file's directory (backend folder)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Get project root directory (parent of backend)
PROJECT_ROOT = os.path.dirname(BASE_DIR)

# Construct paths to neural style and SPADE modules
NEURAL_STYLE_DIR = os.path.join(PROJECT_ROOT, 'neural_style_transfer', 'neural_style')
SPADE_DIR = os.path.join(PROJECT_ROOT, 'spade', 'gaugan')

# Add module directories to Python path if they exist
for p in [NEURAL_STYLE_DIR, SPADE_DIR]:
    if os.path.exists(p) and p not in sys.path:
        # Insert at beginning of path for priority
        sys.path.insert(0, p)
        print(f"Added to path: {p}")

# ---------- Flags ----------
# Track availability of SPADE and Neural Style modules
SPADE_AVAILABLE = False
STYLE_AVAILABLE = False

# ---------- Device ----------
# Determine computation device: use CUDA GPU if available, otherwise CPU
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
# Print device information for debugging
print(f"Using device: {DEVICE}")

# ---------- Import SPADE ----------
# Try to import SPADE handler for image generation from segmentation maps
try:
    # Construct path to SPADE handler module
    spade_handler_path = os.path.join(BASE_DIR, 'spade_handler.py')
    # Check if handler file exists
    if os.path.exists(spade_handler_path):
        # Import generate_image function from SPADE handler
        from spade_handler import generate_image
        # Mark SPADE as available
        SPADE_AVAILABLE = True
        print(" SPADE loaded successfully")
except Exception as e:
    # Print error if SPADE cannot be loaded (non-critical)
    print(f" SPADE not available: {e}")

# ---------- Import Neural Style ----------
# Try to import Neural Style Transfer module
try:
    # Import TransformerNet from transformer_net.py
    transformer_path = os.path.join(NEURAL_STYLE_DIR, 'transformer_net.py')
    # Check if transformer module exists
    if os.path.exists(transformer_path):
        # Add neural style directory to path
        sys.path.insert(0, NEURAL_STYLE_DIR)
        # Import TransformerNet architecture class
        from transformer_net import TransformerNet
        # Mark Neural Style as available
        STYLE_AVAILABLE = True
        print(" Neural Style (TransformerNet) loaded successfully")
    else:
        # Print error if transformer module not found
        print(f" transformer_net.py not found at {transformer_path}")
except Exception as e:
    # Print error and traceback if Neural Style cannot be loaded
    print(f" Neural Style not available: {e}")
    traceback.print_exc()

# ---------- Model Cache ----------
# Dictionary to cache loaded models (key: model path, value: model instance)
# Prevents reloading same model multiple times, improving performance
_model_cache = {}

# ---------- Helper Functions ----------
# Function to load a style transfer model from disk with proper error handling
# model_path: Path to the saved model checkpoint file (.pth or .model)
# device: Target device for model (GPU/CPU)
# Returns: Loaded TransformerNet model instance
def load_style_model(model_path: str, device: str = DEVICE):
    """Load a style transfer model with proper state dict handling"""
    
    # Check cache first to avoid reloading same model
    if model_path in _model_cache:
        print(f" Using cached model: {os.path.basename(model_path)}")
        return _model_cache[model_path]
    
    # Print loading message
    print(f"Loading model: {os.path.basename(model_path)}")
    
    try:
        # Load checkpoint file from disk, map to target device
        checkpoint = torch.load(model_path, map_location=device)
        
        # Extract state dict from various checkpoint formats
        # Some checkpoints wrap state_dict in a dictionary
        if isinstance(checkpoint, dict):
            # Check for common wrapper keys
            if 'state_dict' in checkpoint:
                state_dict = checkpoint['state_dict']
            elif 'model' in checkpoint:
                state_dict = checkpoint['model']
            else:
                # Assume entire dict is state_dict
                state_dict = checkpoint
        else:
            # Checkpoint is already state_dict
            state_dict = checkpoint
        
        # Remove 'module.' prefix from DataParallel models
        # Models trained with DataParallel have 'module.' prefix on all keys
        cleaned_state = {}
        for k, v in state_dict.items():
            # Remove prefix if present
            new_key = k.replace('module.', '') if k.startswith('module.') else k
            cleaned_state[new_key] = v
        
        # Remove deprecated InstanceNorm running_mean/var buffers
        # These cause errors in newer PyTorch versions
        keys_to_remove = [
            k for k in cleaned_state.keys() 
            if re.search(r'in\d+\.running_(mean|var)$', k) or 
               'running_mean' in k or 'running_var' in k
        ]
        # Delete deprecated keys
        for k in keys_to_remove:
            del cleaned_state[k]
        
        # Create model instance and load weights
        model = TransformerNet()
        # Load state dict (strict=False allows missing keys)
        model.load_state_dict(cleaned_state, strict=False)
        # Move model to target device
        model.to(device)
        # Set to evaluation mode (disables dropout, batch norm updates)
        model.eval()
        
        # Cache the model for future use
        _model_cache[model_path] = model
        print(f" Model loaded and cached successfully")
        
        return model
        
    except Exception as e:
        # Print error and traceback if loading fails
        print(f" Error loading model: {e}")
        traceback.print_exc()
        raise

# Function to apply style transfer to an image using a loaded model
# model: Pre-loaded TransformerNet model instance
# image_path: Path to input content image file
# output_path: Path where stylized output will be saved
# device: Computation device (GPU/CPU)
# Returns: Path to saved output image

def stylize_image(model, image_path: str, output_path: str, device: str = DEVICE):
    """Apply style transfer to an image"""
    
    # Print processing message
    print(f" Stylizing image: {os.path.basename(image_path)}")
    
    try:
        # Load and preprocess image
        # Open image and convert to RGB (handles RGBA, grayscale, etc.)
        image = Image.open(image_path).convert('RGB')
        # Store original dimensions
        original_size = image.size
        print(f"   Original size: {original_size}")
        
        # Resize if too large (preserve aspect ratio)
        # Large images consume too much memory and are slow to process
        max_size = 1024
        w, h = image.size
        if max(w, h) > max_size:
            # Calculate new dimensions maintaining aspect ratio
            if w > h:
                # Landscape: set width to max_size
                new_w = max_size
                new_h = int(h * max_size / w)
            else:
                # Portrait: set height to max_size
                new_h = max_size
                new_w = int(w * max_size / h)
            # Resize using high-quality LANCZOS resampling
            image = image.resize((new_w, new_h), Image.LANCZOS)
            print(f"   Resized to: {image.size}")
        
        # Convert to tensor (multiply by 255 as expected by the model)
        # Model expects pixel values in [0, 255] range
        transform = transforms.Compose([
            transforms.ToTensor(),  # Converts PIL image to tensor [0, 1]
            transforms.Lambda(lambda x: x.mul(255))  # Scale to [0, 255]
        ])
        
        # Apply transform and add batch dimension, move to device
        content_tensor = transform(image).unsqueeze(0).to(device)
        print(f"   Tensor: {content_tensor.shape} on {content_tensor.device}")
        
        # Apply style transfer
        print(f" Applying style transfer...")
        # Disable gradient computation for inference (saves memory)
        with torch.no_grad():
            # Forward pass through model
            output_tensor = model(content_tensor)
        
        print(f"   Output: {output_tensor.shape}")
        
        # Convert back to image
        # Remove batch dimension and move to CPU
        output_tensor = output_tensor.squeeze(0).cpu().clamp(0, 255)
        # Normalize back to [0, 1] range for PIL conversion
        output_tensor = output_tensor.div(255)
        
        # Convert tensor to PIL Image
        output_image = transforms.ToPILImage()(output_tensor)
        
        # Save with high quality JPEG
        output_image.save(output_path, 'JPEG', quality=95)
        print(f"    Saved: {os.path.basename(output_path)}")
        
        return output_path
        
    except Exception as e:
        # Print error and traceback if stylization fails
        print(f"    Error during stylization: {e}")
        traceback.print_exc()
        raise

# Simple image enhancement function (upscaling + sharpening)
# data: Image data as bytes
# upscale: Upscaling factor (default: 1.5x)
# Returns: Enhanced image as bytes
def enhance_image_simple(data: bytes, upscale: float = 1.5) -> bytes:
    """Simple image enhancement"""
    # Load image from bytes
    img = Image.open(io.BytesIO(data)).convert('RGB')
    # Get original dimensions
    w, h = img.size
    # Resize with upscaling factor using high-quality resampling
    img = img.resize((int(w * upscale), int(h * upscale)), Image.LANCZOS)
    # Apply sharpening filter to improve perceived quality
    img = img.filter(ImageFilter.SHARPEN)
    # Create in-memory buffer for output
    out = io.BytesIO()
    # Save as JPEG with high quality
    img.save(out, format='JPEG', quality=95)
    # Reset buffer position to beginning
    out.seek(0)
    # Return image data as bytes
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
# POST endpoint for applying neural style transfer to uploaded images
@app.route('/stylize', methods=['POST'])
def stylize_route():
    """Apply neural style transfer to an image"""
    
    # Print request header for debugging
    print("\n" + "="*70)
    print("STYLIZE REQUEST RECEIVED")
    print("="*70)
    
    # Check if Neural Style module is available
    if not STYLE_AVAILABLE:
        print(" Neural style module not available")
        return jsonify({'error': 'Neural style module not available'}), 503

    # Validate request: check for image file
    if 'image' not in request.files:
        print(" No image file in request")
        return jsonify({'error': 'No image file provided (key: image)'}), 400
    
    # Validate request: check for style name
    if 'style' not in request.form:
        print(" No style name in request")
        return jsonify({'error': 'No style name provided (key: style)'}), 400

    # Extract image file and style name from request
    image_file = request.files['image']
    style_name = request.form['style']
    
    # Validate that a file was actually selected
    if image_file.filename == '':
        print(" Empty filename")
        return jsonify({'error': 'No file selected'}), 400

    # Print request details for debugging
    print(f"Input: {image_file.filename}")
    print(f"Style: {style_name}")

    # Setup directories for storing input and output images
    content_dir = os.path.join(BASE_DIR, 'content_images')
    output_dir = os.path.join(BASE_DIR, 'output_images')
    # Create directories if they don't exist
    os.makedirs(content_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    # Generate unique filenames to avoid conflicts
    # Extract file extension from uploaded file
    file_ext = os.path.splitext(image_file.filename)[1] or '.jpg'
    # Generate unique 8-character ID
    unique_id = uuid.uuid4().hex[:8]
    # Create input and output filenames
    input_filename = f'{unique_id}{file_ext}'
    output_filename = f'{style_name}_{unique_id}.jpg'
    
    # Construct full paths
    input_path = os.path.join(content_dir, input_filename)
    output_path = os.path.join(output_dir, output_filename)
    
    try:
        # Save uploaded image to disk
        image_file.save(input_path)
        print(f" Saved input: {input_filename}")
    except Exception as e:
        # Return error if file save fails
        print(f" Failed to save input: {e}")
        return jsonify({'error': f'Failed to save input: {str(e)}'}), 500

    # Find model file for requested style
    # Try .pth extension first
    model_path = os.path.join(NEURAL_STYLE_DIR, 'saved_models', f'{style_name}.pth')
    if not os.path.exists(model_path):
        # Try .model extension as fallback
        model_path = os.path.join(NEURAL_STYLE_DIR, 'saved_models', f'{style_name}.model')
        if not os.path.exists(model_path):
            # Model not found, return error with available models list
            print(f" Model not found: {style_name}")
            models_dir = os.path.join(NEURAL_STYLE_DIR, 'saved_models')
            available = []
            # List available models if directory exists
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
        # Load model and apply style transfer
        model = load_style_model(model_path, DEVICE)
        stylize_image(model, input_path, output_path, DEVICE)
        
        print(f"Returning stylized image")
        print("="*70 + "\n")
        
        # Return stylized image as JPEG file
        return send_file(output_path, mimetype='image/jpeg')
        
    except Exception as e:
        # Handle errors during stylization
        print(f" ERROR during stylization:")
        print(f"   {type(e).__name__}: {str(e)}")
        traceback.print_exc()
        print("="*70 + "\n")
        # Return error response with details
        return jsonify({
            'error': str(e), 
            'type': type(e).__name__,
            'details': 'Check server logs for full traceback'
        }), 500
        
    finally:
        # Cleanup input file after processing (always executes)
        if os.path.exists(input_path):
            try: 
                os.remove(input_path)
            except: 
                # Ignore cleanup errors
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

# ---------- Password Reset ----------
@app.route('/reset-password', methods=['POST'])
def reset_password():
    """Reset user password using Firebase Admin SDK"""
    try:
        data = request.get_json()
        email = data.get('email')
        new_password = data.get('newPassword')
        
        if not email or not new_password:
            return jsonify({'error': 'Email and new password are required'}), 400
        
        if len(new_password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        # Try to import firebase-admin
        try:
            import firebase_admin
            from firebase_admin import auth, credentials
            
            # Initialize Firebase Admin if not already initialized
            if not firebase_admin._apps:
                # Try to get credentials from environment or use default
                cred_path = os.environ.get('FIREBASE_ADMIN_CREDENTIALS')
                if cred_path and os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred)
                else:
                    # Use default credentials (for Google Cloud environments)
                    firebase_admin.initialize_app()
            
            # Get user by email
            try:
                user = auth.get_user_by_email(email)
            except Exception as e:
                return jsonify({'error': 'User not found'}), 404
            
            # Update password
            auth.update_user(user.uid, password=new_password)
            
            return jsonify({'success': True, 'message': 'Password reset successfully'}), 200
            
        except ImportError:
            # Fallback: Use Firebase REST API
            import requests
            
            # This is a workaround - in production, use Firebase Admin SDK
            # For now, we'll return an error asking to install firebase-admin
            return jsonify({
                'error': 'Firebase Admin SDK not installed. Install with: pip install firebase-admin',
                'fallback': 'Please use the password reset link sent to your email'
            }), 501
            
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