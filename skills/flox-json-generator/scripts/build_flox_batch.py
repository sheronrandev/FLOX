"""Build a folder batch of strict FLOX v4 JSON documents from a normalized specification."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


NODE_TYPES = {"activity", "state", "object-in-state", "decision", "merge", "fork", "join", "initial", "final", "constraint", "note"}
ANCHORS = ("top", "right", "bottom", "left")
EDGE_TYPES = {"control-flow", "object-flow"}
BASE_SIZES = {
    "activity": (160, 64), "state": (160, 64), "object-in-state": (150, 76),
    "decision": (72, 72), "merge": (72, 72), "fork": (150, 20), "join": (150, 20),
    "initial": (42, 42), "final": (42, 42), "constraint": (160, 90), "note": (160, 90),
}
PRESETS = {
    "readable": {"laneWidth": 420, "rankGap": 150, "top": 90},
    "compact-a4-landscape": {"laneWidth": 300, "rankGap": 112, "top": 60},
    "compact-a4-portrait": {"laneWidth": 240, "rankGap": 108, "top": 60},
}
RESERVED = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def stable_id(prefix: str, *parts: Any) -> str:
    raw = "-".join(text(part) for part in parts if text(part))
    slug = re.sub(r"[^A-Za-z0-9_-]+", "-", raw).strip("-_") or "item"
    candidate = f"{prefix}-{slug}"
    if len(candidate) <= 80:
        return candidate
    digest = hashlib.sha1(candidate.encode("utf-8")).hexdigest()[:10]
    return f"{candidate[:69]}-{digest}"


def safe_path_part(value: Any, label: str) -> str:
    part = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "-", text(value)).rstrip(" .")
    require(bool(part) and part not in {".", ".."}, f"{label} produces an empty or unsafe path")
    require(part.upper().split(".")[0] not in RESERVED, f"{label} uses reserved Windows name {part}")
    return part


class TemplateValues(dict[str, Any]):
    def __missing__(self, key: str) -> Any:
        raise ValueError(f"Unknown output template field {{{key}}}")


def render_template(template: str, values: dict[str, Any], label: str) -> str:
    try:
        rendered = template.format_map(TemplateValues(values))
    except (KeyError, ValueError) as error:
        raise ValueError(f"Invalid {label}: {error}") from error
    require(Path(rendered).name == rendered, f"{label} must produce one relative path segment")
    return safe_path_part(rendered, label)


def node_size(node_type: str, label: str) -> tuple[int, int]:
    width, height = BASE_SIZES[node_type]
    if node_type in {"initial", "final", "decision", "merge", "fork", "join"}:
        return width, height
    longest = max((len(line) for line in label.splitlines()), default=0)
    width = min(240, max(width, longest * 7 + 48))
    chars = max(1, (width - 48) // 7)
    words = label.split()
    lines = 1
    current = 0
    for word in words:
        if current and current + 1 + len(word) > chars:
            lines += 1
            current = len(word)
        else:
            current += (1 if current else 0) + len(word)
    return width, max(height, 20 + lines * 16)


def build_document(project: dict[str, Any], diagram: dict[str, Any], defaults: dict[str, int], timestamp: str) -> dict[str, Any]:
    project_id = text(project.get("id"))
    diagram_id = text(diagram.get("id"))
    title = text(diagram.get("title"))
    require(project_id and diagram_id and title, "Every project/diagram requires nonblank id and title")
    require(len(title) <= 120, f"{diagram_id}: title exceeds 120 characters")

    lane_specs = diagram.get("lanes")
    node_specs = diagram.get("nodes")
    edge_specs = diagram.get("edges")
    require(isinstance(lane_specs, list) and lane_specs, f"{diagram_id}: lanes must be a nonempty list")
    require(isinstance(node_specs, list) and node_specs, f"{diagram_id}: nodes must be a nonempty list")
    require(isinstance(edge_specs, list), f"{diagram_id}: edges must be a list")

    lanes: list[dict[str, Any]] = []
    lane_ids: dict[str, str] = {}
    lane_offsets: dict[str, tuple[int, int]] = {}
    cursor_x = 0
    for index, lane in enumerate(lane_specs):
        source_id = text(lane.get("id"))
        name = text(lane.get("name"))
        require(source_id and name, f"{diagram_id}: every lane requires id and name")
        require(source_id not in lane_ids, f"{diagram_id}: duplicate lane id {source_id}")
        width = int(lane.get("width", defaults["laneWidth"]))
        require(180 <= width <= 1200, f"{diagram_id}/{source_id}: lane width must be 180-1200")
        generated_id = stable_id("lane", diagram_id, source_id)
        lane_ids[source_id] = generated_id
        lane_offsets[source_id] = (cursor_x, width)
        lanes.append({"id": generated_id, "name": name[:120], "width": width, "colorIndex": int(lane.get("colorIndex", index % 8))})
        cursor_x += width

    nodes: list[dict[str, Any]] = []
    node_ids: dict[str, str] = {}
    node_by_source: dict[str, dict[str, Any]] = {}
    max_bottom = 0
    for node in node_specs:
        source_id = text(node.get("id"))
        node_type = text(node.get("type"))
        label = text(node.get("label"))
        lane_source_id = node.get("laneId")
        require(source_id and source_id not in node_ids, f"{diagram_id}: missing or duplicate node id {source_id}")
        require(node_type in NODE_TYPES, f"{diagram_id}/{source_id}: unsupported node type {node_type}")
        require(not (node_type in {"decision", "merge"} and label), f"{diagram_id}/{source_id}: {node_type} label must be empty")
        require(len(label) <= 500, f"{diagram_id}/{source_id}: label exceeds 500 characters")
        if lane_source_id is not None:
            lane_source_id = text(lane_source_id)
            require(lane_source_id in lane_ids, f"{diagram_id}/{source_id}: unknown lane {lane_source_id}")
        width, height = node_size(node_type, label)
        has_x = "x" in node
        has_y = "y" in node
        require(has_x == has_y, f"{diagram_id}/{source_id}: provide both x and y, or neither")
        if has_x:
            x, y = float(node["x"]), float(node["y"])
        else:
            require(lane_source_id is not None, f"{diagram_id}/{source_id}: rank layout requires a lane")
            require("rank" in node, f"{diagram_id}/{source_id}: provide rank or explicit x/y")
            lane_x, lane_width = lane_offsets[lane_source_id]
            x = lane_x + (lane_width - width) / 2 + float(node.get("offsetX", 0))
            y = defaults["top"] + float(node["rank"]) * defaults["rankGap"] + float(node.get("offsetY", 0))
        require(-10000 <= x <= 100000 and -10000 <= y <= 100000, f"{diagram_id}/{source_id}: position outside FLOX limits")
        generated_id = stable_id("node", diagram_id, source_id)
        node_ids[source_id] = generated_id
        item: dict[str, Any] = {"id": generated_id, "type": node_type, "position": {"x": x, "y": y}, "label": label, "laneId": lane_ids.get(lane_source_id) if lane_source_id is not None else None}
        if node_type == "object-in-state":
            require("state" in node, f"{diagram_id}/{source_id}: object-in-state requires state")
            item["state"] = text(node["state"])[:200]
        if node_type == "constraint":
            require("body" in node, f"{diagram_id}/{source_id}: constraint requires body")
            item["body"] = text(node["body"])[:1000]
        if isinstance(node.get("style"), dict):
            item["style"] = node["style"]
        nodes.append(item)
        node_by_source[source_id] = {**item, "_width": width, "_height": height}
        max_bottom = max(max_bottom, int(y + height))

    occupied: set[tuple[str, str]] = set()
    edges: list[dict[str, Any]] = []
    seen_edge_ids: set[str] = set()
    for edge in edge_specs:
        source = text(edge.get("source"))
        target = text(edge.get("target"))
        source_edge_id = text(edge.get("id"))
        require(source_edge_id and source_edge_id not in seen_edge_ids, f"{diagram_id}: missing or duplicate edge id {source_edge_id}")
        seen_edge_ids.add(source_edge_id)
        require(source in node_ids and target in node_ids and source != target, f"{diagram_id}/{source_edge_id}: invalid endpoints")
        source_anchor = text(edge.get("sourceAnchor"))
        target_anchor = text(edge.get("targetAnchor"))
        if source_anchor or target_anchor:
            require(source_anchor in ANCHORS and target_anchor in ANCHORS, f"{diagram_id}/{source_edge_id}: provide two valid anchors")
            pairs = [(source_anchor, target_anchor)]
        else:
            a, b = node_by_source[source], node_by_source[target]
            ac = (a["position"]["x"] + a["_width"] / 2, a["position"]["y"] + a["_height"] / 2)
            bc = (b["position"]["x"] + b["_width"] / 2, b["position"]["y"] + b["_height"] / 2)
            dx, dy = bc[0] - ac[0], bc[1] - ac[1]
            preferred = ("right", "left") if abs(dx) >= abs(dy) and dx >= 0 else ("left", "right") if abs(dx) >= abs(dy) else ("bottom", "top") if dy >= 0 else ("top", "bottom")
            pairs = [preferred, ("bottom", "top"), ("right", "left"), ("left", "right"), ("top", "bottom")]
        chosen = next((pair for pair in pairs if (source, pair[0]) not in occupied and (target, pair[1]) not in occupied), None)
        require(chosen is not None, f"{diagram_id}/{source_edge_id}: no unique webhook pair is available; define explicit anchors or remodel")
        occupied.add((source, chosen[0])); occupied.add((target, chosen[1]))
        edge_type = text(edge.get("type")) or "control-flow"
        require(edge_type in EDGE_TYPES, f"{diagram_id}/{source_edge_id}: invalid edge type")
        guard = text(edge.get("guardLabel"))
        require(len(guard) <= 500, f"{diagram_id}/{source_edge_id}: guard exceeds 500 characters")
        item = {"id": stable_id("edge", diagram_id, source_edge_id), "type": edge_type, "sourceNodeId": node_ids[source], "sourceAnchorId": chosen[0], "targetNodeId": node_ids[target], "targetAnchorId": chosen[1], "guardLabel": guard, "routing": "automatic"}
        if isinstance(edge.get("style"), dict):
            item["style"] = edge["style"]
        edges.append(item)

    process_name = text(diagram.get("processName")) or title
    require(len(process_name) <= 120, f"{diagram_id}: process name exceeds 120 characters")
    requested_height = int(diagram.get("height", max(760, max_bottom + 180)))
    height = max(320, min(5000, requested_height))
    return {
        "format": "activity-diagram", "version": 4,
        "metadata": {"title": title, "createdAt": timestamp, "updatedAt": timestamp},
        "processes": [{
            "id": stable_id("process", project_id, diagram_id), "name": process_name,
            "position": {"x": defaults["processX"], "y": defaults["processY"]},
            "lanes": lanes, "nodes": nodes, "edges": edges,
            "swimlaneLayout": {"heightMode": "automatic", "height": height},
        }],
        "appearance": {"canvasColor": "#fafafa", "gridColor": "#d7dde1", "controlFlowColor": "#58666d", "objectFlowColor": "#58666d"},
    }


def generate(spec_path: Path, output_root: Path) -> dict[str, Any]:
    spec = json.loads(spec_path.read_text(encoding="utf-8-sig"))
    require(spec.get("schemaVersion") == 1, "schemaVersion must be 1")
    require(not output_root.exists(), f"Output already exists: {output_root}")
    output_config = spec.get("output") or {}
    project_template = text(output_config.get("projectFolderTemplate")) or "{projectName}"
    file_template = text(output_config.get("fileNameTemplate")) or "{order:02}.json"
    layout = spec.get("layout") or {}
    preset_name = text(layout.get("preset")) or "readable"
    require(preset_name in PRESETS, f"Unknown layout preset {preset_name}")
    defaults = {**PRESETS[preset_name], "processX": 0, "processY": 0}
    for key in defaults:
        if key in layout:
            defaults[key] = int(layout[key])
    require(180 <= defaults["laneWidth"] <= 1200 and defaults["rankGap"] >= 80, "Invalid layout dimensions")
    projects = spec.get("projects")
    require(isinstance(projects, list) and projects, "projects must be a nonempty list")
    timestamp = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    pending: list[tuple[Path, dict[str, Any]]] = []
    destinations: set[str] = set()
    for project in sorted(projects, key=lambda item: (int(item.get("order", 0)), text(item.get("name")))):
        project_values = {"projectId": text(project.get("id")), "projectName": text(project.get("name")), "projectOrder": int(project.get("order", 0))}
        require(project_values["projectId"] and project_values["projectName"], "Every project requires id and name")
        folder = render_template(project_template, project_values, "projectFolderTemplate")
        diagrams = project.get("diagrams")
        require(isinstance(diagrams, list) and diagrams, f"{project_values['projectName']}: diagrams must be nonempty")
        for diagram in sorted(diagrams, key=lambda item: (int(item.get("order", 0)), text(item.get("title")))):
            diagram_values = {"diagramId": text(diagram.get("id")), "diagramTitle": text(diagram.get("title")), "order": int(diagram.get("order", 0))}
            filename = render_template(file_template, diagram_values, "fileNameTemplate")
            require(filename.lower().endswith(".json"), "fileNameTemplate must end in .json")
            relative = Path(folder) / filename
            key = str(relative).casefold()
            require(key not in destinations, f"Duplicate output path {relative}")
            destinations.add(key)
            pending.append((relative, build_document(project, diagram, defaults, timestamp)))
    output_root.mkdir(parents=True)
    for relative, document in pending:
        destination = output_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"output": str(output_root.resolve()), "projectFolders": len({path.parts[0] for path, _ in pending}), "jsonFiles": len(pending), "preset": preset_name}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--spec", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    arguments = parser.parse_args()
    require(arguments.spec.is_file(), f"Missing specification: {arguments.spec}")
    print(json.dumps(generate(arguments.spec.resolve(), arguments.output.resolve()), indent=2))


if __name__ == "__main__":
    main()
