import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = ROOT / "archive" / "results_yolov8n_100e" / "kaggle" / "working" / "__notebook__.ipynb"
DATASET = (ROOT / "archive" / "css-data").resolve()
WORKING = NOTEBOOK.parent.resolve()
OUTPUT = WORKING / "__notebook___local_run.ipynb"
TRAIN_MODEL = "yolov8m.pt"
TRAIN_EPOCHS = 300
TRAIN_BATCH = 32
TRAIN_PATIENCE = 50


def adapt_source(lines: list[str]) -> list[str] | None:
    text = "".join(lines)

    if "/kaggle/input/weapon-detection-test" in text:
        return None

    if "!pip install -q ultralytics" in text:
        return [
            "print('Skipping ultralytics install; package already present in local venv')\n",
            "from ultralytics import YOLO\n",
        ]

    if "%cat /kaggle/working/ppe_data.yaml" in text:
        return [
            "from pathlib import Path\n",
            f"print(Path(r'{(WORKING / 'ppe_data.yaml').as_posix()}').read_text())\n",
        ]

    if "!yolo task=detect mode=train" in text:
        return [
            f"!yolo task=detect mode=train epochs={TRAIN_EPOCHS} "
            f"data='{(WORKING / 'ppe_data.yaml').as_posix()}' "
            f"model={TRAIN_MODEL} imgsz=640 batch={TRAIN_BATCH} patience={TRAIN_PATIENCE}\n"
        ]

    text = text.replace(
        "/kaggle/input/construction-site-safety-image-dataset-roboflow",
        DATASET.as_posix(),
    )
    text = text.replace("/kaggle/working", WORKING.as_posix())
    text = text.replace("yolov8n.pt", TRAIN_MODEL)
    text = text.replace("PIL.Image.open", "Image.open")
    text = text.replace("train_results_path + 'best.pt'", "train_results_path + 'weights/best.pt'")
    text = text.replace(
        f"test_results_path = '{WORKING.as_posix()}/runs/detect/predict'",
        f"test_results_path = '{(DATASET / 'test' / 'images').as_posix()}'",
    )
    text = text.replace("show=True", "show=False")
    text = text.replace("show = True", "show = False")
    if "YOLO(" in text and "from ultralytics import YOLO" not in text:
        text = "from ultralytics import YOLO\n" + text
    return text.splitlines(keepends=True)


def main() -> None:
    nb = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
    adapted_cells = []

    for cell in nb.get("cells", []):
        if cell.get("cell_type") != "code":
            adapted_cells.append(cell)
            continue

        new_source = adapt_source(cell.get("source", []))
        if new_source is None:
            continue

        new_cell = dict(cell)
        new_cell["source"] = new_source
        new_cell["outputs"] = []
        new_cell["execution_count"] = None
        adapted_cells.append(new_cell)

    adapted_cells.append(
        {
            "cell_type": "markdown",
            "metadata": {},
            "source": [
                "## Final Accuracy Metrics\n",
                "\n",
                "This cell shows the main YOLO validation metrics from the training run.\n",
            ],
        }
    )
    adapted_cells.append(
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "from pathlib import Path\n",
                "import pandas as pd\n",
                "\n",
                f"results_path = Path(r'{(WORKING / 'runs' / 'detect' / 'train' / 'results.csv')}')\n",
                "df = pd.read_csv(results_path)\n",
                "df.columns = df.columns.str.strip()\n",
                "best_row = df.loc[df['metrics/mAP50-95(B)'].idxmax()]\n",
                "\n",
                "print(f\"Best epoch: {int(best_row['epoch'])}\")\n",
                "print(f\"Precision: {best_row['metrics/precision(B)'] * 100:.2f}%\")\n",
                "print(f\"Recall: {best_row['metrics/recall(B)'] * 100:.2f}%\")\n",
                "print(f\"mAP@50: {best_row['metrics/mAP50(B)'] * 100:.2f}%\")\n",
                "print(f\"mAP@50:95: {best_row['metrics/mAP50-95(B)'] * 100:.2f}%\")\n",
            ],
        }
    )

    nb["cells"] = adapted_cells
    OUTPUT.write_text(json.dumps(nb, ensure_ascii=False, indent=1), encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    main()
