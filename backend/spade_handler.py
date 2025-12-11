# Import os for file system operations
import os
# Import sys for path manipulation
import sys
# Import cv2 (OpenCV) for image processing (not directly used but may be needed)
import cv2
# Import numpy for array operations
import numpy as np
# Import PIL Image for image loading and manipulation
from PIL import Image
# Import PyTorch for deep learning operations
import torch
# Import ToPILImage for converting tensors back to PIL Images
from torchvision.transforms import ToPILImage

# Add spade folder to Python path so we can import SPADE modules
spade_flask_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../spade/gaugan/flask'))
if spade_flask_path not in sys.path:
    # Insert at beginning for priority
    sys.path.insert(0, spade_flask_path)

# Handle sync_batchnorm import - use fallback if not available
# SPADE models may use synchronized batch normalization, but it's optional
# Patch sys.modules before importing spade modules
try:
    # Try to import synchronized batch normalization
    from sync_batchnorm import SynchronizedBatchNorm2d
except ImportError:
    # Create a fallback module if sync_batchnorm is not installed
    import torch.nn as nn
    
    # Create fallback class that uses regular BatchNorm2d
    class SynchronizedBatchNorm2d(nn.BatchNorm2d):
        """Fallback to regular BatchNorm2d if sync_batchnorm is not available"""
        pass
    
    # Patch the module so spade.normalizer can import it
    import types
    # Create a new module object
    sync_batchnorm_module = types.ModuleType('sync_batchnorm')
    # Add the fallback class to the module
    sync_batchnorm_module.SynchronizedBatchNorm2d = SynchronizedBatchNorm2d
    # Register the module in sys.modules so imports work
    sys.modules['sync_batchnorm'] = sync_batchnorm_module
    print("Warning: sync_batchnorm not found, using regular BatchNorm2d as fallback")

# Import SPADE modules (after patching sync_batchnorm)
# Import Pix2PixModel which wraps the SPADE generator
from spade.model import Pix2PixModel
# Import get_transform for preprocessing segmentation maps
from spade.dataset import get_transform

