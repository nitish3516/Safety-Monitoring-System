from datetime import datetime
import json
import os
from pathlib import Path
import threading
import uuid

import cv2
import numpy as np
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from ultralytics import YOLO


app = Flask(__name__)
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
DEFAULT_MODEL_PATH = PROJECT_ROOT / "archive" / "results_yolov8n_100e" / "kaggle" / "working" / "runs" / "detect" / "train" / "weights" / "best.pt"
MODEL_PATH = Path(os.environ.get("MODEL_PATH", str(DEFAULT_MODEL_PATH))).expanduser()
LOGS_DIR = BASE_DIR / "logs"
LOG_FILE = LOGS_DIR / "violations.json"
SETTINGS_FILE = BASE_DIR / "settings.json"
STATUS_FILE = BASE_DIR / "status.json"

PPE_SETTING_TO_MODEL_LABEL = {
    "hardHat": "Hardhat",
    "safetyMask": "Mask",
    "safetyVest": "Safety Vest",
}

NEGATIVE_LABELS = {
    "Hardhat": "NO-Hardhat",
    "Mask": "NO-Mask",
    "Safety Vest": "NO-Safety Vest",
}

ALWAYS_VISIBLE_LABELS = {
    "Person",
}

DEFAULT_SETTINGS = {
    "systemName": "AI Workplace Safety Monitor",
    "timezone": "UTC+5:30",
    "language": "English",
    "hapticFeedback": True,
    "theme": "light",
    "emailNotif": True,
    "pushNotif": True,
    "smsAlerts": False,
    "criticalSound": True,
    "alertCooldown": "5",
    "autoAcknowledge": "30",
    "sensitivity": 75,
    "sensitivityLevel": "High - catch all violations",
    "recordViolations": True,
    "autoCapture": True,
    "autoScreenshot": True,
    "retentionDays": "90",
    "resolution": "1080p",
    "hardHat": True,
    "safetyMask": True,
    "safetyVest": True,
    "protectiveGloves": True,
    "safetyGoggles": True,
    "safetyBoots": True,
    "complianceThreshold": "90",
    "autoExcelBackup": False,
}

model = YOLO(str(MODEL_PATH)) if MODEL_PATH.exists() else None
os.makedirs(LOGS_DIR, exist_ok=True)
ACTIVE_VIOLATION_SIGNATURE = None
LOGGED_VIOLATION_SESSIONS = set()
VIOLATION_SESSION_LOCK = threading.Lock()
SESSION_TRACKS = {}
TRACKS_LOCK = threading.Lock()


def ensure_json_file(path: Path, default_value):
    if not path.exists():
        with open(path, "w", encoding="utf-8") as f:
            json.dump(default_value, f, indent=2)


def load_json(path: Path, fallback):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return fallback


def save_json(path: Path, payload):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def load_settings():
    stored = load_json(SETTINGS_FILE, DEFAULT_SETTINGS)
    return {**DEFAULT_SETTINGS, **stored}


def load_violations():
    data = load_json(LOG_FILE, [])
    changed = False
    normalized = []
    for index, item in enumerate(data):
        if "id" not in item:
            item["id"] = f"violation-{index + 1}-{uuid.uuid4().hex[:8]}"
            changed = True
        if "confidence" not in item:
            item["confidence"] = None
            changed = True
        normalized.append(item)
    if changed:
        save_json(LOG_FILE, normalized)
    return normalized


def current_required_ppe(settings: dict) -> list[str]:
    required = []
    for setting_key, model_label in PPE_SETTING_TO_MODEL_LABEL.items():
        if settings.get(setting_key):
            required.append(model_label)
    return required


def allowed_detection_labels(settings: dict) -> set[str]:
    allowed = set(ALWAYS_VISIBLE_LABELS)

    for setting_key, model_label in PPE_SETTING_TO_MODEL_LABEL.items():
        if settings.get(setting_key):
            allowed.add(model_label)
            negative_label = NEGATIVE_LABELS.get(model_label)
            if negative_label:
                allowed.add(negative_label)

    return allowed


def confidence_threshold_from_settings(settings: dict) -> float:
    sensitivity = int(settings.get("sensitivity", DEFAULT_SETTINGS["sensitivity"]))
    level = str(settings.get("sensitivityLevel", DEFAULT_SETTINGS["sensitivityLevel"])).lower()

    if "high" in level:
        base = 0.35
    elif "low" in level:
        base = 0.55
    else:
        base = 0.45

    adjustment = (50 - sensitivity) / 200
    return max(0.25, min(0.7, base + adjustment))


