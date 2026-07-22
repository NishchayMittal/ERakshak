import os
import math
import numpy as np
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

# Minimum similarity score to report as a match (uncalibrated raw score)
MATCH_THRESHOLD = 65.0

def make_square(img):
    """Crop the image to a center square to maintain aspect ratio and prevent LBP distortion."""
    w, h = img.size
    if w == h:
        return img
    elif w > h:
        left = (w - h) // 2
        return img.crop((left, 0, left + h, h))
    else:
        top = (h - w) // 2
        return img.crop((0, top, w, top + w))

def is_skin_pixel(r, g, b):
    """Detect skin-like colors using HSV hue and saturation thresholds."""
    r_n, g_n, b_n = r / 255.0, g / 255.0, b / 255.0
    cmax = max(r_n, g_n, b_n); cmin = min(r_n, g_n, b_n)
    delta = cmax - cmin
    v = cmax
    s = delta / cmax if cmax > 0 else 0
    if delta < 0.001: return False
    if cmax == r_n:
        h = 60 * (((g_n - b_n) / delta) % 6)
    elif cmax == g_n:
        h = 60 * ((b_n - r_n) / delta + 2)
    else:
        h = 60 * ((r_n - g_n) / delta + 4)
    h = h % 360
    # Skin hue range (0-45 degrees or 335-360 degrees)
    return (h <= 45 or h >= 335) and (0.12 <= s <= 0.85) and (0.25 <= v <= 0.95)

def locate_face(img):
    """
    Locates the face bounding box in a PIL Image.
    Uses skin-tone detection + horizontal/vertical edges to isolate the face.
    Returns (left%, top%, right%, bottom%) crop coordinates.
    """
    try:
        from PIL import ImageFilter
        # Resize to 100x100 for fast processing
        img_sq = make_square(img)
        W, H = 100, 100
        small = img_sq.resize((W, H))
        rgb_small = small.convert("RGB")
        
        # Calculate skin mask
        skin_mask = [1.0 if is_skin_pixel(r, g, b) else 0.0 for r, g, b in rgb_small.getdata()]
        
        # Calculate edge density (facial features like eyes, nose, lips)
        edges = rgb_small.convert("L").filter(ImageFilter.FIND_EDGES)
        edge_data = list(edges.getdata())
        
        # Combine skin and edges to score face candidates
        face_scores = []
        for i in range(W * H):
            face_scores.append(skin_mask[i] * (1.0 + edge_data[i] / 255.0 * 4.0))
            
        best_score = -1.0
        best_box = (0.22, 0.12, 0.78, 0.58)  # Fallback face box
        
        # Search for face window sizes in the upper 65% of the image (to avoid torso/background)
        for win_size in [32, 40, 48]:
            win_w = win_size
            win_h = int(win_size * 1.15)
            max_y = int(H * 0.65) - win_h
            if max_y <= 0:
                max_y = 1
                
            for y in range(0, max_y, 4):
                for x in range(0, W - win_w, 4):
                    score = 0.0
                    for wy in range(y, y + win_h):
                        offset = wy * W + x
                        score += sum(face_scores[offset : offset + win_w])
                        
                    if score > best_score:
                        best_score = score
                        best_box = (
                            x / W,
                            y / H,
                            (x + win_w) / W,
                            (y + win_h) / H
                        )
        l, t, r, b = best_box
        dw = (r - l) * 0.05
        dh = (b - t) * 0.05
        return (
            max(0.0, l - dw),
            max(0.0, t - dh),
            min(1.0, r + dw),
            min(1.0, b + dh)
        )
    except Exception:
        return (0.22, 0.12, 0.78, 0.58)


