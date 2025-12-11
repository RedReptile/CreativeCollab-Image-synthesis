# Import argparse for command-line argument parsing
import argparse
# Import os for file system operations
import os
# Import sys for system-specific parameters
import sys
# Import time for timestamp generation
import time
# Import re for regular expression operations
import re

# Import numpy for numerical operations
import numpy as np
# Import PyTorch for deep learning operations
import torch
# Import Adam optimizer (not used in this file but kept for compatibility)
from torch.optim import Adam
# Import DataLoader (not used in this file but kept for compatibility)
from torch.utils.data import DataLoader
# Import datasets (not used in this file but kept for compatibility)
from torchvision import datasets
# Import transforms for image preprocessing
from torchvision import transforms
# Import torch.onnx (not used in this file but kept for compatibility)
import torch.onnx

# Import utility functions for image loading and processing
import utils
# Import TransformerNet neural network architecture
from transformer_net import TransformerNet
# Import Vgg16 (not used in this file but kept for compatibility)
from vgg import Vgg16

# Determine computation device: use CUDA if available, otherwise CPU
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Global model cache to avoid reloading models multiple times
# Key: model path, Value: loaded model instance
_cached_models = {}

# Function to load a pre-trained style transfer model from disk
# model_path: Path to the saved model checkpoint file
# Returns: Loaded and configured TransformerNet model
def load_model(model_path):
    """Load a pre-trained style transfer model"""
    # Disable gradient computation for inference (saves memory)
    with torch.no_grad():
        # Initialize TransformerNet architecture
        style_model = TransformerNet()
        # Load model weights from checkpoint file, map to current device
        state_dict = torch.load(model_path, map_location=device)
        # Remove saved deprecated running_* keys in InstanceNorm from the checkpoint
        # These keys cause errors in newer PyTorch versions
        for k in list(state_dict.keys()):
            # Match keys like "in1.running_mean" or "in2.running_var"
            if re.search(r'in\d+\.running_(mean|var)$', k):
                del state_dict[k]
        # Load cleaned state dictionary into model
        style_model.load_state_dict(state_dict)
        # Move model to appropriate device (GPU/CPU)
        style_model.to(device)
        # Set model to evaluation mode (disables dropout, batch norm updates)
        style_model.eval()
    return style_model

# Function to apply style transfer to a content image using a loaded model
# style_model: Pre-loaded TransformerNet model instance
# content_image: Path to the input content image file
# output_image: Path where the stylized output image will be saved
def stylize(style_model, content_image, output_image):
    """Apply style transfer using a loaded model"""
    # Load content image from file using utility function
    content_image = utils.load_image(content_image)
    # Define preprocessing transform pipeline
    content_transform = transforms.Compose([
        transforms.ToTensor(),  # Convert PIL image to tensor [0, 1]
        transforms.Lambda(lambda x: x.mul(255))  # Scale to [0, 255] range
    ])
    # Apply preprocessing transform to content image
    content_image = content_transform(content_image)
    # Add batch dimension and move to device: [C, H, W] -> [1, C, H, W]
    content_image = content_image.unsqueeze(0).to(device)

    # Run inference without computing gradients (saves memory)
    with torch.no_grad():
        # Forward pass: apply style transfer
        output = style_model(content_image).cpu()
    # Save stylized output image to file
    utils.save_image(output_image, output[0])

# Flask-compatible function for style transfer via web API
# content_file: Flask FileStorage object containing the content image
# style_file: Flask FileStorage object containing the style reference image
# Returns: Path to the output stylized image file
def transfer(content_file, style_file):
    """
    Flask-compatible transfer function
    
    Args:
        content_file: Flask FileStorage object (content image)
        style_file: Flask FileStorage object (style image)
    
    Returns:
        str: Path to the output stylized image
    """
    # Create necessary directories for temporary and output files
    temp_dir = os.path.join(os.path.dirname(__file__), 'temp')
    output_dir = os.path.join(os.path.dirname(__file__), 'output')
    models_dir = os.path.join(os.path.dirname(__file__), 'saved_models')
    
    # Create directories if they don't exist (exist_ok prevents errors if they do)
    os.makedirs(temp_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate unique timestamp for file naming
    timestamp = int(time.time())
    # Create temporary file paths for uploaded images
    content_path = os.path.join(temp_dir, f'content_{timestamp}.jpg')
    style_path = os.path.join(temp_dir, f'style_{timestamp}.jpg')
    
    # Save uploaded files to temporary locations
    content_file.save(content_path)
    style_file.save(style_path)
    
    try:
        # Determine which model to use based on style image name
        # Extract style name from filename (without extension)
        style_name = os.path.splitext(style_file.filename)[0]
        
        # Look for available model files in models directory
        model_candidates = []
        if os.path.exists(models_dir):
            # Find all .pth and .model files in models directory
            model_candidates = [
                f for f in os.listdir(models_dir) 
                if f.endswith('.pth') or f.endswith('.model')
            ]
        
        # Raise error if no models found
        if not model_candidates:
            raise FileNotFoundError(
                f"No style transfer models found in {models_dir}. "
                "Please add .pth model files to the saved_models directory."
            )
        
        # Try to match style name to a model filename, otherwise use first available
        model_file = None
        for candidate in model_candidates:
            # Case-insensitive matching of style name in model filename
            if style_name.lower() in candidate.lower():
                model_file = candidate
                break
        
        # If no match found, use the first available model
        if not model_file:
            model_file = model_candidates[0]
        
        # Construct full path to model file
        model_path = os.path.join(models_dir, model_file)
        
        # Load model (with caching to avoid reloading same model multiple times)
        if model_path not in _cached_models:
            print(f"Loading style model: {model_file}")
            # Load and cache the model
            _cached_models[model_path] = load_model(model_path)
        else:
            print(f"Using cached model: {model_file}")
        
        # Get model from cache
        style_model = _cached_models[model_path]
        
        # Generate unique output file path
        output_path = os.path.join(output_dir, f'stylized_{timestamp}.jpg')
        
        # Perform style transfer using loaded model
        print(f"Stylizing image with model: {model_file}")
        stylize(style_model, content_path, output_path)
        
        # Cleanup temporary files after processing
        try:
            os.remove(content_path)
            os.remove(style_path)
        except:
            # Ignore errors during cleanup
            pass
        
        # Return path to output image
        return output_path
    
    except Exception as e:
        # Cleanup temporary files on error
        for path in [content_path, style_path]:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except:
                    # Ignore cleanup errors
                    pass
        # Re-raise the exception
        raise e

# Command-line interface (original functionality)
# Main entry point for command-line usage
def main():
    # Create argument parser with description
    parser = argparse.ArgumentParser(description="Style Transfer")
    # Path to input content image (required)
    parser.add_argument("--content-image", type=str, required=True,
                        help="path to content image")
    # Path to style image (optional, not used in inference but kept for compatibility)
    parser.add_argument("--style-image", type=str, default=None,
                        help="path to style image (not used in inference)")
    # Path to trained model file (required)
    parser.add_argument("--model", type=str, required=True,
                        help="path to style model")
    # Path where output image will be saved (default: output.jpg)
    parser.add_argument("--output-image", type=str, default="output.jpg",
                        help="path to output image")
    
    # Parse command-line arguments
    args = parser.parse_args()
    
    # Load pre-trained model from specified path
    style_model = load_model(args.model)
    
    # Apply style transfer to content image
    stylize(style_model, args.content_image, args.output_image)
    
    # Print confirmation message with output path
    print(f"Stylized image saved to: {args.output_image}")

# Execute main function when script is run directly
if __name__ == "__main__":
    main()