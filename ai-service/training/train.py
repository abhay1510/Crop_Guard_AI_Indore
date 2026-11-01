"""Train the crop-disease classifier. Works on CPU, much faster on a GPU (use Colab if needed).

Data: data/{train,val,test}/<class>/*.jpg  (build it with training/prepare_data.py)

    cd ai-service
    python training/train.py --data data --arch mobilenet_v3_large --epochs 15 --out models

What it does beyond a basic fine-tune:
  * 2 phases: classifier head first, then whole network at a lower LR
  * stronger augmentation (crop/rotate/colour) for phone-camera conditions
  * class-weighted loss + label smoothing for imbalanced classes
  * early stopping on validation macro-F1
  * temperature scaling on the val set so confidence is calibrated
  * confidence thresholds (high/low) derived from val accuracy, not guessed
  * honest test-set report saved to models/metrics.json

Outputs in --out: crop_model.pth, class_labels.json, model_meta.json, metrics.json
"""
import argparse
import json
import os
import sys
import time

import numpy as np
import torch
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from torch import nn
from torchvision import datasets, transforms

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from app.arch import ARCHS, build_model, classifier_params  # noqa: E402


def collect_logits(net, loader, dev):
    net.eval()
    logits, ys = [], []
    with torch.no_grad():
        for x, y in loader:
            logits.append(net(x.to(dev)).float().cpu())
            ys.append(y)
    return torch.cat(logits), torch.cat(ys)


def fit_temperature(logits, ys):
    """Single scalar T minimising NLL on held-out data (Guo et al. 2017)."""
    log_t = torch.zeros(1, requires_grad=True)
    opt = torch.optim.LBFGS([log_t], lr=0.1, max_iter=100)
    nll = nn.CrossEntropyLoss()

    def closure():
        opt.zero_grad()
        loss = nll(logits / log_t.exp(), ys)
        loss.backward()
        return loss

    opt.step(closure)
    return float(log_t.exp().item())


