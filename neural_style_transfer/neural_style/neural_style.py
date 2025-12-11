# Import argparse for command-line argument parsing
import argparse
# Import os for file system operations
import os
# Import sys for system-specific parameters and functions
import sys
# Import time for timestamp generation
import time
# Import re for regular expression operations (used for cleaning state dict keys)
import re

# Import numpy for numerical operations
import numpy as np
# Import PyTorch for deep learning operations
import torch
# Import Adam optimizer for training
from torch.optim import Adam
# Import DataLoader for batching training data
from torch.utils.data import DataLoader
# Import datasets for loading image datasets
from torchvision import datasets
# Import transforms for image preprocessing
from torchvision import transforms
# Import torch.onnx for ONNX model export
import torch.onnx

# Import utility functions for image loading and processing
import utils
# Import TransformerNet neural network architecture
from transformer_net import TransformerNet
# Import VGG16 model for feature extraction
from vgg import Vgg16


# Function to check and create necessary directories for model saving
# args: Command-line arguments containing directory paths
def check_paths(args):
    try:
        # Check if save_model_dir exists, create if it doesn't
        if not os.path.exists(args.save_model_dir):
            os.makedirs(args.save_model_dir)
        # Check if checkpoint_model_dir is specified and exists, create if needed
        if args.checkpoint_model_dir is not None and not (os.path.exists(args.checkpoint_model_dir)):
            os.makedirs(args.checkpoint_model_dir)
    except OSError as e:
        # Print error and exit if directory creation fails
        print(e)
        sys.exit(1)


