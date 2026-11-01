"""Turn a folder of labelled images into leakage-aware train/val/test splits.

Input  (--src): ImageFolder layout, one sub-folder per class:
    src/<class_name>/*.jpg
  Class naming that works best with the backend: "<Crop>___<Condition>", e.g.
  Tomato___Early_blight, Tomato___healthy  (PlantVillage style). Any class whose name
  contains "healthy" is treated as healthy by the app.

Output (--out): out/{train,val,test}/<class_name>/...

Leakage control (this is what makes test accuracy honest):
  * exact duplicates removed by content hash;
  * with --group-regex, images sharing the regex's first group stay in ONE split
    (use this when filenames carry a leaf/plant/session id, so crops of the same leaf
    never land in both train and test). Without it, split is per-image and test accuracy
    on PlantVillage-style data will be optimistic.

Usage:
    python training/prepare_data.py --src raw --out data
    python training/prepare_data.py --src raw --out data --group-regex "^(.*)_\\d+\\.jpe?g$"
"""
import argparse
import hashlib
import os
import random
import re
import shutil
from collections import defaultdict

EXT = {".jpg", ".jpeg", ".png"}


def norm_class(name):
    """Make folder names look like Crop___Condition so the backend can check crop vs field crop.
    Tomato_healthy -> Tomato___healthy, Tomato__Target_Spot -> Tomato___Target_Spot.
    Names that already contain '___' are kept."""
    if "___" in name:
        return name
    m = re.match(r"^([A-Za-z]+)_{1,2}(.+)$", name)
    return f"{m.group(1)}___{m.group(2).lstrip('_')}" if m else name


def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", default="data")
    ap.add_argument("--val", type=float, default=0.15)
    ap.add_argument("--test", type=float, default=0.15)
    ap.add_argument("--min-per-class", type=int, default=30, help="drop classes with fewer images")
    ap.add_argument("--group-regex", default=None, help="regex; group 1 = id of the leaf/plant/session")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--symlink", action="store_true", help="symlink instead of copy (saves disk)")
    a = ap.parse_args()
    rnd = random.Random(a.seed)
    rx = re.compile(a.group_regex, re.I) if a.group_regex else None

    if os.path.exists(a.out) and os.listdir(a.out):
        raise SystemExit(f"{a.out} is not empty. Remove it first so splits are never mixed.")

    seen, total_dupes = set(), 0
    for raw_cls in sorted(os.listdir(a.src)):
        cls = norm_class(raw_cls)
        cdir = os.path.join(a.src, raw_cls)
        if not os.path.isdir(cdir):
            continue
        files = [os.path.join(cdir, f) for f in sorted(os.listdir(cdir)) if os.path.splitext(f)[1].lower() in EXT]
        groups = defaultdict(list)
        for p in files:
            h = md5(p)
            if h in seen:
                total_dupes += 1
                continue
            seen.add(h)
            m = rx.match(os.path.basename(p)) if rx else None
            groups[m.group(1) if m else p].append(p)
        n = sum(len(v) for v in groups.values())
        if n < a.min_per_class:
            print(f"skip {cls}: only {n} images")
            continue
        keys = list(groups)
        if len(keys) < 5:
            print(f"skip {cls}: only {len(keys)} groups, cannot fill train/val/test")
            continue
        rnd.shuffle(keys)
        n_test, n_val = max(1, int(len(keys) * a.test)), max(1, int(len(keys) * a.val))
        split_of = {}
        for i, k in enumerate(keys):
            split_of[k] = "test" if i < n_test else "val" if i < n_test + n_val else "train"
        counts = defaultdict(int)
        for k, paths in groups.items():
            for p in paths:
                dst_dir = os.path.join(a.out, split_of[k], cls)
                os.makedirs(dst_dir, exist_ok=True)
                dst = os.path.join(dst_dir, os.path.basename(p))
                if a.symlink:
                    os.symlink(os.path.abspath(p), dst)
                else:
                    shutil.copy2(p, dst)
                counts[split_of[k]] += 1
        print(f"{cls}: train={counts['train']} val={counts['val']} test={counts['test']}")
    print(f"removed {total_dupes} exact duplicates")
    if not rx:
        print("WARNING: no --group-regex. Near-identical shots of one leaf may span splits; treat test accuracy as optimistic and validate on your own field photos.")


if __name__ == "__main__":
    main()