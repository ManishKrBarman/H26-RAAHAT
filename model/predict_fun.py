"""
predict_fun.py — YOLOv8 Video Analysis for Raahat Traffic System

Analyzes video frames using a YOLOv8 model with ByteTrack for:
  - Vehicle counting (unique tracked IDs)
  - Speed estimation (pixel displacement heuristic)
  - Density classification (low / medium / high)
  - Emergency vehicle detection (majority-vote per tracked ID)

Model classes: Bicycle, Bus, Jeepney, Motorcycle, Multicab, Pickup,
               SUV, Sedan, Truck, Van, ambulance, firetruck, police
"""

import cv2
import numpy as np
from collections import Counter
from ultralytics import YOLO

# ══════════ MODEL SINGLETON ══════════
_model_cache = {}


def _get_model(model_path: str) -> YOLO:
    """Load and cache the YOLO model."""
    if model_path not in _model_cache:
        print(f"🔄 Loading YOLO model from: {model_path}")
        _model_cache[model_path] = YOLO(model_path)
        print(f"✅ Model loaded: {model_path}")
        print(f"   Classes: {_model_cache[model_path].names}")
    return _model_cache[model_path]


# ══════════ CLASS DEFINITIONS (matching custom model) ══════════
EMERGENCY_CLASSES = {"ambulance", "firetruck", "police"}

VEHICLE_CLASSES = {
    "bicycle", "bus", "jeepney", "motorcycle", "multicab",
    "pickup", "suv", "sedan", "truck", "van",
    "ambulance", "firetruck", "police",
}

# A tracked vehicle must be classified as emergency in at least this
# fraction of its appearances to be considered a real emergency vehicle.
# This prevents class flip-flopping from triggering false emergencies.
EMERGENCY_VOTE_THRESHOLD = 0.6  # 60% of frames must agree


