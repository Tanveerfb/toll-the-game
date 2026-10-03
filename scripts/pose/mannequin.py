"""Posable mannequin -> depth map + OpenPose joints, rendered headless in Blender.

Why: a hand-drawn 2D skeleton cannot say "this hand is coming at the camera", so Sara's kit
drafts kept coming back as standing photoshoots (2026-10-03). A depth map from a posed 3D figure
carries foreshortening, overlap and camera angle; the union ControlNet reads depth + pose together.

Run (Blender 5.0 at D:\\Blender):
  D:\\Blender\\blender.exe -b --factory-startup --python scripts/pose/mannequin.py -- <pose.json> <out_dir>
Writes <out_dir>/<name>_depth.png (near = white) and <out_dir>/<name>_joints.json (COCO-18 2D
pixel coords, only joints visible from the camera); draw_pose.py turns the joints into an
OpenPose image.

A pose is authored as BONE DIRECTIONS, not positions, so proportions can never break:
world axes x = right, y = away from the default camera, z = up. "left" means the subject's left.
Lengths are fixed below (a 5'3" adult woman, metres).
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

L = {"spine": 0.48, "neck": 0.14, "shoulder": 0.17, "hip": 0.09, "upper_arm": 0.27, "forearm": 0.24,
     "hand": 0.07, "thigh": 0.42, "shin": 0.40, "foot": 0.12}
R = {"upper_arm": 0.045, "forearm": 0.037, "thigh": 0.07, "shin": 0.05, "hand": 0.04, "head": 0.105}


def unit(v):
    v = Vector(v)
    return v.normalized()


def joints(p):
    """Forward kinematics from the pose's bone directions -> 3D joint positions."""
    J = {"pelvis": Vector(p.get("pelvis", (0, 0, 0.92)))}
    hip_ax, sh_ax = unit(p["hip_axis"]), unit(p["shoulder_axis"])
    J["neck"] = J["pelvis"] + unit(p["spine"]) * L["spine"]
    J["head"] = J["neck"] + unit(p.get("neck", p["spine"])) * (L["neck"] + R["head"])
    for side, s in (("l", 1), ("r", -1)):
        J[f"hip_{side}"] = J["pelvis"] + hip_ax * L["hip"] * s
        J[f"sho_{side}"] = J["neck"] + sh_ax * L["shoulder"] * s
        J[f"elb_{side}"] = J[f"sho_{side}"] + unit(p[f"upper_arm_{side}"]) * L["upper_arm"]
        J[f"wri_{side}"] = J[f"elb_{side}"] + unit(p[f"forearm_{side}"]) * L["forearm"]
        J[f"hand_{side}"] = J[f"wri_{side}"] + unit(p.get(f"hand_{side}", p[f"forearm_{side}"])) * L["hand"]
        J[f"kne_{side}"] = J[f"hip_{side}"] + unit(p[f"thigh_{side}"]) * L["thigh"]
        J[f"ank_{side}"] = J[f"kne_{side}"] + unit(p[f"shin_{side}"]) * L["shin"]
        J[f"toe_{side}"] = J[f"ank_{side}"] + unit(p.get(f"foot_{side}", (0, -1, -0.2))) * L["foot"]
    face = unit(p.get("face", (0, -1, 0)))
    lat = (sh_ax - face * sh_ax.dot(face)).normalized()  # across the face, toward her left
    up = face.cross(lat).normalized()
    J["nose"] = J["head"] + face * R["head"]
    J["eye_l"] = J["head"] + face * R["head"] * 0.8 + lat * 0.035 + up * 0.025
    J["eye_r"] = J["head"] + face * R["head"] * 0.8 - lat * 0.035 + up * 0.025
    J["ear_l"] = J["head"] + lat * R["head"]
    J["ear_r"] = J["head"] - lat * R["head"]
    J["_face"] = face
    return J


def capsule(a, b, r, name):
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, location=(a + b) / 2, vertices=24)
    o = bpy.context.object
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    o.name = name
    for end in (a, b):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=end, segments=16, ring_count=8)