def pick_thresholds(probs, ys, hi_target=0.95, lo_target=0.80, min_support=30, floor_high=0.85, floor_low=0.60):
    """Smallest confidence whose accuracy (on predictions at/above it) reaches target.

    On clean lab data (PlantVillage) overall accuracy is already above the targets, so the raw rule
    collapses to ~0 and every prediction would be "high". Floors stop that: field photos are harder.
    """
    conf, pred = probs.max(1)
    correct = (pred == ys).float()
    order = torch.argsort(conf, descending=True)
    conf, correct = conf[order], correct[order]
    cum_acc = torch.cumsum(correct, 0) / torch.arange(1, len(conf) + 1)

    def find(target, default):
        ok = [i for i in range(min(min_support, len(conf)) - 1, len(conf)) if cum_acc[i] >= target]
        return round(float(conf[max(ok)]), 4) if ok else default

    high = max(find(hi_target, 0.95), floor_high)
    low = min(max(find(lo_target, 0.60), floor_low), high)
    return {"high": round(high, 4), "low": round(low, 4)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--arch", default="mobilenet_v3_large", choices=ARCHS)
    ap.add_argument("--epochs", type=int, default=15)
    ap.add_argument("--head-epochs", type=int, default=2)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--img-size", type=int, default=224)
    ap.add_argument("--patience", type=int, default=4)
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--version", default=time.strftime("%Y.%m.%d"))
    ap.add_argument("--out", default="models")
    ap.add_argument("--min-high", type=float, default=0.85, help="floor for the HIGH confidence threshold")
    ap.add_argument("--min-low", type=float, default=0.60, help="floor for the LOW confidence threshold")
    a = ap.parse_args()

    torch.manual_seed(0)
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    norm = transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    s = a.img_size
    train_tf = transforms.Compose([
        transforms.RandomResizedCrop((s, s), scale=(0.6, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),
        transforms.RandomRotation(25),
        transforms.ColorJitter(0.3, 0.3, 0.3, 0.05),
        transforms.RandomApply([transforms.GaussianBlur(5, (0.1, 1.5))], p=0.2),
        transforms.ToTensor(), norm,
    ])
    eval_tf = transforms.Compose([transforms.Resize((s, s)), transforms.ToTensor(), norm])

    train = datasets.ImageFolder(os.path.join(a.data, "train"), train_tf)
    val = datasets.ImageFolder(os.path.join(a.data, "val"), eval_tf)
    test = datasets.ImageFolder(os.path.join(a.data, "test"), eval_tf)
    assert train.classes == val.classes == test.classes, "train/val/test must have identical class folders"
    n_cls = len(train.classes)
    print(f"{n_cls} classes | train {len(train)} val {len(val)} test {len(test)} | device {dev}")

    mk = lambda ds, sh: torch.utils.data.DataLoader(ds, batch_size=a.batch, shuffle=sh, num_workers=a.workers, pin_memory=dev == "cuda")
    tr_l, va_l, te_l = mk(train, True), mk(val, False), mk(test, False)

    counts = np.bincount(train.targets, minlength=n_cls).astype(float)
    weights = torch.tensor((counts.sum() / (n_cls * counts)) ** 0.5, dtype=torch.float32).to(dev)
    loss_fn = nn.CrossEntropyLoss(weight=weights, label_smoothing=0.1)

    net = build_model(a.arch, n_cls, pretrained=True).to(dev)
    scaler = torch.amp.GradScaler(dev, enabled=dev == "cuda")
    os.makedirs(a.out, exist_ok=True)
    ckpt = os.path.join(a.out, "crop_model.pth")

    best_f1, bad = -1.0, 0
    opt = sched = None
    for ep in range(a.epochs):
        if ep == 0:  # phase 1: head only
            for p in net.parameters():
                p.requires_grad = False
            for p in classifier_params(net):
                p.requires_grad = True
            opt = torch.optim.AdamW(classifier_params(net), lr=a.lr, weight_decay=1e-4)
        if ep == a.head_epochs:  # phase 2: everything, lower LR, cosine decay
            for p in net.parameters():
                p.requires_grad = True
            opt = torch.optim.AdamW(net.parameters(), lr=a.lr / 10, weight_decay=1e-4)
            sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, a.epochs - a.head_epochs))
        net.train()
        run = 0.0
        for x, y in tr_l:
            x, y = x.to(dev), y.to(dev)
            opt.zero_grad()
            with torch.autocast(device_type=dev, enabled=dev == "cuda"):
                loss = loss_fn(net(x), y)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
            run += loss.item() * len(y)
        if sched:
            sched.step()
        lg, ys = collect_logits(net, va_l, dev)
        pred = lg.argmax(1)
        acc = (pred == ys).float().mean().item()
        f1 = f1_score(ys.numpy(), pred.numpy(), average="macro")
        print(f"epoch {ep + 1}/{a.epochs} train_loss={run / len(train):.4f} val_acc={acc:.4f} val_macroF1={f1:.4f}")
        if f1 > best_f1:
            best_f1, bad = f1, 0
            torch.save(net.state_dict(), ckpt)
        else:
            bad += 1
            if ep >= a.head_epochs and bad >= a.patience:
                print("early stop")
                break

    net.load_state_dict(torch.load(ckpt, map_location=dev))

    # Calibrate on val, then judge on untouched test.
    v_logits, v_ys = collect_logits(net, va_l, dev)
    T = fit_temperature(v_logits, v_ys)
    thresholds = pick_thresholds(torch.softmax(v_logits / T, 1), v_ys, floor_high=a.min_high, floor_low=a.min_low)
    print(f"temperature={T:.3f} thresholds={thresholds}")

    t_logits, t_ys = collect_logits(net, te_l, dev)
    t_probs = torch.softmax(t_logits / T, 1)
    t_pred = t_probs.argmax(1)
    t_conf = t_probs.max(1).values
    report = classification_report(t_ys.numpy(), t_pred.numpy(), target_names=train.classes, output_dict=True, zero_division=0)
    print(classification_report(t_ys.numpy(), t_pred.numpy(), target_names=train.classes, zero_division=0))
    cm = confusion_matrix(t_ys.numpy(), t_pred.numpy()).tolist()
    acc = float((t_pred == t_ys).float().mean())
    hi = t_conf >= thresholds["high"]
    hi_acc = float((t_pred[hi] == t_ys[hi]).float().mean()) if hi.any() else None
    ece_bins = torch.linspace(0, 1, 11)
    ece = 0.0
    for lo, up in zip(ece_bins[:-1], ece_bins[1:]):
        m = (t_conf > lo) & (t_conf <= up)
        if m.any():
            ece += m.float().mean().item() * abs((t_pred[m] == t_ys[m]).float().mean().item() - t_conf[m].mean().item())
    print(f"TEST acc={acc:.4f} macroF1={report['macro avg']['f1-score']:.4f} ECE={ece:.4f} high-conf share={hi.float().mean():.2%} high-conf acc={hi_acc}")

    metrics = {
        "test_accuracy": round(acc, 4), "test_macro_f1": round(report["macro avg"]["f1-score"], 4),
        "ece": round(ece, 4), "high_conf_share": round(float(hi.float().mean()), 4),
        "high_conf_accuracy": None if hi_acc is None else round(hi_acc, 4),
        "n_test": len(test), "per_class": {k: report[k] for k in train.classes}, "confusion_matrix": cm,
    }
    with open(os.path.join(a.out, "class_labels.json"), "w") as f:
        json.dump(train.classes, f)
    with open(os.path.join(a.out, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    with open(os.path.join(a.out, "model_meta.json"), "w") as f:
        json.dump({
            "arch": a.arch, "img_size": a.img_size, "version": a.version, "temperature": round(T, 4),
            "thresholds": thresholds,
            "metrics": {k: metrics[k] for k in ("test_accuracy", "test_macro_f1", "ece", "n_test")},
            "trained_on": {"classes": n_cls, "train_images": len(train), "data_dir": os.path.basename(os.path.normpath(a.data))},
        }, f, indent=2)
    print(f"saved to {a.out}/ . Restart the AI service to load it.")


if __name__ == "__main__":
    main()