def extract_hog_features(img, crop_box) -> list[float]:
    """
    Extract HOG features from a specific face-region crop of the image.
    Uses a 6x6 grid with 9 orientation bins for discriminative facial structure.
    Higher magnitude threshold (8.0) suppresses clothing textures and background noise.
    """
    try:
        w, h = img.size
        left = int(w * crop_box[0])
        top = int(h * crop_box[1])
        right = int(w * crop_box[2])
        bottom = int(h * crop_box[3])
        cropped = img.crop((left, top, right, bottom))
        
        im = cropped.resize((64, 64)).convert("L")
        pixels = list(im.getdata())
        
        width, height = im.size
        grid = [pixels[i * width : (i + 1) * width] for i in range(height)]
        
        gx = [[0.0] * width for _ in range(height)]
        gy = [[0.0] * width for _ in range(height)]
        
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                gx[y][x] = float(grid[y][x + 1] - grid[y][x - 1])
                gy[y][x] = float(grid[y + 1][x] - grid[y - 1][x])
        
        GRID = 6
        BINS = 9
        MAG_THRESHOLD = 8.0
        
        block_size = 64 // GRID
        block_features = []
        for by in range(GRID):
            for bx in range(GRID):
                hist = [0.0] * BINS
                for y in range(by * block_size, (by + 1) * block_size):
                    for x in range(bx * block_size, (bx+1) * block_size):
                        dx = gx[y][x]
                        dy = gy[y][x]
                        magnitude = math.sqrt(dx * dx + dy * dy)
                        if magnitude > MAG_THRESHOLD:
                            angle = math.atan2(abs(dy), abs(dx))
                            if dy < 0:
                                angle = math.pi - angle
                            bin_idx = int((angle / math.pi) * BINS) % BINS
                            hist[bin_idx] += 1.0
                
                norm = math.sqrt(sum(v * v for v in hist))
                if norm > 0:
                    hist = [v / norm for v in hist]
                block_features.extend(hist)
                
        return block_features
    except Exception:
        return []

def lbp_image(gray_arr, radius=1, n_points=8):
    """Compute LBP codes for a grayscale numpy array."""
    h, w = gray_arr.shape
    lbp = np.zeros((h, w), dtype=np.uint8)
    for y in range(radius, h - radius):
        for x in range(radius, w - radius):
            center = gray_arr[y, x]
            code = 0
            for p in range(n_points):
                angle = 2 * np.pi * p / n_points
                dy = int(round(radius * np.sin(angle)))
                dx = int(round(radius * np.cos(angle)))
                neighbor = gray_arr[y + dy, x + dx]
                code |= (1 << p) if neighbor >= center else 0
            lbp[y, x] = code
    return lbp

def lbp_histogram(gray_arr, grid=6, n_points=8):
    """Grid-based LBP histogram normalized using L1 norm for chi-square compatibility."""
    lbp = lbp_image(gray_arr, n_points=n_points)
    h, w = lbp.shape
    bh, bw = h // grid, w // grid
    n_bins = 2 ** n_points
    features = []
    for by in range(grid):
        for bx in range(grid):
            block = lbp[by*bh:(by+1)*bh, bx*bw:(bx+1)*bw]
            hist = [0.0] * n_bins
            for val in block.flat:
                hist[val] += 1.0
            norm = sum(hist)
            if norm > 0:
                hist = [v / norm for v in hist]
            features.extend(hist)
    return np.array(features)

def chi_square_distance(h1, h2, eps=1e-10):
    return 0.5 * np.sum(((h1 - h2) ** 2) / (h1 + h2 + eps))