def build(J):
    for side in ("l", "r"):
        capsule(J[f"sho_{side}"], J[f"elb_{side}"], R["upper_arm"], "uarm")
        capsule(J[f"elb_{side}"], J[f"wri_{side}"], R["forearm"], "farm")
        capsule(J[f"wri_{side}"], J[f"hand_{side}"], R["hand"], "hand")
        capsule(J[f"hip_{side}"], J[f"kne_{side}"], R["thigh"], "thigh")
        capsule(J[f"kne_{side}"], J[f"ank_{side}"], R["shin"], "shin")
        capsule(J[f"ank_{side}"], J[f"toe_{side}"], 0.04, "foot")
    # torso: a stack of capsules from the hips to the shoulders, wider at chest and hips
    for t, r in ((0.0, 0.12), (0.35, 0.11), (0.7, 0.13), (1.0, 0.12)):
        c = J["pelvis"].lerp(J["neck"], t)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=c, segments=24, ring_count=12)
        bpy.context.object.scale = (1.25, 0.8, 1.0)
    capsule(J["pelvis"], J["neck"], 0.11, "torso")
    capsule(J["neck"], J["head"], 0.045, "neck")
    bpy.ops.mesh.primitive_uv_sphere_add(radius=R["head"], location=J["head"], segments=32, ring_count=16)
    bpy.context.object.scale = (0.92, 1.0, 1.08)


def camera(c, w, h):
    bpy.ops.object.camera_add(location=c["location"])
    cam = bpy.context.object
    look = Vector(c["look_at"]) - Vector(c["location"])
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = look.to_track_quat("-Z", "Y")
    if c.get("roll_deg"):
        from mathutils import Quaternion
        cam.rotation_quaternion = cam.rotation_quaternion @ Quaternion((0, 0, 1), math.radians(c["roll_deg"]))
    cam.data.lens = c.get("lens_mm", 50)
    cam.data.sensor_fit = "VERTICAL"
    bpy.context.scene.camera = cam
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = w, h, 100
    return cam


COCO = ["nose", "neck", "sho_r", "elb_r", "wri_r", "sho_l", "elb_l", "wri_l", "hip_r", "kne_r", "ank_r",
        "hip_l", "kne_l", "ank_l", "eye_r", "eye_l", "ear_r", "ear_l"]


def main():
    pose_file, out_dir = sys.argv[sys.argv.index("--") + 1:][:2]
    p = json.load(open(pose_file, encoding="utf-8"))
    name = os.path.splitext(os.path.basename(pose_file))[0]
    w, h = p.get("size", (832, 1216))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    J = joints(p)
    build(J)
    cam = camera(p["camera"], w, h)

    # Depth as a plain PNG: every part gets an emission material whose brightness is its view
    # depth, mapped over the figure's own range (nearest = white, farthest = 25% grey), on black.
    # A Z/mist pass would be the textbook route, but Blender 5 headless wrote only Combined to the
    # EXR (2026-10-03), so the depth is drawn by the shader instead.
    bpy.context.view_layer.update()  # matrix_world is stale until the depsgraph updates
    dists = [(cam.matrix_world.inverted() @ v).z for k, v in J.items() if not k.startswith("_")]
    near, far = -max(dists) - 0.15, -min(dists) + 0.15
    mat = bpy.data.materials.new("depth")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    camdata = nt.nodes.new("ShaderNodeCameraData")
    rng = nt.nodes.new("ShaderNodeMapRange")
    rng.inputs["From Min"].default_value, rng.inputs["From Max"].default_value = near, far
    rng.inputs["To Min"].default_value, rng.inputs["To Max"].default_value = 1.0, 0.25
    emit = nt.nodes.new("ShaderNodeEmission")
    outn = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(camdata.outputs["View Z Depth"], rng.inputs["Value"])
    nt.links.new(rng.outputs["Result"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], outn.inputs["Surface"])
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.data.materials.clear()
            o.data.materials.append(mat)
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 8
    sc.cycles.use_denoising = False
    sc.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("black")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0, 0, 0, 1)
    sc.world = world
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    os.makedirs(out_dir, exist_ok=True)
    sc.render.filepath = os.path.join(out_dir, f"{name}_depth.png")
    bpy.ops.render.render(write_still=True)

    # 2D joints, visibility-aware: the face only when it turns toward the camera.
    to_cam = (cam.location - J["head"]).normalized()
    face_on = J["_face"].dot(to_cam) > 0.15
    pts = {}
    for i, key in enumerate(COCO):
        if key in ("nose", "eye_l", "eye_r") and not face_on:
            continue
        if key.startswith("ear"):
            ear_dir = (J[key] - J["head"]).normalized()
            if ear_dir.dot(to_cam) < -0.35:
                continue
        v = world_to_camera_view(sc, cam, J[key])
        if not (-0.2 <= v.x <= 1.2 and -0.2 <= v.y <= 1.2) or v.z <= 0:
            continue
        pts[i] = [round(v.x * w), round((1 - v.y) * h)]
    json.dump({"size": [w, h], "joints": pts}, open(os.path.join(out_dir, f"{name}_joints.json"), "w"), indent=1)

    print("ok", name, len(pts), "joints")


main()
