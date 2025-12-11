# Import PyTorch for neural network operations
import torch


# TransformerNet: Neural network architecture for fast neural style transfer

class TransformerNet(torch.nn.Module):
    # Initialize the network architecture
    def __init__(self):
        # Call parent class constructor
        super(TransformerNet, self).__init__()
        # Initial convolution layers: extract features and reduce spatial dimensions
        # First conv: 3 input channels (RGB) -> 32 output channels, 9x9 kernel, stride 1
        self.conv1 = ConvLayer(3, 32, kernel_size=9, stride=1)
        # Instance normalization for first conv output (normalizes across spatial dimensions)
        self.in1 = torch.nn.InstanceNorm2d(32, affine=True)
        # Second conv: 32 -> 64 channels, 3x3 kernel, stride 2 (downsample by 2x)
        self.conv2 = ConvLayer(32, 64, kernel_size=3, stride=2)
        # Instance normalization for second conv output
        self.in2 = torch.nn.InstanceNorm2d(64, affine=True)
        # Third conv: 64 -> 128 channels, 3x3 kernel, stride 2 (downsample by 2x)
        self.conv3 = ConvLayer(64, 128, kernel_size=3, stride=2)
        # Instance normalization for third conv output
        self.in3 = torch.nn.InstanceNorm2d(128, affine=True)
        # Residual layers: 5 residual blocks for feature transformation
        # These preserve information while allowing style transformation
        self.res1 = ResidualBlock(128)
        self.res2 = ResidualBlock(128)
        self.res3 = ResidualBlock(128)
        self.res4 = ResidualBlock(128)
        self.res5 = ResidualBlock(128)
        # Upsampling Layers: restore spatial dimensions while reducing channels
        # First deconv: 128 -> 64 channels, upsample by 2x
        self.deconv1 = UpsampleConvLayer(128, 64, kernel_size=3, stride=1, upsample=2)
        # Instance normalization for first deconv output
        self.in4 = torch.nn.InstanceNorm2d(64, affine=True)
        # Second deconv: 64 -> 32 channels, upsample by 2x
        self.deconv2 = UpsampleConvLayer(64, 32, kernel_size=3, stride=1, upsample=2)
        # Instance normalization for second deconv output
        self.in5 = torch.nn.InstanceNorm2d(32, affine=True)
        # Final conv: 32 -> 3 channels (RGB output), 9x9 kernel, stride 1
        self.deconv3 = ConvLayer(32, 3, kernel_size=9, stride=1)
        # ReLU activation function for non-linearity
        self.relu = torch.nn.ReLU()

    # Forward pass: process input image through the network
    # X: Input tensor of shape [batch, 3, height, width]
    # Returns: Stylized output tensor of shape [batch, 3, height, width]
    def forward(self, X):
        # First conv block: extract initial features
        y = self.relu(self.in1(self.conv1(X)))
        # Second conv block: downsample and extract more features
        y = self.relu(self.in2(self.conv2(y)))
        # Third conv block: further downsample and extract high-level features
        y = self.relu(self.in3(self.conv3(y)))
        # Apply 5 residual blocks: transform features while preserving content
        y = self.res1(y)
        y = self.res2(y)
        y = self.res3(y)
        y = self.res4(y)
        y = self.res5(y)
        # First deconv block: upsample and reduce channels
        y = self.relu(self.in4(self.deconv1(y)))
        # Second deconv block: further upsample and reduce channels
        y = self.relu(self.in5(self.deconv2(y)))
        # Final conv: generate RGB output (no activation, allows negative values)
        y = self.deconv3(y)
        return y


# Reflection padding helps preserve image boundaries better than zero padding
class ConvLayer(torch.nn.Module):
    # Initialize convolutional layer
    # in_channels: Number of input channels
    # out_channels: Number of output channels
    # kernel_size: Size of convolution kernel (e.g. 3, 9)
    # stride: Stride of convolution (1 for same size, 2 for downsampling)
    def __init__(self, in_channels, out_channels, kernel_size, stride):
        # Call parent class constructor
        super(ConvLayer, self).__init__()
        # Calculate reflection padding needed to maintain spatial dimensions
        # For kernel_size=9, padding=4; for kernel_size=3, padding=1
        reflection_padding = kernel_size // 2
        # Create reflection padding layer (mirrors edge pixels)
        self.reflection_pad = torch.nn.ReflectionPad2d(reflection_padding)
        # Create 2D convolution layer
        self.conv2d = torch.nn.Conv2d(in_channels, out_channels, kernel_size, stride)

    # Forward pass through the layer
    # x: Input tensor of shape [batch, in_channels, height, width]
    # Returns: Output tensor of shape [batch, out_channels, height', width']
    def forward(self, x):
        # Apply reflection padding to input
        out = self.reflection_pad(x)
        # Apply convolution
        out = self.conv2d(out)
        return out


