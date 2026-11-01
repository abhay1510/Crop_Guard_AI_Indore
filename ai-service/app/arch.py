"""Model architecture factory shared by training and inference."""
import torch
from torch import nn
from torchvision import models

ARCHS = ("mobilenet_v3_small", "mobilenet_v3_large", "efficientnet_b0")


def build_model(arch: str, num_classes: int, pretrained: bool = False) -> nn.Module:
    if arch == "mobilenet_v3_small":
        w = models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
        net = models.mobilenet_v3_small(weights=w)
        net.classifier[3] = nn.Linear(net.classifier[3].in_features, num_classes)
    elif arch == "mobilenet_v3_large":
        w = models.MobileNet_V3_Large_Weights.DEFAULT if pretrained else None
        net = models.mobilenet_v3_large(weights=w)
        net.classifier[3] = nn.Linear(net.classifier[3].in_features, num_classes)
    elif arch == "efficientnet_b0":
        w = models.EfficientNet_B0_Weights.DEFAULT if pretrained else None
        net = models.efficientnet_b0(weights=w)
        net.classifier[1] = nn.Linear(net.classifier[1].in_features, num_classes)
    else:
        raise ValueError(f"Unknown arch {arch}; choose from {ARCHS}")
    return net


def classifier_params(net: nn.Module):
    return net.classifier.parameters()