# Main training function for neural style transfer model
# args: Command-line arguments containing training hyperparameters
def train(args):
    # Determine computation device (accelerator or CPU)
    if args.accel:
        # Use PyTorch accelerator if available
        device = torch.accelerator.current_accelerator()
    else:
        # Fallback to CPU
        device = torch.device("cpu")

    # Print device information for debugging
    print(f"Using device: {device}")

    # Set random seeds for reproducibility
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    # Define image preprocessing pipeline for training data
    transform = transforms.Compose([
        transforms.Resize(args.image_size),  # Resize to specified size
        transforms.CenterCrop(args.image_size),  # Center crop to square
        transforms.ToTensor(),  # Convert PIL image to tensor [0, 1]
        transforms.Lambda(lambda x: x.mul(255))  # Scale to [0, 255] range
    ])
    # Load training dataset from folder structure
    train_dataset = datasets.ImageFolder(args.dataset, transform)
    # Create data loader with specified batch size
    train_loader = DataLoader(train_dataset, batch_size=args.batch_size)

    # Initialize TransformerNet model and move to device
    transformer = TransformerNet().to(device)
    # Initialize Adam optimizer with learning rate
    optimizer = Adam(transformer.parameters(), args.lr)
    # Define Mean Squared Error loss function
    mse_loss = torch.nn.MSELoss()

    # Load VGG16 model for feature extraction (no gradients needed)
    vgg = Vgg16(requires_grad=False).to(device)
    # Define preprocessing for style image
    style_transform = transforms.Compose([
        transforms.ToTensor(),  # Convert to tensor
        transforms.Lambda(lambda x: x.mul(255))  # Scale to [0, 255]
    ])
    # Load style image from file
    style = utils.load_image(args.style_image, size=args.style_size)
    # Apply preprocessing transform
    style = style_transform(style)
    # Repeat style image to match batch size for efficient processing
    style = style.repeat(args.batch_size, 1, 1, 1).to(device)

    # Extract style features using VGG16
    features_style = vgg(utils.normalize_batch(style))
    # Compute Gram matrices for style features (captures style statistics)
    gram_style = [utils.gram_matrix(y) for y in features_style]

    # Training loop over specified number of epochs
    for e in range(args.epochs):
        # Set model to training mode (enables dropout, batch norm updates)
        transformer.train()
        # Initialize accumulators for loss tracking
        agg_content_loss = 0.
        agg_style_loss = 0.
        count = 0
        # Iterate over batches in training data
        for batch_id, (x, _) in enumerate(train_loader):
            # Get actual batch size (may be smaller for last batch)
            n_batch = len(x)
            # Accumulate total number of images processed
            count += n_batch
            # Zero out gradients from previous iteration
            optimizer.zero_grad()

            # Move input images to device (GPU/CPU)
            x = x.to(device)
            # Forward pass: generate stylized image
            y = transformer(x)

            # Normalize batches for VGG feature extraction
            y = utils.normalize_batch(y)
            x = utils.normalize_batch(x)

            # Extract features from stylized and original images using VGG
            features_y = vgg(y)
            features_x = vgg(x)

            # Compute content loss: difference between features at relu2_2 layer
            # This ensures the output preserves content structure
            content_loss = args.content_weight * mse_loss(features_y.relu2_2, features_x.relu2_2)

            # Compute style loss: difference between Gram matrices
            style_loss = 0.
            # Compare Gram matrices at each feature layer
            for ft_y, gm_s in zip(features_y, gram_style):
                # Compute Gram matrix for output features
                gm_y = utils.gram_matrix(ft_y)
                # Add MSE loss between Gram matrices (only for current batch size)
                style_loss += mse_loss(gm_y, gm_s[:n_batch, :, :])
            # Scale style loss by weight hyperparameter
            style_loss *= args.style_weight

            # Total loss is sum of content and style losses
            total_loss = content_loss + style_loss
            # Backward pass: compute gradients
            total_loss.backward()
            # Update model parameters using computed gradients
            optimizer.step()

            # Accumulate losses for logging
            agg_content_loss += content_loss.item()
            agg_style_loss += style_loss.item()

            # Log training progress at specified intervals
            if (batch_id + 1) % args.log_interval == 0:
                # Format and print training statistics
                mesg = "{}\tEpoch {}:\t[{}/{}]\tcontent: {:.6f}\tstyle: {:.6f}\ttotal: {:.6f}".format(
                    time.ctime(), e + 1, count, len(train_dataset),
                                  agg_content_loss / (batch_id + 1),
                                  agg_style_loss / (batch_id + 1),
                                  (agg_content_loss + agg_style_loss) / (batch_id + 1)
                )
                print(mesg)

            # Save checkpoint at specified intervals
            if args.checkpoint_model_dir is not None and (batch_id + 1) % args.checkpoint_interval == 0:
                # Switch to eval mode and move to CPU for saving
                transformer.eval().cpu()
                # Generate checkpoint filename with epoch and batch info
                ckpt_model_filename = "ckpt_epoch_" + str(e) + "_batch_id_" + str(batch_id + 1) + ".pth"
                ckpt_model_path = os.path.join(args.checkpoint_model_dir, ckpt_model_filename)
                # Save model state dictionary
                torch.save(transformer.state_dict(), ckpt_model_path)
                # Return to training mode and move back to device
                transformer.to(device).train()

    # Save final trained model
    # Switch to evaluation mode and move to CPU for saving
    transformer.eval().cpu()
    # Generate timestamp for unique filename
    timestamp = time.strftime("%Y-%m-%d_%H-%M-%S")
    # Create filename with training parameters for identification
    save_model_filename = f"epoch_{args.epochs}_{timestamp}_{args.content_weight}_{args.style_weight}.model"
    # Construct full path to save model
    save_model_path = os.path.join(args.save_model_dir, save_model_filename)
    # Save model state dictionary (weights and biases)
    torch.save(transformer.state_dict(), save_model_path)

    # Print confirmation message with save location
    print("\nDone, trained model saved at", save_model_path)