class FaceMatcherConnector(BaseConnector):
    name = "face_matcher"
    applies_to = (IdentifierType.photo,)
    timeout_seconds = 15.0
    max_retries = 0

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        suspects_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "resources", "suspects")
        )

        # Load target image
        target_img = None
        temp_path = None

        try:
            from PIL import Image

            if identifier_value.startswith("http://") or identifier_value.startswith("https://"):
                import httpx, io
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
                async with httpx.AsyncClient(timeout=self.timeout_seconds, follow_redirects=True, headers=headers) as c:
                    resp = await c.get(identifier_value)
                    if resp.status_code == 200:
                        target_img = Image.open(io.BytesIO(resp.content))
            else:
                resolved_path = identifier_value
                if not os.path.exists(resolved_path):
                    uploads_dir = os.path.abspath(
                        os.path.join(os.path.dirname(__file__), "..", "resources", "uploads")
                    )
                    possible_path = os.path.join(uploads_dir, identifier_value.replace("\\", "/"))
                    if os.path.exists(possible_path):
                        resolved_path = possible_path
                    else:
                        possible_suspect_path = os.path.join(suspects_dir, os.path.basename(identifier_value))
                        if os.path.exists(possible_suspect_path):
                            resolved_path = possible_suspect_path
                
                if os.path.exists(resolved_path):
                    target_img = Image.open(resolved_path)

        except Exception:
            pass

        if target_img is None:
            return []

        # Load all suspect images from the directory
        if not os.path.exists(suspects_dir):
            return []

        suspect_images = {}
        for fname in os.listdir(suspects_dir):
            if fname.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                label = os.path.splitext(fname)[0].replace("_", " ").title()
                suspect_images[label] = os.path.join(suspects_dir, fname)

        if not suspect_images:
            return []

        def calculate_similarity(img1, img2_path: str) -> float:
            """
            Compare two images by dynamically detecting their face regions,
            cropping them, and extracting both HOG and LBP descriptors.
            """
            try:
                from PIL import Image as PILImage
                img2 = PILImage.open(img2_path)
                
                # Pre-square images
                img1_sq = make_square(img1)
                img2_sq = make_square(img2)
                
                # Dynamically locate the face bounding boxes
                box1 = locate_face(img1_sq)
                box2 = locate_face(img2_sq)
                
                # 1. HOG Similarity (structural geometry)
                v1_hog = extract_hog_features(img1_sq, box1)
                v2_hog = extract_hog_features(img2_sq, box2)
                if v1_hog and v2_hog:
                    dot = sum(a * b for a, b in zip(v1_hog, v2_hog))
                    norm1 = math.sqrt(sum(a * a for a in v1_hog))
                    norm2 = math.sqrt(sum(b * b for b in v2_hog))
                    hog_sim = max(min(100.0 * dot / (norm1 * norm2), 100.0), 0.0)
                else:
                    hog_sim = 0.0
                
                # 2. LBP Similarity (local texture)
                w1, h1 = img1_sq.size
                crop1 = img1_sq.crop((int(w1*box1[0]), int(h1*box1[1]), int(w1*box1[2]), int(h1*box1[3])))
                
                w2, h2 = img2_sq.size
                crop2 = img2_sq.crop((int(w2*box2[0]), int(h2*box2[1]), int(w2*box2[2]), int(h2*box2[3])))
                
                gray1 = np.array(crop1.resize((80, 80)).convert("L"))
                gray2 = np.array(crop2.resize((80, 80)).convert("L"))
                
                grid = 6
                f1 = lbp_histogram(gray1, grid=grid)
                f2 = lbp_histogram(gray2, grid=grid)
                
                dist = chi_square_distance(f1, f2)
                lbp_sim = max(0.0, (1.0 - dist / (grid * grid)) * 100.0)
                
                # Combine using maximum similarity (HOG invariant to lighting/pose, LBP invariant to translations)
                raw_similarity = max(hog_sim, lbp_sim)
                return raw_similarity
            except Exception:
                return 0.0


        findings = []
        for label, path in suspect_images.items():
            score = calculate_similarity(target_img, path)
            if score >= MATCH_THRESHOLD:
                findings.append(Finding(
                    connector_name=self.name,
                    result_type="face_similarity",
                    result_value=f"Match: {label} (Similarity: {score:.1f}%)",
                    confidence=round(score / 100.0, 3),
                    raw_payload={
                        "suspect_name": label,
                        "similarity_score": round(score, 2),
                        "suspect_image": path,
                        "method": "LBP_Grid6x6_ChiSquare",
                    }
                ))

        # Sort by score descending
        findings.sort(key=lambda f: f.confidence, reverse=True)

        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

        return findings
