from pathlib import Path

from ultralytics import YOLO


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "archive" / "css-data" / "ppe_data_gpu.yaml"
RUNS = ROOT / "archive" / "results_yolov8n_100e" / "kaggle" / "working" / "runs"


def main() -> None:
    model = YOLO("yolov8m.pt")
    model.train(
        data=str(DATA),
        epochs=300,
        imgsz=640,
        batch=16,
        patience=50,
        workers=8,
        optimizer="SGD",
        project=str(RUNS),
        name="detect_gpu_boost93",
        exist_ok=False,
        pretrained=True,
        device=0,
    )


if __name__ == "__main__":
    main()