def compliance_score(detected_labels: set[str], required_ppe: list[str]) -> float:
    if not required_ppe:
        return 100.0
    present = sum(1 for item in required_ppe if item in detected_labels)
    return round((present / len(required_ppe)) * 100, 2)


def iou(box_a: dict, box_b: dict) -> float:
    ax1, ay1, ax2, ay2 = box_a["xyxy"]
    bx1, by1, bx2, by2 = box_b["xyxy"]

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(0.0, inter_x2 - inter_x1)
    inter_h = max(0.0, inter_y2 - inter_y1)
    intersection = inter_w * inter_h

    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - intersection
    return intersection / union if union > 0 else 0.0


def dedupe_detections(raw_detections: list[dict]) -> list[dict]:
    filtered: list[dict] = []
    sorted_detections = sorted(raw_detections, key=lambda item: item["confidence"], reverse=True)

    for detection in sorted_detections:
        if detection["label"] == "Person":
            threshold = 0.35
        elif detection["label"] == "Safety Vest":
            threshold = 0.3
        else:
            threshold = 0.5
        duplicate = any(
            existing["label"] == detection["label"] and iou(existing, detection) >= threshold
            for existing in filtered
        )
        if not duplicate:
            filtered.append(detection)

    return filtered


def intersection_over_area(inner_box: list[float], outer_box: list[float]) -> float:
    ix1 = max(inner_box[0], outer_box[0])
    iy1 = max(inner_box[1], outer_box[1])
    ix2 = min(inner_box[2], outer_box[2])
    iy2 = min(inner_box[3], outer_box[3])

    inter_w = max(0.0, ix2 - ix1)
    inter_h = max(0.0, iy2 - iy1)
    intersection = inter_w * inter_h
    area = max(0.0, inner_box[2] - inner_box[0]) * max(0.0, inner_box[3] - inner_box[1])
    return intersection / area if area > 0 else 0.0


def suppress_false_positive_ppe(detections: list[dict]) -> list[dict]:
    person_boxes = [item["xyxy"] for item in detections if item["label"] == "Person"]
    if not person_boxes:
        return [item for item in detections if item["label"] not in {"Safety Vest", "Hardhat", "Mask"}]

    filtered: list[dict] = []
    for detection in detections:
        label = detection["label"]
        if label == "Safety Vest":
            overlaps_person = any(iou({"xyxy": detection["xyxy"]}, {"xyxy": person_box}) >= 0.12 for person_box in person_boxes)
            mostly_inside_person = any(intersection_over_area(detection["xyxy"], person_box) >= 0.75 for person_box in person_boxes)
            strong_confidence = detection["confidence"] >= 88
            if not (overlaps_person and mostly_inside_person and strong_confidence):
                continue
        elif label == "Hardhat":
            overlaps_person = any(iou({"xyxy": detection["xyxy"]}, {"xyxy": person_box}) >= 0.03 for person_box in person_boxes)
            if not overlaps_person:
                continue
        elif label == "Mask":
            overlaps_person = any(iou({"xyxy": detection["xyxy"]}, {"xyxy": person_box}) >= 0.05 for person_box in person_boxes)
            if not overlaps_person:
                continue

        filtered.append(detection)

    negative_labels = {item["label"] for item in filtered}
    if "NO-Safety Vest" in negative_labels:
        filtered = [item for item in filtered if item["label"] != "Safety Vest"]

    return filtered


def smooth_box(previous_xyxy: list[float], current_xyxy: list[float], alpha: float) -> list[float]:
    return [
        round(previous_xyxy[index] * (1 - alpha) + current_xyxy[index] * alpha, 2)
        for index in range(4)
    ]


def stabilize_detections(session_key: str, detections: list[dict]) -> list[dict]:
    with TRACKS_LOCK:
        previous = SESSION_TRACKS.get(session_key, [])
        stabilized: list[dict] = []
        used_previous = set()

        for detection in detections:
            best_index = None
            best_iou = 0.0

            for index, previous_detection in enumerate(previous):
                if index in used_previous or previous_detection["label"] != detection["label"]:
                    continue

                overlap = iou(previous_detection, detection)
                if overlap > best_iou:
                    best_iou = overlap
                    best_index = index

            updated_detection = dict(detection)
            if best_index is not None and best_iou >= 0.55:
                used_previous.add(best_index)
                alpha = 0.18 if detection["label"] == "Person" else 0.28
                updated_detection["xyxy"] = smooth_box(
                    previous[best_index]["xyxy"],
                    detection["xyxy"],
                    alpha,
                )

            stabilized.append(updated_detection)

        SESSION_TRACKS[session_key] = [
            {"label": item["label"], "xyxy": item["xyxy"]}
            for item in stabilized
        ]
        return stabilized


