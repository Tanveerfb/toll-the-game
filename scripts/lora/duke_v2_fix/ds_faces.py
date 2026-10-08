"""Run with ComfyUI's embedded python (it has ultralytics): face boxes for every image in the duke_v1 dataset."""
import glob
import json
import os

from ultralytics import YOLO

DS = r"C:\Users\Tanve\.comfyui-mcp\training\datasets\duke_v1"
m = YOLO(r"E:\Installed\ComfyUI_windows_portable\ComfyUI\models\ultralytics\bbox\face_yolov8m.pt")
out = {}
for f in sorted(glob.glob(os.path.join(DS, "*.png"))):
    r = m(f, verbose=False)[0]
    boxes = sorted(r.boxes.xyxy.tolist(), key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]))
    out[os.path.basename(f)] = [round(v) for v in boxes[0]] if boxes else None
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "ds_faces.json"), "w"), indent=1)
print(out)
