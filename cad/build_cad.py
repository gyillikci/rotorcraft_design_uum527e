"""Build CAD models (STEP, STL) from the sizing geometry.

Run from the repo root:
    node sizing/run_sizing.js 16 800 145
    python3 cad/build_cad.py

Requires: pip install cadquery
"""
import json
import math
from pathlib import Path

import cadquery as cq

HERE = Path(__file__).parent
COLORS = {"body": (0.85, 0.87, 0.88), "hub": (0.25, 0.27, 0.3), "tyre": (0.08, 0.08, 0.08),
          "blade": (0.15, 0.17, 0.2)}


def superellipse(sec, n=24, e=2.6):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        c, s = math.cos(t), math.sin(t)
        y = sec["w"] / 2 * math.copysign(abs(c) ** (2 / e), c)
        z = sec["h"] / 2 * math.copysign(abs(s) ** (2 / e), s)
        pts.append(cq.Vector(sec["x"], y, sec["z"] + z))
    return cq.Wire.assembleEdges([cq.Edge.makeSpline(pts, periodic=True)])


def loft(part):
    wires = [superellipse(s) for s in part["sections"]]
    return cq.Workplane().add(cq.Solid.makeLoft(wires, False))


def cyl(part):
    direction = {"x": (1, 0, 0), "y": (0, 1, 0), "z": (0, 0, 1)}[part["axis"]]
    d = cq.Vector(*direction)
    base = cq.Vector(*part["p"]) - d * (part["len"] / 2)
    return cq.Workplane().add(cq.Solid.makeCylinder(part["r"], part["len"], base, d))


def box(part):
    lx, ly, lz = part["size"]
    return cq.Workplane().box(lx, ly, lz).translate(tuple(part["p"]))


def rotor_blades(rot):
    """One solid per blade, rotated about the rotor axis."""
    R, c, r0 = rot["R"], rot["chord"], rot["rootCut"] * rot["R"]
    span = R - r0
    t = max(0.12 * c, 0.03)
    hub = cq.Vector(*rot["hub"])
    phase = rot.get("phase", 0)
    blades = []
    for k in range(rot["Nb"]):
        az = phase + 360 * k / rot["Nb"]
        if rot["axis"] == "z":
            b = cq.Workplane().box(span, c, t).translate((r0 + span / 2, 0, 0))
            b = b.rotate((0, 0, 0), (0, 0, 1), az)
        else:  # tail rotor, axis y
            b = cq.Workplane().box(span, t, c).translate((r0 + span / 2, 0, 0))
            b = b.rotate((0, 0, 0), (0, 1, 0), az)
        blades.append(b.translate(hub.toTuple()))
    return blades


def build(concept):
    data = json.loads((HERE / f"sizing_{concept}.json").read_text())
    g = data["geometry"]
    asm = cq.Assembly(name=concept)
    solids = []

    def add(wp, name, color):
        asm.add(wp, name=name, color=cq.Color(*COLORS[color]))
        solids.append(wp.val())

    for p in g["lofts"]:
        add(loft(p), p["name"], p["color"])
    for p in g["cyls"]:
        add(cyl(p), p["name"], p["color"])
    for p in g["boxes"]:
        add(box(p), p["name"], p["color"])
    for rot in g["rotors"]:
        for i, b in enumerate(rotor_blades(rot)):
            add(b, f"{rot['name']}_blade{i + 1}", "blade")

    out = HERE / "out"
    out.mkdir(exist_ok=True)
    asm.save(str(out / f"heli_{concept}.step"))
    compound = cq.Compound.makeCompound(solids)
    cq.exporters.export(compound, str(out / f"heli_{concept}.stl"), tolerance=0.02, angularTolerance=0.2)
    print(concept, data["summary"])


if __name__ == "__main__":
    for c in ("single", "coax"):
        build(c)
