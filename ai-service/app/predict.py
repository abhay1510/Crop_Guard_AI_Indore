"""Inference. Real trained model only: there is no demo or fake mode.

Needs, in MODEL_DIR (default ./models), all produced by training/train.py:
  crop_model.pth      weights
  class_labels.json   class names, in training order
  model_meta.json     arch, image size, calibrated temperature, calibrated thresholds, test metrics

If any file is missing the service stays up but /predict returns 503. Nothing is invented.
"""
import json
import logging
import os
from typing import Optional

import numpy as np
from PIL import Image

log = logging.getLogger("cropguard.ai")

MODEL_DIR = os.getenv("MODEL_DIR", "models")
MODEL_PATH = os.getenv("MODEL_PATH", os.path.join(MODEL_DIR, "crop_model.pth"))
LABELS_PATH = os.getenv("LABELS_PATH", os.path.join(MODEL_DIR, "class_labels.json"))
META_PATH = os.getenv("META_PATH", os.path.join(MODEL_DIR, "model_meta.json"))

_model = None
_labels: list = []
_meta: dict = {}
_transform = None
_mode = "unloaded"  # "real" | "unavailable"
_reason = ""
_high = 0.85
_low = 0.60
_temperature = 1.0
_tta = os.getenv("TTA", "true").lower() == "true"


def load_model() -> None:
    """Load once at startup."""
    global _model, _labels, _meta, _transform, _mode, _reason, _high, _low, _temperature
    missing = [p for p in (MODEL_PATH, LABELS_PATH, META_PATH) if not os.path.exists(p)]
    if missing:
        _mode, _reason = "unavailable", f"missing files: {', '.join(missing)}"
        log.error("No model loaded: %s", _reason)
        return
    try:
        import torch
        from torchvision import transforms

        from .arch import build_model

        with open(LABELS_PATH) as f:
            _labels = json.load(f)
        with open(META_PATH) as f:
            _meta = json.load(f)
        net = build_model(_meta["arch"], len(_labels), pretrained=False)
        net.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
        net.eval()
        size = int(_meta.get("img_size", 224))
        _transform = transforms.Compose([
            transforms.Resize((size, size)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])
        _temperature = float(_meta.get("temperature", 1.0))
        th = _meta.get("thresholds", {})
        _high = float(os.getenv("HIGH_CONF", th.get("high", 0.85)))
        _low = float(os.getenv("LOW_CONF", th.get("low", 0.60)))
        _model = net
        _mode, _reason = "real", ""
        log.info("Model loaded: %s, %d classes, T=%.3f", _meta["arch"], len(_labels), _temperature)
    except Exception as e:  # corrupt/mismatched checkpoint must not look like a working model
        _model, _mode, _reason = None, "unavailable", f"failed to load model: {e}"
        log.exception("Model load failed")


def status() -> dict:
    return {
        "mode": _mode,
        "model_loaded": _mode == "real",
        "demo": False,
        "reason": _reason,
        "model_version": _meta.get("version", "unknown"),
        "arch": _meta.get("arch"),
        "classes": _labels,
        "thresholds": {"high": _high, "low": _low},
        "temperature": _temperature,
        "metrics": _meta.get("metrics"),
        "trained_on": _meta.get("trained_on"),
    }


def _certainty(conf: float) -> str:
    if conf >= _high:
        return "high"
    if conf >= _low:
        return "medium"
    return "low"


def predict(img: Image.Image) -> Optional[dict]:
    if _mode != "real":
        return None
    import torch

    x = _transform(img).unsqueeze(0)
    with torch.no_grad():
        logits = _model(x)
        if _tta:  # average original + horizontal flip: cheap, steadier scores
            logits = (logits + _model(torch.flip(x, dims=[3]))) / 2
        probs = torch.softmax(logits / _temperature, dim=1)[0].numpy()
    order = np.argsort(probs)[::-1]
    top = [{"class": _labels[i], "score": round(float(probs[i]), 4)} for i in order[:3]]
    conf = top[0]["score"]
    return {
        "status": "success",
        "prediction": top[0]["class"],
        "confidence": conf,
        "top_predictions": top,
        "model_version": _meta.get("version", "unknown"),
        "certainty": _certainty(conf),
        "demo": False,
    }


def predict_batch(images: list[Image.Image]) -> Optional[list[dict]]:
    """Run the loaded classifier on multiple regions in one inference batch."""
    if _mode != "real":
        return None
    if not images:
        return []
    import torch

    x = torch.stack([_transform(img) for img in images])
    with torch.no_grad():
        logits = _model(x)
        if _tta:
            logits = (logits + _model(torch.flip(x, dims=[3]))) / 2
        probs = torch.softmax(logits / _temperature, dim=1).cpu().numpy()

    predictions = []
    for row in probs:
        order = np.argsort(row)[::-1]
        top = [{"class": _labels[i], "score": round(float(row[i]), 4)} for i in order[:3]]
        confidence = top[0]["score"]
        predictions.append({
            "status": "success",
            "prediction": top[0]["class"],
            "confidence": confidence,
            "top_predictions": top,
            "model_version": _meta.get("version", "unknown"),
            "certainty": _certainty(confidence),
            "demo": False,
        })
    return predictions