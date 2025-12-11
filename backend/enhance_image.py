"""
Real-ESRGAN helper utilities for upscaling SPADE outputs.
This module downloads the pretrained weights on first use and keeps
the enhancer in memory for subsequent requests.
"""
# Import os for file system operations
import os
# Import sys for module manipulation
import sys
# Import types for creating dynamic modules
import types
# Import cv2 (OpenCV) for image reading and writing
import cv2
# Import PyTorch for tensor operations
import torch


# Function to ensure torchvision.functional_tensor module exists
# Some lightweight CPU builds of torchvision omit functional_tensor
# Real-ESRGAN imports rgb_to_grayscale from there, so we register a replacement if missing
def _ensure_torchvision_functional_tensor():
    """
    Some lightweight CPU builds of torchvision omit functional_tensor.
    Basicsr/realesrgan import rgb_to_grayscale from there, so we register
    a minimal replacement if it is missing.
    """
    # If it already exists, nothing to do
    if "torchvision.transforms.functional_tensor" in sys.modules:
        return

    try:
        # Try to import torchvision transforms
        import torchvision.transforms as _tv_transforms
    except ModuleNotFoundError as exc:
        # Raise error if torchvision is not installed
        raise ModuleNotFoundError(
            "torchvision is required for Real-ESRGAN. Please install torchvision."
        ) from exc

    # If newer torchvision exposes functional_tensor on transforms, re‑use it
    if hasattr(_tv_transforms, "functional_tensor"):
        # Register the existing module
        sys.modules["torchvision.transforms.functional_tensor"] = _tv_transforms.functional_tensor
        return

    # Otherwise create a minimal stub module providing rgb_to_grayscale
    # Create a new module object
    module = types.ModuleType("torchvision.transforms.functional_tensor")

    # Define rgb_to_grayscale function for the stub module
    def rgb_to_grayscale(img, num_output_channels=1):
        # Validate input tensor has at least 3 dimensions and channel dimension is 3
        if img.dim() < 3 or img.size(-3) != 3:
            raise ValueError("Expected tensor with channel dimension of size 3")
        # Unbind RGB channels (channel dimension is -3)
        r, g, b = img.unbind(dim=-3)
        # Convert to grayscale using standard weights (ITU-R BT.601)
        gray = 0.2989 * r + 0.587 * g + 0.114 * b
        # Add channel dimension back
        gray = gray.unsqueeze(-3)
        # If 3 channels requested, repeat grayscale channel 3 times
        if num_output_channels == 3:
            gray = gray.repeat_interleave(3, dim=-3)
        elif num_output_channels != 1:
            # Validate output channel count
            raise ValueError("num_output_channels must be 1 or 3")
        return gray

    # Add function to module
    module.rgb_to_grayscale = rgb_to_grayscale
    # Register module in sys.modules so imports work
    sys.modules["torchvision.transforms.functional_tensor"] = module
    # Also set as attribute on transforms module
    setattr(_tv_transforms, "functional_tensor", module)


# Ensure functional_tensor module exists before importing Real-ESRGAN
_ensure_torchvision_functional_tensor()

# Import Real-ESRGAN enhancer class
from realesrgan import RealESRGANer
# Import utility function to download model weights
from realesrgan.utils import load_file_from_url
# Import RRDBNet architecture for Real-ESRGAN
from basicsr.archs.rrdbnet_arch import RRDBNet

# URL to download pretrained Real-ESRGAN model weights
MODEL_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"
# Filename for the downloaded model
MODEL_NAME = "RealESRGAN_x4plus.pth"

# Global enhancer instance (singleton pattern)
_enhancer = None


# Function to ensure model weights are downloaded
# Returns: Path to model weights file
def _ensure_model_weights():
    """Download the Real-ESRGAN weights if they are missing."""
    # Create models directory in same folder as this script
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    # Create directory if it doesn't exist
    os.makedirs(models_dir, exist_ok=True)
    # Construct full path to model file
    model_path = os.path.join(models_dir, MODEL_NAME)

    # Download model if it doesn't exist
    if not os.path.exists(model_path):
        print("Downloading Real-ESRGAN weights... (one-time)")
        # Download from GitHub releases with progress bar
        load_file_from_url(MODEL_URL, models_dir, progress=True)

    return model_path