# Function to apply style transfer to a content image using a trained model
# args: Command-line arguments containing model path and image paths
def stylize(args):
    # Determine computation device
    if args.accel:
        # Use PyTorch accelerator if available
        device = torch.accelerator.current_accelerator()
    else:
        # Fallback to CPU
        device = torch.device("cpu")
    
    # Print device information
    print(f"Using device: {device}")

    # Load content image from file (with optional scaling)
    content_image = utils.load_image(args.content_image, scale=args.content_scale)
    # Define preprocessing transform for content image
    content_transform = transforms.Compose([
        transforms.ToTensor(),  # Convert PIL image to tensor [0, 1]
        transforms.Lambda(lambda x: x.mul(255))  # Scale to [0, 255]
    ])
    # Apply transform to content image
    content_image = content_transform(content_image)
    # Add batch dimension and move to device: [C, H, W] -> [1, C, H, W]
    content_image = content_image.unsqueeze(0).to(device)

    # Check if model is ONNX format
    if args.model.endswith(".onnx"):
        # Use ONNX runtime for inference
        output = stylize_onnx(content_image, args)
    else:
        # Use PyTorch model for inference
        with torch.no_grad():  # Disable gradient computation for inference
            # Initialize TransformerNet architecture
            style_model = TransformerNet()
            # Load trained model weights from checkpoint
            state_dict = torch.load(args.model)
            # Remove saved deprecated running_* keys in InstanceNorm from the checkpoint
            # These keys are not needed and cause errors in newer PyTorch versions
            for k in list(state_dict.keys()):
                # Match keys like "in1.running_mean" or "in2.running_var"
                if re.search(r'in\d+\.running_(mean|var)$', k):
                    del state_dict[k]
            # Load cleaned state dictionary into model
            style_model.load_state_dict(state_dict)
            # Move model to device
            style_model.to(device)
            # Set model to evaluation mode
            style_model.eval()
            # Check if exporting to ONNX format
            if args.export_onnx:
                # Validate ONNX export filename
                assert args.export_onnx.endswith(".onnx"), "Export model file should end with .onnx"
                # Export model to ONNX format
                output = torch.onnx._export(
                    style_model, content_image, args.export_onnx, opset_version=11,
                ).cpu()            
            else:
                # Run inference: apply style transfer
                output = style_model(content_image).cpu()
    # Save stylized output image to file
    utils.save_image(args.output_image, output[0])


# Function to apply style transfer using an ONNX model via onnxruntime
# content_image: Preprocessed content image tensor
# args: Command-line arguments containing ONNX model path
# Returns: Stylized image tensor
def stylize_onnx(content_image, args):
    """
    Read ONNX model and run it using onnxruntime
    """

    # Ensure we're not trying to export while using ONNX inference
    assert not args.export_onnx

    # Import onnxruntime for ONNX model inference
    import onnxruntime

    # Create ONNX runtime inference session from model file
    ort_session = onnxruntime.InferenceSession(args.model)

    # Helper function to convert PyTorch tensor to numpy array
    def to_numpy(tensor):
        # If tensor requires gradients, detach first, then convert to numpy
        return (
            tensor.detach().cpu().numpy()
            if tensor.requires_grad
            else tensor.cpu().numpy()
        )

    # Prepare input dictionary for ONNX runtime
    # Get input name from model and convert tensor to numpy
    ort_inputs = {ort_session.get_inputs()[0].name: to_numpy(content_image)}
    # Run inference using ONNX runtime
    ort_outs = ort_session.run(None, ort_inputs)
    # Extract output tensor (first element of output list)
    img_out_y = ort_outs[0]

    # Convert numpy array back to PyTorch tensor
    return torch.from_numpy(img_out_y)