def analyze_for_api(
    video_path: str,
    model_path: str = "best.pt",
    lane_id: str = "A",
    frame_skip: int = 3,
    conf: float = 0.4,
) -> dict:
    """
    Analyze a video file and return traffic metrics.

    Uses majority voting per tracked vehicle ID to determine each
    vehicle's class. This prevents the model's frame-to-frame class
    flip-flopping from producing inaccurate counts or false emergencies.
    """
    model = _get_model(model_path)

    # ═══ CRITICAL: Reset tracker for each new video ═══
    model.predictor = None

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"   📊 Video info: {total_frames} frames, {fps:.1f} FPS, "
          f"~{total_frames / fps:.1f}s duration")

    # ═══ Per-vehicle tracking data ═══
    # vehicle_classes[obj_id] = ["sedan", "sedan", "suv", "sedan", ...]
    # Each entry is the class assigned in one frame. Majority wins.
    vehicle_classes: dict[int, list[str]] = {}
    vehicle_positions: dict[int, list[tuple]] = {}  # for speed estimation

    frame_count = 0
    frames_processed = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % frame_skip != 0:
            frame_count += 1
            continue

        frames_processed += 1

        results = model.track(
            frame,
            conf=conf,
            persist=True,
            tracker="bytetrack.yaml",
            verbose=False,
        )

        boxes = results[0].boxes

        if boxes is not None and boxes.id is not None:
            ids = boxes.id.cpu().numpy()
            classes = boxes.cls.cpu().numpy()
            xyxy = boxes.xyxy.cpu().numpy()

            for i in range(len(ids)):
                obj_id = int(ids[i])
                cls_idx = int(classes[i])
                class_name = model.names.get(cls_idx, "unknown").lower()

                # Skip non-vehicle detections
                if class_name not in VEHICLE_CLASSES:
                    continue

                x1, y1, x2, y2 = xyxy[i]
                x_center = (x1 + x2) / 2
                y_center = (y1 + y2) / 2

                # Record this class vote for this vehicle ID
                if obj_id not in vehicle_classes:
                    vehicle_classes[obj_id] = []
                    vehicle_positions[obj_id] = []
                vehicle_classes[obj_id].append(class_name)
                vehicle_positions[obj_id].append((x_center, y_center, frame_count))

        frame_count += 1

    cap.release()

    # ══════════ MAJORITY VOTE PER VEHICLE ══════════
    # For each tracked vehicle, pick the class that appeared most often.
    # This eliminates class flip-flopping (e.g. SUV → police → SUV → SUV = "SUV")
    final_vehicles = {}  # obj_id -> final_class
    for obj_id, class_list in vehicle_classes.items():
        counter = Counter(class_list)
        final_class = counter.most_common(1)[0][0]
        final_vehicles[obj_id] = final_class

    vehicle_count = len(final_vehicles)

    # ═══ Class breakdown (by unique vehicles, NOT raw detections) ═══
    class_breakdown = Counter(final_vehicles.values())

    # ══════════ EMERGENCY DETECTION (majority vote) ══════════
    # A vehicle is only "emergency" if it was consistently classified as
    # an emergency class across most of its frame appearances.
    emergency_detected = False
    emergency_details = []

    for obj_id, class_list in vehicle_classes.items():
        emergency_votes = sum(1 for c in class_list if c in EMERGENCY_CLASSES)
        total_votes = len(class_list)
        emergency_ratio = emergency_votes / total_votes if total_votes > 0 else 0

        if emergency_ratio >= EMERGENCY_VOTE_THRESHOLD:
            emergency_detected = True
            majority_class = Counter(
                c for c in class_list if c in EMERGENCY_CLASSES
            ).most_common(1)[0][0]
            emergency_details.append(
                f"ID#{obj_id}: {majority_class} ({emergency_votes}/{total_votes} = {emergency_ratio:.0%})"
            )

    # ══════════ SPEED ESTIMATION ══════════
    speeds = []
    for obj_id, positions in vehicle_positions.items():
        if len(positions) < 2:
            continue
        for j in range(1, len(positions)):
            x1, y1, f1 = positions[j - 1]
            x2, y2, f2 = positions[j]
            frame_gap = f2 - f1
            if frame_gap <= 0:
                continue
            distance = np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
            # Convert pixel displacement to approximate km/h
            speed = distance * (fps / frame_gap) * 0.05
            if speed > 0.5:  # filter noise
                speeds.append(speed)

    avg_speed = round(float(np.mean(speeds)), 2) if speeds else 0.0

    # ══════════ DENSITY ══════════
    if vehicle_count > 35:
        density = "high"
    elif vehicle_count > 15:
        density = "medium"
    else:
        density = "low"

    # ══════════ DIAGNOSTIC LOGGING ══════════
    print(f"   📊 Processed {frames_processed}/{total_frames} frames")
    print(f"   🚗 Unique vehicles (majority-vote): {vehicle_count}")
    print(f"   📦 Class breakdown (per vehicle): {dict(class_breakdown)}")

    if emergency_details:
        print(f"   🚨 Emergency vehicles confirmed: {emergency_details}")
    elif any(c in EMERGENCY_CLASSES for c in final_vehicles.values()):
        # Some vehicles got emergency as majority class but below vote threshold
        emg_by_majority = {k: v for k, v in final_vehicles.items() if v in EMERGENCY_CLASSES}
        print(f"   ⚠️  Emergency class assigned by majority vote but "
              f"below {EMERGENCY_VOTE_THRESHOLD:.0%} consistency threshold: {emg_by_majority}")
    else:
        print(f"   ✅ No emergency vehicles detected")

    print(f"   📈 Result: count={vehicle_count}, speed={avg_speed}, "
          f"density={density}, emergency={emergency_detected}")

    return {
        "vehicle_count": vehicle_count,
        "avg_speed": avg_speed,
        "density": density,
        "emergency": emergency_detected,
    }