# Function to get or create Real-ESRGAN enhancer instance (singleton pattern)
# Returns: RealESRGANer instance
def get_enhancer():
    """Load (or reuse) the Real-ESRGAN enhancer."""
    # Access global enhancer variable
    global _enhancer
    # If already loaded, return cached instance
    if _enhancer is not None:
        return _enhancer

    # Ensure model weights are downloaded
    model_path = _ensure_model_weights()
    # Initialize RRDBNet architecture
    model = RRDBNet(
        num_in_ch=3,      # 3 input channels (RGB)
        num_out_ch=3,     # 3 output channels (RGB)
        num_feat=64,      # Number of feature channels
        num_block=23,     # Number of residual blocks
        num_grow_ch=32,   # Number of growth channels
        scale=4,          # Upscaling factor (4x)
    )

    # Create Real-ESRGAN enhancer instance
    _enhancer = RealESRGANer(
        scale=4,                    # Upscaling factor
        model_path=model_path,      # Path to model weights
        model=model,                # Model architecture
        tile=0,                     # Tile size (0 = no tiling)
        tile_pad=10,                # Padding for tiles
        pre_pad=0,                  # Pre-padding
        half=torch.cuda.is_available(),  # Use half precision if GPU available
    )
    print("Real-ESRGAN enhancer ready!")
    return _enhancer


# Function to enhance/upscale an image using Real-ESRGAN
# input_path: Path to input image file
# output_path: Path where enhanced image will be saved
# target_height: Desired height in pixels (aspect ratio preserved)
# Returns: Path to saved enhanced image
def enhance_image(input_path, output_path, target_height):
    """
    Enhance input_path to the requested target_height (keeping aspect ratio).
    Saves the enhanced image to output_path and returns that path.
    """
    # Get or create Real-ESRGAN enhancer instance
    enhancer = get_enhancer()
    # Read input image using OpenCV (BGR format)
    image = cv2.imread(input_path, cv2.IMREAD_COLOR)
    # Check if image was loaded successfully
    if image is None:
        raise ValueError(f"Unable to read image: {input_path}")

    # Get original image dimensions (height, width)
    orig_height, orig_width = image.shape[:2]
    # Calculate upscaling factor
    if target_height <= orig_height:
        # Still run through enhancer for better quality, but keep minimum scale of 1.0
        # This improves image quality even without upscaling
        scale = 1.0
    else:
        # Calculate scale needed, but cap at 4.0 (max Real-ESRGAN scale)
        scale = min(target_height / orig_height, 4.0)

    print(f"Enhancing image from {orig_height}p to ~{target_height}p (scale={scale:.2f})")

    try:
        # Enhance image using Real-ESRGAN
        # Returns enhanced image and optional alpha channel (ignored here)
        enhanced, _ = enhancer.enhance(image, outscale=scale)
    except RuntimeError as err:
        # Retry with tiles to reduce memory usage if enhancement fails
        # This happens when image is too large for GPU memory
        print(f"Real-ESRGAN tile fallback due to: {err}")
        # Enable tiling with 128x128 tiles
        enhancer.tile = 128
        enhancer.tile_pad = 10
        # Retry enhancement with tiling
        enhanced, _ = enhancer.enhance(image, outscale=scale)
        # Reset tile size for next request
        enhancer.tile = 0

    # Final resize to exact target height while preserving aspect ratio
    # Real-ESRGAN may not produce exact target size, so resize if needed
    if enhanced.shape[0] != target_height:
        # Calculate target width maintaining aspect ratio
        target_width = int(enhanced.shape[1] * (target_height / enhanced.shape[0]))
        # Resize using cubic interpolation for high quality
        enhanced = cv2.resize(enhanced, (target_width, target_height), interpolation=cv2.INTER_CUBIC)

    # Save enhanced image to output path
    cv2.imwrite(output_path, enhanced)
    return output_path

