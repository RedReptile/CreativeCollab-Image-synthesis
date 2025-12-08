import argparse
import os
import sys
import time
import re

import numpy as np
import torch
from torch.optim import Adam
from torch.utils.data import DataLoader
from torchvision import datasets
from torchvision import transforms
import torch.onnx

import utils
from transformer_net import TransformerNet
from vgg import Vgg16

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Global model cache to avoid reloading
_cached_models = {}

def load_model(model_path):
    """Load a pre-trained style transfer model"""
    with torch.no_grad():
        style_model = TransformerNet()
        state_dict = torch.load(model_path, map_location=device)
        # remove saved deprecated running_* keys in InstanceNorm from the checkpoint
        for k in list(state_dict.keys()):
            if re.search(r'in\d+\.running_(mean|var)$', k):
                del state_dict[k]
        style_model.load_state_dict(state_dict)
        style_model.to(device)
        style_model.eval()
    return style_model

def stylize(style_model, content_image, output_image):
    """Apply style transfer using a loaded model"""
    content_image = utils.load_image(content_image)
    content_transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Lambda(lambda x: x.mul(255))
    ])
    content_image = content_transform(content_image)
    content_image = content_image.unsqueeze(0).to(device)

    with torch.no_grad():
        output = style_model(content_image).cpu()
    utils.save_image(output_image, output[0])

def transfer(content_file, style_file):
    """
    Flask-compatible transfer function
    
    Args:
        content_file: Flask FileStorage object (content image)
        style_file: Flask FileStorage object (style image)
    
    Returns:
        str: Path to the output stylized image
    """
    # Create necessary directories
    temp_dir = os.path.join(os.path.dirname(__file__), 'temp')
    output_dir = os.path.join(os.path.dirname(__file__), 'output')
    models_dir = os.path.join(os.path.dirname(__file__), 'saved_models')
    
    os.makedirs(temp_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    
    # Save uploaded files temporarily
    timestamp = int(time.time())
    content_path = os.path.join(temp_dir, f'content_{timestamp}.jpg')
    style_path = os.path.join(temp_dir, f'style_{timestamp}.jpg')
    
    content_file.save(content_path)
    style_file.save(style_path)
    
    try:
        # Determine which model to use based on style image name
        # or use a default model if available
        style_name = os.path.splitext(style_file.filename)[0]
        
        # Look for available models
        model_candidates = []
        if os.path.exists(models_dir):
            model_candidates = [
                f for f in os.listdir(models_dir) 
                if f.endswith('.pth') or f.endswith('.model')
            ]
        
        if not model_candidates:
            raise FileNotFoundError(
                f"No style transfer models found in {models_dir}. "
                "Please add .pth model files to the saved_models directory."
            )
        
        # Try to match style name to a model, otherwise use first available
        model_file = None
        for candidate in model_candidates:
            if style_name.lower() in candidate.lower():
                model_file = candidate
                break
        
        if not model_file:
            model_file = model_candidates[0]
        
        model_path = os.path.join(models_dir, model_file)
        
        # Load model (with caching to avoid reloading)
        if model_path not in _cached_models:
            print(f"Loading style model: {model_file}")
            _cached_models[model_path] = load_model(model_path)
        else:
            print(f"Using cached model: {model_file}")
        
        style_model = _cached_models[model_path]
        
        # Generate output path
        output_path = os.path.join(output_dir, f'stylized_{timestamp}.jpg')
        
        # Perform style transfer
        print(f"Stylizing image with model: {model_file}")
        stylize(style_model, content_path, output_path)
        
        # Cleanup temp files
        try:
            os.remove(content_path)
            os.remove(style_path)
        except:
            pass
        
        return output_path
    
    except Exception as e:
        # Cleanup on error
        for path in [content_path, style_path]:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except:
                    pass
        raise e

# Command-line interface (original functionality)
def main():
    parser = argparse.ArgumentParser(description="Style Transfer")
    parser.add_argument("--content-image", type=str, required=True,
                        help="path to content image")
    parser.add_argument("--style-image", type=str, default=None,
                        help="path to style image (not used in inference)")
    parser.add_argument("--model", type=str, required=True,
                        help="path to style model")
    parser.add_argument("--output-image", type=str, default="output.jpg",
                        help="path to output image")
    
    args = parser.parse_args()
    
    # Load model
    style_model = load_model(args.model)
    
    # Stylize
    stylize(style_model, args.content_image, args.output_image)
    
    print(f"Stylized image saved to: {args.output_image}")

if __name__ == "__main__":
    main()