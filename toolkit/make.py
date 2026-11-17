"""Slideshow MP4 from the 16:9 slides: 5 s per slide, 0.7 s transitions, 1920x1080, 30 fps, H.264, no audio.

Reads slides169.json (written by build_169.py) for each slide's section, and the PNGs rendered by
render169.js in out169/. Writes Diwan-<TAG>_Slideshow.mp4 next to this script (or to argv[1]).
"""
import glob, json, os, subprocess, sys
import offer

S = sorted(glob.glob(offer.path("out169", "s-*.png")))
meta = offer.load_json("slides169.json")
assert len(S) == len(meta), f"{len(S)} PNGs in out169/ but {len(meta)} slides in slides169.json"
sec = [m["section"] for m in meta]
HOLD, T, FPS = 5, 0.7, 30
OUT = sys.argv[1] if len(sys.argv) > 1 else offer.path(offer.file_name("Slideshow.mp4"))

args = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
for f in S: args += ["-loop", "1", "-framerate", str(FPS), "-t", str(HOLD + T), "-i", f]
fl, prev = [], "0:v"
for i in range(1, len(S)):
    if i == 1: tr = "circlecrop"                 # index -> first offers
    elif i == len(S) - 1: tr = "fadeblack"       # -> closing app slide
    elif sec[i] != sec[i - 1]: tr = "coverright"   # new section
    else: tr = "slideright"                     # next slide, same section (right-to-left reading)
    out = f"v{i}"
    fl.append(f"[{prev}][{i}:v]xfade=transition={tr}:duration={T}:offset={HOLD * i}[{out}]")
    prev = out
fl.append(f"[{prev}]format=yuv420p,fade=t=in:st=0:d=0.5,fade=t=out:st={HOLD*len(S)+T-0.7}:d=0.7[out]")
args += ["-filter_complex", ";".join(fl), "-map", "[out]", "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast",
         "-crf", "18", "-movflags", "+faststart", "-an", OUT]
subprocess.run(args, check=True)
print("video", OUT, "| slides", len(S), "| seconds", round(HOLD * len(S) + T, 1))