# ResidualBlock: Residual connection block for deep networks
# Introduced in ResNet paper: https://arxiv.org/abs/1512.03385
# Helps with gradient flow and allows deeper networks to train effectively
class ResidualBlock(torch.nn.Module):
    """ResidualBlock
    introduced in: https://arxiv.org/abs/1512.03385
    recommended architecture: http://torch.ch/blog/2016/02/04/resnets.html
    """

    # Initialize residual block
    # channels: Number of input/output channels (must be same for residual connection)
    def __init__(self, channels):
        # Call parent class constructor
        super(ResidualBlock, self).__init__()
        # First convolution: channels -> channels, 3x3 kernel, stride 1 (no size change)
        self.conv1 = ConvLayer(channels, channels, kernel_size=3, stride=1)
        # Instance normalization after first conv
        self.in1 = torch.nn.InstanceNorm2d(channels, affine=True)
        # Second convolution: channels -> channels, 3x3 kernel, stride 1
        self.conv2 = ConvLayer(channels, channels, kernel_size=3, stride=1)
        # Instance normalization after second conv
        self.in2 = torch.nn.InstanceNorm2d(channels, affine=True)
        # ReLU activation function
        self.relu = torch.nn.ReLU()

    # Forward pass through residual block
    # x: Input tensor of shape [batch, channels, height, width]
    # Returns: Output tensor with same shape as input
    def forward(self, x):
        # Store input for residual connection
        residual = x
        # First conv + normalization + activation
        out = self.relu(self.in1(self.conv1(x)))
        # Second conv + normalization (no activation before adding residual)
        out = self.in2(self.conv2(out))
        # Add residual connection: allows gradient to flow directly through
        out = out + residual
        return out


# UpsampleConvLayer: Upsampling layer using interpolation + convolution
# This approach gives better results than ConvTranspose2d (avoids checkerboard artifacts)
# Reference: http://distill.pub/2016/deconv-checkerboard/
class UpsampleConvLayer(torch.nn.Module):
    """UpsampleConvLayer
    Upsamples the input and then does a convolution. This method gives better results
    compared to ConvTranspose2d.
    ref: http://distill.pub/2016/deconv-checkerboard/
    """

    # Initialize upsampling convolutional layer
    # in_channels: Number of input channels
    # out_channels: Number of output channels
    # kernel_size: Size of convolution kernel
    # stride: Stride of convolution (typically 1 for upsampling)
    # upsample: Upsampling factor (e.g., 2 for 2x upsampling)
    def __init__(self, in_channels, out_channels, kernel_size, stride, upsample=None):
        # Call parent class constructor
        super(UpsampleConvLayer, self).__init__()
        # Store upsampling factor
        self.upsample = upsample
        # Calculate reflection padding needed
        reflection_padding = kernel_size // 2
        # Create reflection padding layer
        self.reflection_pad = torch.nn.ReflectionPad2d(reflection_padding)
        # Create 2D convolution layer
        self.conv2d = torch.nn.Conv2d(in_channels, out_channels, kernel_size, stride)

    # Forward pass through upsampling layer
    # x: Input tensor of shape [batch, in_channels, height, width]
    # Returns: Upsampled output tensor of shape [batch, out_channels, height*upsample, width*upsample]
    def forward(self, x):
        # Store input
        x_in = x
        # If upsampling is requested, use nearest neighbor interpolation
        if self.upsample:
            # Upsample by scale_factor using nearest neighbor (fast, preserves values)
            x_in = torch.nn.functional.interpolate(x_in, mode='nearest', scale_factor=self.upsample)
        # Apply reflection padding
        out = self.reflection_pad(x_in)
        # Apply convolution
        out = self.conv2d(out)
        return out