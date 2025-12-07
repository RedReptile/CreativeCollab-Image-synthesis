"""
Real-ESRGAN helper utilities for upscaling SPADE outputs.
This module downloads the pretrained weights on first use and keeps
the enhancer in memory for subsequent requests.
"""
import os
import sys
import types
import cv2
import torch


def _ensure_torchvision_functional_tensor():
    """
    Some lightweight CPU builds of torchvision omit functional_tensor.
    Basicsr/realesrgan import rgb_to_grayscale from there, so we register
    a minimal replacement if it is missing.
    """
    # If it already exists, nothing to do.
    if "torchvision.transforms.functional_tensor" in sys.modules:
        return

    try:
        import torchvision.transforms as _tv_transforms
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError(
            "torchvision is required for Real-ESRGAN. Please install torchvision."
        ) from exc

    # If newer torchvision exposes functional_tensor on transforms, re‑use it.
    if hasattr(_tv_transforms, "functional_tensor"):
        sys.modules["torchvision.transforms.functional_tensor"] = _tv_transforms.functional_tensor
        return

    # Otherwise create a minimal stub module providing rgb_to_grayscale.
    module = types.ModuleType("torchvision.transforms.functional_tensor")

    def rgb_to_grayscale(img, num_output_channels=1):
        if img.dim() < 3 or img.size(-3) != 3:
            raise ValueError("Expected tensor with channel dimension of size 3")
        r, g, b = img.unbind(dim=-3)
        gray = 0.2989 * r + 0.587 * g + 0.114 * b
        gray = gray.unsqueeze(-3)
        if num_output_channels == 3:
            gray = gray.repeat_interleave(3, dim=-3)
        elif num_output_channels != 1:
            raise ValueError("num_output_channels must be 1 or 3")
        return gray

    module.rgb_to_grayscale = rgb_to_grayscale
    sys.modules["torchvision.transforms.functional_tensor"] = module
    setattr(_tv_transforms, "functional_tensor", module)


_ensure_torchvision_functional_tensor()

from realesrgan import RealESRGANer
from realesrgan.utils import load_file_from_url
from basicsr.archs.rrdbnet_arch import RRDBNet

MODEL_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"
MODEL_NAME = "RealESRGAN_x4plus.pth"

_enhancer = None


def _ensure_model_weights():
    """Download the Real-ESRGAN weights if they are missing."""
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, MODEL_NAME)

    if not os.path.exists(model_path):
        print("Downloading Real-ESRGAN weights... (one-time)")
        load_file_from_url(MODEL_URL, models_dir, progress=True)

    return model_path


def get_enhancer():
    """Load (or reuse) the Real-ESRGAN enhancer."""
    global _enhancer
    if _enhancer is not None:
        return _enhancer

    model_path = _ensure_model_weights()
    model = RRDBNet(
        num_in_ch=3,
        num_out_ch=3,
        num_feat=64,
        num_block=23,
        num_grow_ch=32,
        scale=4,
    )

    _enhancer = RealESRGANer(
        scale=4,
        model_path=model_path,
        model=model,
        tile=0,
        tile_pad=10,
        pre_pad=0,
        half=torch.cuda.is_available(),
    )
    print("Real-ESRGAN enhancer ready!")
    return _enhancer


def enhance_image(input_path, output_path, target_height):
    """
    Enhance input_path to the requested target_height (keeping aspect ratio).
    Saves the enhanced image to output_path and returns that path.
    """
    enhancer = get_enhancer()
    image = cv2.imread(input_path, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Unable to read image: {input_path}")

    orig_height, orig_width = image.shape[:2]
    if target_height <= orig_height:
        # Still run through enhancer for better quality, but keep minimum scale of 1.0
        scale = 1.0
    else:
        scale = min(target_height / orig_height, 4.0)

    print(f"Enhancing image from {orig_height}p to ~{target_height}p (scale={scale:.2f})")

    try:
        enhanced, _ = enhancer.enhance(image, outscale=scale)
    except RuntimeError as err:
        # Retry with tiles to reduce memory usage
        print(f"Real-ESRGAN tile fallback due to: {err}")
        enhancer.tile = 128
        enhancer.tile_pad = 10
        enhanced, _ = enhancer.enhance(image, outscale=scale)
        enhancer.tile = 0

    # Final resize to exact target height while preserving aspect ratio
    if enhanced.shape[0] != target_height:
        target_width = int(enhanced.shape[1] * (target_height / enhanced.shape[0]))
        enhanced = cv2.resize(enhanced, (target_width, target_height), interpolation=cv2.INTER_CUBIC)

    cv2.imwrite(output_path, enhanced)
    return output_path

