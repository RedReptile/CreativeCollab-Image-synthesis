import os
import sys
import cv2
import numpy as np
from PIL import Image
import torch
from torchvision.transforms import ToPILImage

# Add spade folder to path
spade_flask_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../spade/gaugan/flask'))
if spade_flask_path not in sys.path:
    sys.path.insert(0, spade_flask_path)

# Handle sync_batchnorm import - use fallback if not available
# Patch sys.modules before importing spade modules
try:
    from sync_batchnorm import SynchronizedBatchNorm2d
except ImportError:
    # Create a fallback module
    import torch.nn as nn
    
    class SynchronizedBatchNorm2d(nn.BatchNorm2d):
        """Fallback to regular BatchNorm2d if sync_batchnorm is not available"""
        pass
    
    # Patch the module so spade.normalizer can import it
    import types
    sync_batchnorm_module = types.ModuleType('sync_batchnorm')
    sync_batchnorm_module.SynchronizedBatchNorm2d = SynchronizedBatchNorm2d
    sys.modules['sync_batchnorm'] = sync_batchnorm_module
    print("Warning: sync_batchnorm not found, using regular BatchNorm2d as fallback")

# Import SPADE modules (after patching sync_batchnorm)
from spade.model import Pix2PixModel
from spade.dataset import get_transform

# Global model instance (loaded once)
_model = None
_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def load_spade_model():
    """Load SPADE model (singleton pattern)"""
    global _model
    
    if _model is not None:
        return _model
    
    try:
        # Path to pretrained model
        base_dir = os.path.dirname(__file__)
        trainedmodel_dir = os.path.abspath(os.path.join(base_dir, '../spade/gaugan/trained_model/landscapes'))
        
        print(f"Looking for trained model in: {trainedmodel_dir}")
        
        if not os.path.exists(trainedmodel_dir):
            raise FileNotFoundError(f"model directory not found: {trainedmodel_dir}")
        
        # Check if model files exist
        model_file = os.path.join(trainedmodel_dir, 'latest_net_G.pth')
        if not os.path.exists(model_file):
            raise FileNotFoundError(f"Model file not found: {model_file}")
        
        opt = {
            'label_nc': 182,  # Number of classes in COCO model
            'crop_size': 512,
            'load_size': 512,
            'aspect_ratio': 1.0,
            'isTrain': False,
            'checkpoints_dir': trainedmodel_dir,
            'which_epoch': 'latest',
            'use_gpu': torch.cuda.is_available()
        }
        
        print(f"Loading SPADE model from {trainedmodel_dir}...")
        print(f"Using device: {'CUDA' if opt['use_gpu'] else 'CPU'}")
        
        _model = Pix2PixModel(opt)
        _model.eval()
        print("SPADE model loaded successfully!")
        
        return _model
    except Exception as e:
        print(f"Error loading SPADE model: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

# Color to class ID mapping for SPADE (based on COCO classes)
# These are the colors that map to specific semantic classes
COLOR_TO_CLASS = {
    (117, 158, 223): 156,  # sky (#759edf)
    (183, 210, 78): 123,   # grass (#b7d24e)
    (53, 38, 19): 168,     # tree (#352613)
    (60, 59, 75): 134,     # mountain (#3c3b4b)
    (56, 79, 131): 154,    # sea (#384f83)
    (50, 96, 77): 147,     # river (#32604d)
    (152, 126, 106): 148,  # road (#987e6a)
    (93, 110, 50): 96,     # bush (#5d6e32)
    (230, 112, 182): 118,  # flower (#e670b6)
    (193, 195, 201): 119,  # fog (#c1c3c9)
    (119, 108, 45): 126,   # hill (#776c2d)
    (255, 255, 255): 181,  # unknown/background (white)
    (0, 0, 0): 181,        # unknown/background (black)
}

def rgb_to_class_id(r, g, b, tolerance=30):
    """
    Convert RGB color to class ID with tolerance for color matching.
    Returns class ID or 181 (unknown) if no match found.
    """
    # Try exact match first
    if (r, g, b) in COLOR_TO_CLASS:
        return COLOR_TO_CLASS[(r, g, b)]
    
    # Try approximate match with tolerance
    for (cr, cg, cb), class_id in COLOR_TO_CLASS.items():
        if abs(r - cr) <= tolerance and abs(g - cg) <= tolerance and abs(b - cb) <= tolerance:
            return class_id
    
    # Default to unknown class (181)
    return 181

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
        # Create output directory
        os.makedirs("images/spade-output", exist_ok=True)
        output_path = os.path.join("images/spade-output", output_name)
        
        # Load SPADE model
        model = load_spade_model()
        
        # Load segmentation map
        seg_image = Image.open(segmentation_path).convert('RGB')
        seg_array = np.array(seg_image)
        
        # Convert RGB colors to class IDs using vectorized operations
        height, width = seg_array.shape[:2]
        # Use 181 as unknown (last valid class for 182 classes: 0-181)
        label_array = np.full((height, width), 181, dtype=np.uint8)  # Default to unknown
        
        print(f"Converting {height}x{width} image to label map...")
        
        # Vectorized color matching with tolerance
        for (cr, cg, cb), class_id in COLOR_TO_CLASS.items():
            # Create masks for pixels within tolerance
            r_diff = np.abs(seg_array[:, :, 0].astype(np.int16) - cr)
            g_diff = np.abs(seg_array[:, :, 1].astype(np.int16) - cg)
            b_diff = np.abs(seg_array[:, :, 2].astype(np.int16) - cb)
            
            # Match if all channels are within tolerance
            mask = (r_diff <= 30) & (g_diff <= 30) & (b_diff <= 30)
            label_array[mask] = class_id
        
        # Create labelmap image
        labelmap = Image.fromarray(label_array, mode='L')
        
        # Setup transforms
        opt = {
            'label_nc': 182,
            'crop_size': 512,
            'load_size': 512,
            'aspect_ratio': 1.0,
            'isTrain': False,
        }
        
        transform_label = get_transform(opt, method=Image.NEAREST, normalize=False)
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
        
        # Create blank image for encoder (not used in inference mode)
        image_tensor = transform_image(Image.new('RGB', (512, 512)))
        
        # Prepare data
        data = {
            'label': label_tensor.unsqueeze(0).long(),
            'instance': label_tensor.unsqueeze(0).long(),
            'image': image_tensor.unsqueeze(0)
        }
        
        # Generate image
        print("Generating image with SPADE model...")
        with torch.no_grad():
            generated = model(data, mode='inference')
        
        # Convert to PIL Image
        to_img = ToPILImage()
        # Normalize from [-1, 1] to [0, 255]
        # Handle batch dimension: generated is [1, 3, H, W] or [3, H, W]
        if len(generated.shape) == 4:
            generated = generated.squeeze(0)  # Remove batch dimension
        normalized_img = ((generated + 1) / 2.0) * 255.0
        normalized_img = torch.clamp(normalized_img, 0, 255)
        output_image = to_img(normalized_img.byte().cpu())
        
        # Save output
        output_image.save(output_path, 'JPEG')
        
        print(f"Generated image saved to: {output_path}")
        return output_path
    
    except FileNotFoundError as e:
        error_msg = f"Model or file not found: {str(e)}"
        print(f"Error in generate_image: {error_msg}")
        raise FileNotFoundError(error_msg)
    except Exception as e:
        error_msg = f"Error generating image: {str(e)}"
        print(f"Error in generate_image: {error_msg}")
        import traceback
        traceback.print_exc()
        raise RuntimeError(error_msg) from e