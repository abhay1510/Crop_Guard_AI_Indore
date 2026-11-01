"""Test the trained model through the SAME code the API uses (app/predict.py).

    cd ai-service
    python training/check_model.py --data data/test            # accuracy on test split (max 100 imgs/class)
    python training/check_model.py --image path/to/leaf.jpg    # one image

Catches: missing/mismatched model files, preprocessing mismatch, thresholds that make everything "high".
"""
import argparse
import os
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from app import predict as P  # noqa: E402
from app.preprocessing import decode_image  # noqa: E402


def run(path):
    with open(path, "rb") as f:
        return P.predict(decode_image(f.read()))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", help="folder with <class>/*.jpg, e.g. data/test")
    ap.add_argument("--image", help="single image")
    ap.add_argument("--per-class", type=int, default=100)
    a = ap.parse_args()

    P.load_model()
    st = P.status()
    print(f"mode={st['mode']} arch={st['arch']} classes={len(st['classes'])} thresholds={st['thresholds']} T={st['temperature']}")
    if st["mode"] != "real":
        raise SystemExit(f"MODEL NOT LOADED: {st['reason']}")

    if a.image:
        print(run(a.image))
        return
    if not a.data:
        raise SystemExit("give --data or --image")

    ok = total = 0
    by_cert = defaultdict(lambda: [0, 0])  # certainty -> [correct, n]
    wrong = Counter()
    for cls in sorted(os.listdir(a.data)):
        d = os.path.join(a.data, cls)
        files = [f for f in sorted(os.listdir(d)) if f.lower().endswith((".jpg", ".jpeg", ".png"))][: a.per_class]
        for f in files:
            r = run(os.path.join(d, f))
            hit = r["prediction"] == cls
            ok += hit
            total += 1
            by_cert[r["certainty"]][0] += hit
            by_cert[r["certainty"]][1] += 1
            if not hit:
                wrong[(cls, r["prediction"])] += 1
    print(f"\naccuracy {ok}/{total} = {ok / max(total, 1):.4f}")
    for c in ("high", "medium", "low"):
        k, n = by_cert[c]
        print(f"  certainty={c:6s} n={n:5d} acc={(k / n if n else float('nan')):.4f}")
    if by_cert["high"][1] == total and total:
        print("WARNING: every prediction is 'high'. Raise --min-high and retrain, or set HIGH_CONF in .env.")
    print("top confusions:")
    for (t, p), n in wrong.most_common(5):
        print(f"  {t} -> {p}: {n}")


if __name__ == "__main__":
    main()