def compute_missing_items(detected_labels: set[str], required_ppe: list[str]) -> list[str]:
    missing = []
    person_seen = "Person" in detected_labels

    for item in required_ppe:
        negative_label = NEGATIVE_LABELS.get(item)
        if negative_label and negative_label in detected_labels:
            missing.append(item)
            continue

        if person_seen and item not in detected_labels:
            missing.append(item)

    return missing


def violation_signature(missing: list[str], detections: list[dict]) -> tuple:
    person_boxes = [
        item for item in detections
        if item["label"] == "Person"
    ]
    person_regions = tuple(
        sorted(
            (
                round(item["x"], 1),
                round(item["y"], 1),
                round(item["w"], 1),
                round(item["h"], 1),
            )
            for item in person_boxes
        )
    )
    return (tuple(sorted(missing)), person_regions)


ensure_json_file(LOG_FILE, [])
ensure_json_file(SETTINGS_FILE, DEFAULT_SETTINGS)
ensure_json_file(STATUS_FILE, {
    "lastUpdated": None,
    "detected": [],
    "detections": [],
    "missing": [],
    "required": [],
    "violation": False,
    "activeWorkers": 0,
    "cameraOnline": False,
    "image": None,
    "settings_used": {
        "sensitivity": DEFAULT_SETTINGS["sensitivity"],
        "sensitivityLevel": DEFAULT_SETTINGS["sensitivityLevel"],
        "recordViolations": DEFAULT_SETTINGS["recordViolations"],
    },
})


@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "service": "Safety Monitoring Backend",
        "status": "ok",
        "modelLoaded": model is not None,
        "modelPath": str(MODEL_PATH),
        "endpoints": ["/status", "/settings", "/detect", "/violations"],
    })


@app.route("/settings", methods=["GET"])
def get_settings():
    return jsonify(load_settings())


@app.route("/settings", methods=["POST"])
def save_settings():
    payload = request.get_json(silent=True) or {}
    merged = {**DEFAULT_SETTINGS, **payload}
    save_json(SETTINGS_FILE, merged)
    return jsonify(merged)


@app.route("/status", methods=["GET"])
def get_status():
    return jsonify(load_json(STATUS_FILE, {}))