# Main entry point for the script
def main():
    # Create main argument parser with description
    main_arg_parser = argparse.ArgumentParser(description="parser for fast-neural-style")
    # Create subparsers for different commands (train/eval)
    subparsers = main_arg_parser.add_subparsers(title="subcommands", dest="subcommand")

    # Create parser for training command
    train_arg_parser = subparsers.add_parser("train", help="parser for training arguments")
    # Number of complete passes through the training dataset
    train_arg_parser.add_argument("--epochs", type=int, default=2,
                                  help="number of training epochs, default is 2")
    # Number of images processed together in one iteration
    train_arg_parser.add_argument("--batch-size", type=int, default=4,
                                  help="batch size for training, default is 4")
    # Path to directory containing training images
    train_arg_parser.add_argument("--dataset", type=str, required=True,
                                  help="path to training dataset, the path should point to a folder "
                                       "containing another folder with all the training images")
    # Path to style reference image
    train_arg_parser.add_argument("--style-image", type=str, default="images/style-images/mosaic.jpg",
                                  help="path to style-image")
    # Directory where final trained model will be saved
    train_arg_parser.add_argument("--save-model-dir", type=str, required=True,
                                  help="path to folder where trained model will be saved.")
    # Directory where intermediate checkpoints will be saved
    train_arg_parser.add_argument("--checkpoint-model-dir", type=str, default=None,
                                  help="path to folder where checkpoints of trained models will be saved")
    # Size to resize training images to (square)
    train_arg_parser.add_argument("--image-size", type=int, default=256,
                                  help="size of training images, default is 256 X 256")
    # Optional size to resize style image to
    train_arg_parser.add_argument("--style-size", type=int, default=None,
                                  help="size of style-image, default is the original size of style image")
    # Flag to enable PyTorch accelerator
    train_arg_parser.add_argument('--accel', action='store_true',
                                  help='use accelerator')
    # Random seed for reproducibility
    train_arg_parser.add_argument("--seed", type=int, default=42,
                                  help="random seed for training")
    # Weight multiplier for content loss term
    train_arg_parser.add_argument("--content-weight", type=float, default=1e5,
                                  help="weight for content-loss, default is 1e5")
    # Weight multiplier for style loss term
    train_arg_parser.add_argument("--style-weight", type=float, default=1e10,
                                  help="weight for style-loss, default is 1e10")
    # Learning rate for Adam optimizer
    train_arg_parser.add_argument("--lr", type=float, default=1e-3,
                                  help="learning rate, default is 1e-3")
    # Interval (in batches) for logging training progress
    train_arg_parser.add_argument("--log-interval", type=int, default=500,
                                  help="number of images after which the training loss is logged, default is 500")
    # Interval (in batches) for saving checkpoints
    train_arg_parser.add_argument("--checkpoint-interval", type=int, default=2000,
                                  help="number of batches after which a checkpoint of the trained model will be created")

    # Create parser for evaluation/stylization command
    eval_arg_parser = subparsers.add_parser("eval", help="parser for evaluation/stylizing arguments")
    # Path to input content image to stylize
    eval_arg_parser.add_argument("--content-image", type=str, required=True,
                                 help="path to content image you want to stylize")
    # Optional scaling factor to resize content image before processing
    eval_arg_parser.add_argument("--content-scale", type=float, default=None,
                                 help="factor for scaling down the content image")
    # Path where stylized output image will be saved
    eval_arg_parser.add_argument("--output-image", type=str, required=True,
                                 help="path for saving the output image")
    # Path to trained model file (.pth for PyTorch, .onnx for ONNX)
    eval_arg_parser.add_argument("--model", type=str, required=True,
                                 help="saved model to be used for stylizing the image. If file ends in .pth - PyTorch path is used, if in .onnx - Caffe2 path")
    # Optional path to export model as ONNX format
    eval_arg_parser.add_argument("--export_onnx", type=str,
                                 help="export ONNX model to a given file")
    # Flag to enable PyTorch accelerator
    eval_arg_parser.add_argument('--accel', action='store_true',
                                 help='use accelerator')

    # Parse command-line arguments
    args = main_arg_parser.parse_args()

    # Validate that a subcommand was specified
    if args.subcommand is None:
        print("ERROR: specify either train or eval")
        sys.exit(1)
    # Check if accelerator was requested but not available
    if args.accel and not torch.accelerator.is_available():
        print("ERROR: accelerator is not available, try running on CPU")
        sys.exit(1)
    # Warn if accelerator is available but not used
    if not args.accel and torch.accelerator.is_available():
        print("WARNING: accelerator is available, run with --accel to enable it")

    # Execute appropriate function based on subcommand
    if args.subcommand == "train":
        # Check/create directories, then start training
        check_paths(args)
        train(args)
    else:
        # Run stylization on content image
        stylize(args)


if __name__ == "__main__":
    main()
