# plot_loss.py
import torch
from torchvision import transforms, models
from PIL import Image
import matplotlib.pyplot as plt
from neural_style.transformer_net import TransformerNet

# ===== Device =====
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ===== Load Pretrained Fast Neural Style Model =====
model = TransformerNet()

# Fix for old checkpoints with InstanceNorm running stats
state_dict = torch.load("./neural_style/saved_models/mosaic.pth")
for key in list(state_dict.keys()):
    if "running_mean" in key or "running_var" in key:
        del state_dict[key]

model.load_state_dict(state_dict, strict=False)
model.to(device).eval()

# ===== Load Content Image =====
content_path = "./neural_style/images/content-images/c4plrrmw1p5__10_27_2025.png"
content_img = Image.open(content_path).convert("RGB")

transform = transforms.Compose([
    transforms.Resize(256),
    transforms.ToTensor(),
    transforms.Lambda(lambda x: x.mul(255))
])

img_tensor = transform(content_img).unsqueeze(0).to(device)

# ===== Load VGG19 for Perceptual Loss =====
vgg = models.vgg19(pretrained=True).features.to(device).eval()

def content_loss(gen_feat, content_feat):
    # Fix mismatch by resizing gen_feat to content_feat spatial size
    if gen_feat.shape != content_feat.shape:
        gen_feat = torch.nn.functional.interpolate(
            gen_feat,
            size=content_feat.shape[2:],  # (H, W)
            mode='bilinear',
            align_corners=False
        )
    return torch.nn.functional.mse_loss(gen_feat, content_feat)

def gram_matrix(y):
    (b, ch, h, w) = y.size()
    features = y.view(b, ch, w*h)
    gram = torch.bmm(features, features.transpose(1,2)) / (ch * h * w)
    return gram

def style_loss(gen_feat, style_feat):
    G = gram_matrix(gen_feat)
    A = gram_matrix(style_feat)
    return torch.nn.functional.mse_loss(G, A)

# ===== Feature Extraction Helper =====
def get_features(x, layers=None):
    if layers is None:
        layers = {'0': 'relu1_1', '5': 'relu2_1', '10': 'relu3_1', '19': 'relu4_1'}
    features = {}
    for name, layer in vgg._modules.items():
        x = layer(x)
        if name in layers:
            features[layers[name]] = x
    return features

# ===== Demo Loop to Show Loss =====
losses = []
iterations = 10

for i in range(iterations):
    # small random noise to simulate training
    img_var = img_tensor + (torch.randn_like(img_tensor) * 0.01)
    with torch.no_grad():
        output = model(img_var)
        
        # Get features for content loss
        content_feat = get_features(img_tensor)['relu2_1']
        output_feat = get_features(output)['relu2_1']
        c_loss = content_loss(output_feat, content_feat)
        
        # Simple style loss for demonstration (using output as "style")
        s_loss = style_loss(output, output)
        
        total_loss = c_loss + s_loss
        losses.append(total_loss.item())
        print(f"Iteration {i+1}/{iterations} - Total Loss: {total_loss.item():.4f}")

# ===== Plot Loss Curve =====
plt.plot(losses)
plt.title("Loss Curve")
plt.xlabel("Iteration")
plt.ylabel("Loss")
plt.grid(True)
plt.savefig("loss_curve.png")
plt.show()