@app.route("/detect", methods=["POST"])
def detect():
    global ACTIVE_VIOLATION_SIGNATURE

    if model is None:
        return jsonify({
            "error": f"Model file not found at {MODEL_PATH}",
            "hint": "Set the MODEL_PATH environment variable to a valid .pt file on the server.",
        }), 500

    file = request.files.get("image")
    if not file:
        return jsonify({"error": "No image file provided"}), 400

    request_settings = request.form.get("settings")
    camera_session_id = request.form.get("cameraSessionId")
    allow_violation_log = request.form.get("allowViolationLog", "true").lower() == "true"
    try:
        settings = {**load_settings(), **(json.loads(request_settings) if request_settings else {})}
    except json.JSONDecodeError:
        settings = load_settings()

    img_bytes = file.read()
    np_arr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if frame is None:
        return jsonify({"error": "Invalid image"}), 400

    height, width = frame.shape[:2]

    conf_threshold = confidence_threshold_from_settings(settings)
    try:
        results = model.predict(frame, imgsz=640, conf=conf_threshold, iou=0.5, verbose=False)
    except Exception as exc:
        return jsonify({
            "error": "Detection failed during model inference.",
            "details": str(exc),
            "modelLoaded": model is not None,
            "modelPath": str(MODEL_PATH),
        }), 500

    raw_detections = []
    for r in results:
        for box in r.boxes:
            cls = int(box.cls[0])
            label = model.names[cls]
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            raw_detections.append({
                "label": label,
                "confidence": round(float(box.conf[0]) * 100, 2),
                "xyxy": [x1, y1, x2, y2],
            })

    filtered_detections = dedupe_detections(raw_detections)
    filtered_detections = suppress_false_positive_ppe(filtered_detections)
    tracking_session_key = camera_session_id or "default"
    filtered_detections = stabilize_detections(tracking_session_key, filtered_detections)
    detections = []
    detected_labels = set()
    for index, item in enumerate(filtered_detections):
        x1, y1, x2, y2 = item["xyxy"]
        detected_labels.add(item["label"])
        detections.append({
                "id": f"{item['label']}-{index}",
                "label": item["label"],
                "confidence": item["confidence"],
                "found": True,
                "x": round((x1 / width) * 100, 2),
                "y": round((y1 / height) * 100, 2),
                "w": round(((x2 - x1) / width) * 100, 2),
                "h": round(((y2 - y1) / height) * 100, 2),
            })

    required_ppe = current_required_ppe(settings)
    visible_labels = allowed_detection_labels(settings)
    missing = compute_missing_items(detected_labels, required_ppe)
    compliance = compliance_score(detected_labels, required_ppe)
    threshold = int(settings.get("complianceThreshold", DEFAULT_SETTINGS["complianceThreshold"]))
    violation = len(missing) > 0 and compliance < threshold
    image_path = None

    current_signature = violation_signature(missing, detections) if violation else None
    if camera_session_id:
        with VIOLATION_SESSION_LOCK:
            should_log_violation = (
                violation
                and settings.get("recordViolations", True)
                and allow_violation_log
                and camera_session_id not in LOGGED_VIOLATION_SESSIONS
            )
            if should_log_violation:
                LOGGED_VIOLATION_SESSIONS.add(camera_session_id)
    else:
        should_log_violation = (
            violation
            and settings.get("recordViolations", True)
            and allow_violation_log
            and current_signature != ACTIVE_VIOLATION_SIGNATURE
        )

    if should_log_violation:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if settings.get("autoScreenshot", True):
            image_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            image_path_full = LOGS_DIR / image_name
            cv2.imwrite(str(image_path_full), frame)
            saved_image_path = f"logs/{image_name}"
        else:
            saved_image_path = None

        log_entry = {
            "id": f"violation-{uuid.uuid4().hex}",
            "time": timestamp,
            "missing": missing,
            "image": saved_image_path,
            "detected": sorted(detected_labels),
            "required": required_ppe,
            "confidence": max((item["confidence"] for item in filtered_detections), default=0),
        }

        data = load_violations()
        data.append(log_entry)
        save_json(LOG_FILE, data)
        image_path = saved_image_path

    if violation:
        ACTIVE_VIOLATION_SIGNATURE = current_signature
    else:
        ACTIVE_VIOLATION_SIGNATURE = None

    status_payload = {
        "lastUpdated": datetime.now().isoformat(timespec="seconds"),
        "detected": sorted(label for label in detected_labels if label in visible_labels),
        "detections": [item for item in detections if item["label"] in visible_labels],
        "missing": missing,
        "required": required_ppe,
        "violation": violation,
        "activeWorkers": sum(1 for item in detections if item["label"] == "Person"),
        "cameraOnline": True,
        "image": image_path,
        "settings_used": {
            "sensitivity": settings.get("sensitivity"),
            "sensitivityLevel": settings.get("sensitivityLevel"),
            "recordViolations": settings.get("recordViolations"),
            "autoScreenshot": settings.get("autoScreenshot"),
        },
        "compliance": compliance,
        "unsupported_rules": ["protectiveGloves", "safetyGoggles", "safetyBoots"],
    }
    save_json(STATUS_FILE, status_payload)

    return jsonify({
        **status_payload,
    })


@app.route("/camera-session/end", methods=["POST"])
def end_camera_session():
    payload = request.get_json(silent=True) or {}
    camera_session_id = payload.get("cameraSessionId")
    if camera_session_id:
        LOGGED_VIOLATION_SESSIONS.discard(camera_session_id)
        with TRACKS_LOCK:
            SESSION_TRACKS.pop(camera_session_id, None)
    return jsonify({"ended": bool(camera_session_id)})


@app.route("/violations", methods=["GET"])
def get_violations():
    return jsonify(load_violations())


@app.route("/violations/<violation_id>", methods=["DELETE"])
def delete_violation(violation_id):
    violations = load_violations()
    target = next((item for item in violations if item.get("id") == violation_id), None)

    if not target and violation_id.startswith("legacy:"):
        legacy_value = violation_id.removeprefix("legacy:")
        try:
            time_value, image_value = legacy_value.split("::", 1)
        except ValueError:
            time_value, image_value = "", ""
        target = next(
            (
                item for item in violations
                if item.get("time") == time_value and (item.get("image") or "") == image_value
            ),
            None,
        )

    if not target:
        return jsonify({"error": "Violation not found"}), 404

    image = target.get("image")
    if image:
        image_path = BASE_DIR / image
        if image_path.exists():
            image_path.unlink()

    remaining = [
        item for item in violations
        if not (
            item.get("id") == target.get("id")
            or (
                item.get("time") == target.get("time")
                and (item.get("image") or "") == (target.get("image") or "")
            )
        )
    ]
    save_json(LOG_FILE, remaining)
    return jsonify({"deleted": violation_id})


@app.route("/logs/<path:filename>", methods=["GET"])
def serve_log_image(filename):
    return send_from_directory(LOGS_DIR, filename)


if __name__ == "__main__":
    app.run(debug=False, host="127.0.0.1", port=5000)
