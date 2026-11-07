"""
Mo phong anh "da theu" tu anh thiet ke (PNG nen trong suot) — de lam anh demo cho khach truoc khi theu that.
Khong ve lai thiet ke: chi doi be mat sang chi theu.

  1. Gom mau thanh N "mau chi" (k-means trong Lab), lam sach cac dom nho.
  2. Moi vung mau lien thong = mot vung theu: chon huong mui chi (vung manh -> satin cat ngang vung,
     vung lon -> tatami theo goc rieng), phu van soi chi (sang o giua soi, toi o khe), diem cam kim so le,
     do bong theo huong chi so voi huong sang (vung khac huong phan chieu khac nhau nhu chi that).
  3. Do noi: ban do do cao tu khoang cach toi mep vung -> do bong; ranh toi giua cac vung.
  4. Bong do duoi mieng theu, dat len nen vai lanh (JPG) va ban nen trong suot (PNG).

  python -I scripts/landing/embroider.py <in.png> <out-basename> [--size 1000]
"""

import argparse
import math

import cv2
import numpy as np
from PIL import Image
from sklearn.cluster import KMeans

LIGHT = np.array([-0.55, -0.75])  # sang tu tren-trai
LIGHT /= np.linalg.norm(LIGHT)


def load(path: str, size: int):
    im = Image.open(path).convert("RGBA")
    bb = im.getchannel("A").getbbox()
    if bb:
        im = im.crop(bb)
    im.thumbnail((size, size), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255.0
    return a[..., :3], a[..., 3]


def quantize(rgb, mask, k):
    lab = cv2.cvtColor((rgb * 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    pts = lab[mask]
    sample = pts[np.random.default_rng(0).choice(len(pts), min(len(pts), 40000), replace=False)]
    km = KMeans(n_clusters=k, n_init=4, random_state=0).fit(sample)
    labels = np.full(mask.shape, 255, np.uint8)
    labels[mask] = km.predict(pts).astype(np.uint8)
    # lam sach dom nho (chi theu khong theu duoc chi tiet vai pixel)
    labels = cv2.medianBlur(labels, 5)
    labels[~mask] = 255
    centers = cv2.cvtColor(km.cluster_centers_.reshape(-1, 1, 3).clip(0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).reshape(-1, 3) / 255.0
    return labels, centers


def stitch_texture(h, w, angle, thread=4.2, length=20.0, seed=0):
    """Do sang cua mat chi theu theo goc `angle` (radian, huong mui chi)."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    c, s = math.cos(angle), math.sin(angle)
    rng = np.random.default_rng(seed)
    along = xx * c + yy * s  # doc theo soi chi
    across = -xx * s + yy * c  # cat ngang cac hang chi
    # chi that hoi luon, khong thang tap: lech nhe hang chi theo vi tri
    wobble = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 6) * 9.0
    across = across + wobble
    row = np.floor(across / thread)
    frac = across / thread - row
    profile = np.clip(np.sin(np.pi * frac), 0, 1) ** 0.55  # soi chi tron: sang giua, toi khe
    # mui chi so le kieu tatami: diem cam kim lech nhau giua cac hang
    t = ((along + row * length * 0.37) / length) % 1.0
    ends = np.clip(np.minimum(t, 1 - t) / 0.07, 0, 1) ** 0.6
    jitter = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 1.2)
    # moi hang chi cang hoi khac nhau -> do sang lech nhe theo hang
    rowvar = (np.sin(row * 12.9898 + seed * 78.233) * 43758.5453) % 1.0
    tex = 0.62 + 0.38 * profile * (0.78 + 0.22 * ends) + 0.035 * jitter + (rowvar - 0.5) * 0.07
    # anh bong cua chi: phan chieu manh khi huong chi vuong goc voi huong sang
    sheen = 1.0 + 0.10 * abs(c * LIGHT[1] - s * LIGHT[0])
    return tex * sheen


def region_angle(comp_mask, idx):
    ys, xs = np.nonzero(comp_mask)
    if len(xs) < 10:
        return 0.0, False
    pts = np.stack([xs, ys], 1).astype(np.float32)
    pts -= pts.mean(0)
    cov = pts.T @ pts / len(pts)
    evals, evecs = np.linalg.eigh(cov)
    major = math.atan2(evecs[1, 1], evecs[0, 1])
    thin = evals[0] < 0.12 * evals[1] or len(xs) < 1800
    if thin:  # satin: mui chi cat ngang chieu dai vung
        return major + math.pi / 2, True
    return [math.radians(a) for a in (35, 125, 60, 150, 15, 105)][idx % 6], False


def embroider(rgb, alpha, k):
    h, w = alpha.shape
    mask = alpha > 0.5
    labels, centers = quantize(rgb, mask, k)
    out = np.zeros((h, w, 3), np.float32)
    height = np.zeros((h, w), np.float32)
    idx = 0
    for lab in range(len(centers)):
        n, comps, stats, _ = cv2.connectedComponentsWithStats((labels == lab).astype(np.uint8), 8)
        for ci in range(1, n):
            x, y, cw, ch, area = stats[ci]
            if area < 12:
                continue
            pad = 3
            x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(w, x + cw + pad), min(h, y + ch + pad)
            m = comps[y0:y1, x0:x1] == ci
            ang, satin = region_angle(m, idx)
            tex = stitch_texture(y1 - y0, x1 - x0, ang, thread=3.6 if satin else 4.2, length=1e6 if satin else 20.0, seed=idx)
            col = centers[lab]
            out[y0:y1, x0:x1][m] = (col[None, :] * tex[m][:, None])
            # do noi: cao dan tu mep vao, satin phong hon
            dist = cv2.distanceTransform(m.astype(np.uint8), cv2.DIST_L2, 3)
            cap = 5.0 if satin else 7.0
            height[y0:y1, x0:x1][m] = np.minimum(dist[m], cap) / cap * (1.15 if satin else 1.0)
            idx += 1
    height = cv2.GaussianBlur(height, (0, 0), 1.3)
    gy, gx = np.gradient(height)
    shade = 1.0 + 1.6 * (gx * -LIGHT[0] + gy * -LIGHT[1])
    groove = np.clip(height * 3.0, 0.55, 1.0)  # ranh toi giua cac vung chi
    out = out * shade[..., None] * groove[..., None]
    out = np.clip(out, 0, 1)
    # mep mieng theu gon (chi khong co vien rang cua)
    a = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 0.7)
    return out, a


def linen(h, w, seed=1):
    rng = np.random.default_rng(seed)
    base = np.array([0.93, 0.89, 0.82], np.float32)
    n1 = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 0.8)
    rows = cv2.GaussianBlur(rng.normal(0, 1, (h, 1)).astype(np.float32), (0, 0), 0.6)
    cols = cv2.GaussianBlur(rng.normal(0, 1, (1, w)).astype(np.float32), (0, 0), 0.6)
    # soi vai min: hang / cot rat manh, them dom "slub" cua vai lanh
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    weft = np.sin(yy * 2.1) * 0.012 + np.sin(xx * 2.3) * 0.012
    weave = 0.03 * n1 + 0.012 * rows + 0.012 * cols + weft
    slub = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 14) * 0.03
    return np.clip(base[None, None, :] * (1 + weave + slub)[..., None], 0, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--size", type=int, default=1000)
    ap.add_argument("--colors", type=int, default=14)
    args = ap.parse_args()

    rgb, alpha = load(args.src, args.size)
    emb, a = embroider(rgb, alpha, args.colors)
    h, w = a.shape
    pad = int(max(h, w) * 0.08)
    H, W = h + 2 * pad, w + 2 * pad
    canvas_a = np.zeros((H, W), np.float32)
    canvas_a[pad : pad + h, pad : pad + w] = a
    canvas_rgb = np.zeros((H, W, 3), np.float32)
    canvas_rgb[pad : pad + h, pad : pad + w] = emb
    shadow = cv2.GaussianBlur(np.roll(np.roll(canvas_a, 10, 0), 6, 1), (0, 0), 9) * 0.45

    # ban nen vai lanh (JPG)
    bg = linen(H, W) * (1 - shadow[..., None])
    jpg = bg * (1 - canvas_a[..., None]) + canvas_rgb * canvas_a[..., None]
    Image.fromarray((jpg * 255).astype(np.uint8)).save(args.out + ".jpg", quality=90)

    # ban nen trong suot (PNG): mieng theu + bong
    out_a = np.clip(canvas_a + shadow * (1 - canvas_a), 0, 1)
    premul = canvas_rgb * canvas_a[..., None]
    rgb_out = np.where(out_a[..., None] > 0, premul / np.maximum(out_a[..., None], 1e-6), 0)
    rgba = np.dstack([rgb_out, out_a])
    Image.fromarray((rgba * 255).astype(np.uint8), "RGBA").save(args.out + ".png", optimize=True)


if __name__ == "__main__":
    main()