# Global model instance (loaded once using singleton pattern)
# This avoids reloading the model on every request, improving performance
_model = None
# Determine computation device: use CUDA GPU if available, otherwise CPU
_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Function to load SPADE model using singleton pattern
# Returns: Loaded SPADE model instance
def load_spade_model():
    """Load SPADE model (singleton pattern)"""
    # Access global model variable
    global _model
    
    # If model already loaded, return cached instance
    if _model is not None:
        return _model
    
    try:
        # Path to pretrained model directory
        base_dir = os.path.dirname(__file__)
        # Construct path to trained model directory
        trainedmodel_dir = os.path.abspath(os.path.join(base_dir, '../spade/gaugan/trained_model/landscapes'))
        
        print(f"Looking for trained model in: {trainedmodel_dir}")
        
        # Check if model directory exists
        if not os.path.exists(trainedmodel_dir):
            raise FileNotFoundError(f"model directory not found: {trainedmodel_dir}")
        
        # Check if model checkpoint file exists
        model_file = os.path.join(trainedmodel_dir, 'latest_net_G.pth')
        if not os.path.exists(model_file):
            raise FileNotFoundError(f"Model file not found: {model_file}")
        
        # Configuration dictionary for SPADE model
        opt = {
            'label_nc': 182,  # Number of classes in COCO model (182 semantic classes)
            'crop_size': 512,  # Size to crop images to during processing
            'load_size': 512,  # Size to load images at
            'aspect_ratio': 1.0,  # Aspect ratio (1.0 = square)
            'isTrain': False,  # Set to False for inference mode
            'checkpoints_dir': trainedmodel_dir,  # Directory containing model checkpoints
            'which_epoch': 'latest',  # Which checkpoint to load ('latest' or epoch number)
            'use_gpu': torch.cuda.is_available()  # Whether to use GPU
        }
        
        print(f"Loading SPADE model from {trainedmodel_dir}...")
        print(f"Using device: {'CUDA' if opt['use_gpu'] else 'CPU'}")
        
        # Initialize SPADE model with configuration
        _model = Pix2PixModel(opt)
        # Set model to evaluation mode (disables dropout, batch norm updates)
        _model.eval()
        print("SPADE model loaded successfully!")
        
        return _model
    except Exception as e:
        # Print error and traceback if loading fails
        print(f"Error loading SPADE model: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

# Color to class ID mapping for SPADE (based on COCO classes)
# These are the RGB colors that map to specific semantic classes in the segmentation map
# The model expects class IDs (0-181) but receives RGB segmentation maps, so we convert
COLOR_TO_CLASS = {
    (117, 158, 223): 156,  # sky (#759edf) - light blue
    (183, 210, 78): 123,   # grass (#b7d24e) - light green
    (53, 38, 19): 168,     # tree (#352613) - dark brown
    (60, 59, 75): 134,     # mountain (#3c3b4b) - dark gray-blue
    (56, 79, 131): 154,    # sea (#384f83) - dark blue
    (50, 96, 77): 147,     # river (#32604d) - dark green-blue
    (152, 126, 106): 148,  # road (#987e6a) - brown-gray
    (93, 110, 50): 96,     # bush (#5d6e32) - olive green
    (230, 112, 182): 118,  # flower (#e670b6) - pink
    (193, 195, 201): 119,  # fog (#c1c3c9) - light gray
    (119, 108, 45): 126,   # hill (#776c2d) - brown
    (255, 255, 255): 181,  # unknown/background (white)
    (0, 0, 0): 181,        # unknown/background (black)
}

# Function to convert RGB color to class ID with tolerance matching
# r, g, b: RGB color values (0-255)
# tolerance: Maximum allowed difference in each channel for matching (default: 30)
# Returns: Class ID (0-181) or 181 (unknown) if no match found
def rgb_to_class_id(r, g, b, tolerance=30):
    """
    Convert RGB color to class ID with tolerance for color matching.
    Returns class ID or 181 (unknown) if no match found.
    """
    # Try exact match first (fastest path)
    if (r, g, b) in COLOR_TO_CLASS:
        return COLOR_TO_CLASS[(r, g, b)]
    
    # Try approximate match with tolerance
    # Iterate through all color mappings
    for (cr, cg, cb), class_id in COLOR_TO_CLASS.items():
        # Check if all channels are within tolerance
        if abs(r - cr) <= tolerance and abs(g - cg) <= tolerance and abs(b - cb) <= tolerance:
            return class_id
    
    # Default to unknown class (181) if no match found
    return 181

# Main function to generate image from segmentation map using SPADE model
# segmentation_path: Path to input segmentation map image (RGB image with semantic colors)
# output_name: Filename for the generated output image
# Returns: Path to the generated image file
def generate_image(segmentation_path, output_name="output.jpg"):
    """
    Generate image from segmentation map using SPADE model
    
    Args:
        segmentation_path: Path to segmentation map image
        output_name: Name for output file
    
    Returns:
        Path to generated image
    """
    try:
        # Create output directory if it doesn't exist
        os.makedirs("images/spade-output", exist_ok=True)
        # Construct full output path
        output_path = os.path.join("images/spade-output", output_name)
        
        # Load SPADE model (singleton pattern - loads once, reuses)
        model = load_spade_model()
        
        # Load segmentation map image
        seg_image = Image.open(segmentation_path).convert('RGB')
        # Convert PIL image to numpy array for processing
        seg_array = np.array(seg_image)
        
        # Convert RGB colors to class IDs using vectorized operations
        # Get image dimensions
        height, width = seg_array.shape[:2]
        # Use 181 as unknown (last valid class for 182 classes: 0-181)
        # Initialize label array with unknown class ID
        label_array = np.full((height, width), 181, dtype=np.uint8)  # Default to unknown
        
        print(f"Converting {height}x{width} image to label map...")
        
        # Vectorized color matching with tolerance (much faster than pixel-by-pixel)
        for (cr, cg, cb), class_id in COLOR_TO_CLASS.items():
            # Create masks for pixels within tolerance in each channel
            # Convert to int16 to handle negative differences
            r_diff = np.abs(seg_array[:, :, 0].astype(np.int16) - cr)
            g_diff = np.abs(seg_array[:, :, 1].astype(np.int16) - cg)
            b_diff = np.abs(seg_array[:, :, 2].astype(np.int16) - cb)
            
            # Match if all channels are within tolerance (30 pixels)
            mask = (r_diff <= 30) & (g_diff <= 30) & (b_diff <= 30)
            # Assign class ID to matching pixels
            label_array[mask] = class_id
        
        # Create labelmap image from numpy array (grayscale mode)
        labelmap = Image.fromarray(label_array, mode='L')
        
        # Setup transform configuration
        opt = {
            'label_nc': 182,  # Number of classes
            'crop_size': 512,  # Size to crop to
            'load_size': 512,  # Size to load at
            'aspect_ratio': 1.0,  # Square aspect ratio
            'isTrain': False,  # Inference mode
        }
        
        # Get transform for label map (nearest neighbor, no normalization)
        transform_label = get_transform(opt, method=Image.NEAREST, normalize=False)
        # Get transform for image (used for blank image)
        transform_image = get_transform(opt)
        
        # Transform label map
        # transforms.ToTensor rescales from [0,255] to [0.0,1.0]
        # Rescale back to [0,255] to match label IDs
        label_tensor = transform_label(labelmap) * 255.0
        # Ensure values are integers and in valid range [0, 181] for 182 classes
        label_tensor = label_tensor.long()
        # Clamp values to valid range (0 to label_nc-1, which is 0-181)
        label_tensor = torch.clamp(label_tensor, 0, opt['label_nc'] - 1)
        # The model expects label_nc (182) as unknown, but we'll use 181 (last valid class)
        # Map any out-of-range values to 181
        label_tensor[label_tensor >= opt['label_nc']] = opt['label_nc'] - 1
        
        # Create blank image for encoder (not used in inference mode but required by model)
        image_tensor = transform_image(Image.new('RGB', (512, 512)))
        
        # Prepare data dictionary for model input
        data = {
            'label': label_tensor.unsqueeze(0).long(),  # Add batch dimension, ensure long type
            'instance': label_tensor.unsqueeze(0).long(),  # Instance map same as label map
            'image': image_tensor.unsqueeze(0)  # Blank image (not used in inference)
        }
        
        # Generate image using SPADE model
        print("Generating image with SPADE model...")
        # Disable gradient computation for inference (saves memory)
        with torch.no_grad():
            # Run model in inference mode
            generated = model(data, mode='inference')
        
        # Convert to PIL Image
        to_img = ToPILImage()
        # Normalize from [-1, 1] to [0, 255]
        # Handle batch dimension: generated is [1, 3, H, W] or [3, H, W]
        if len(generated.shape) == 4:
            generated = generated.squeeze(0)  # Remove batch dimension if present
        # Convert from [-1, 1] range to [0, 255]
        normalized_img = ((generated + 1) / 2.0) * 255.0
        # Clamp to valid pixel range
        normalized_img = torch.clamp(normalized_img, 0, 255)
        # Convert tensor to PIL Image
        output_image = to_img(normalized_img.byte().cpu())
        
        # Save output image as JPEG
        output_image.save(output_path, 'JPEG')
        
        print(f"Generated image saved to: {output_path}")
        return output_path
    
    except FileNotFoundError as e:
        # Handle file not found errors
        error_msg = f"Model or file not found: {str(e)}"
        print(f"Error in generate_image: {error_msg}")
        raise FileNotFoundError(error_msg)
    except Exception as e:
        # Handle all other errors
        error_msg = f"Error generating image: {str(e)}"
        print(f"Error in generate_image: {error_msg}")
        import traceback
        traceback.print_exc()
        raise RuntimeError(error_msg) from e