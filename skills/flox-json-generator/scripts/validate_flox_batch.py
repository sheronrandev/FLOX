"""Validate every FLOX v4 JSON in a generated batch, including academic graph and route geometry."""

from __future__ import annotations

import argparse
import heapq
import json
import math
from collections import Counter, defaultdict, deque
from pathlib import Path
from typing import Any


NODE_TYPES = {"activity", "state", "object-in-state", "decision", "merge", "fork", "join", "initial", "final", "constraint", "note"}
ANCHORS = {"top", "right", "bottom", "left"}
BASE_SIZES = {
    "activity": (160, 64), "state": (160, 64), "object-in-state": (150, 76),
    "decision": (72, 72), "merge": (72, 72), "fork": (150, 20), "join": (150, 20),
    "initial": (42, 42), "final": (42, 42), "constraint": (160, 90), "note": (160, 90),
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def node_size(node: dict[str, Any]) -> tuple[int, int]:
    node_type = node["type"]
    label = str(node.get("label", ""))
    width, height = BASE_SIZES[node_type]
    if node_type in {"initial", "final", "decision", "merge", "fork", "join"}:
        return width, height
    values = [label]
    if node_type == "object-in-state":
        values.append(f"[{node.get('state', '')}]")
    if node_type == "constraint":
        values.extend(["invariant", str(node.get("body", ""))])
    longest = max((len(line) for value in values for line in value.splitlines()), default=0)
    width = min(240, max(width, longest * 7 + 48))
    max_chars = max(1, (width - 48) // 7)
    lines = 0
    for value in values:
        current = 0
        value_lines = 1
        for word in value.split():
            if current and current + 1 + len(word) > max_chars:
                value_lines += 1; current = len(word)
            else:
                current += (1 if current else 0) + len(word)
        lines += value_lines
    return width, max(height, 20 + lines * 16)


def rect(node: dict[str, Any], padding: float = 0) -> tuple[float, float, float, float]:
    width, height = node_size(node)
    x, y = node["position"]["x"], node["position"]["y"]
    return x - padding, y - padding, x + width + padding, y + height + padding


def anchor(node: dict[str, Any], side: str) -> tuple[float, float]:
    left, top, right, bottom = rect(node)
    cx, cy = (left + right) / 2, (top + bottom) / 2
    return {"top": (cx, top), "right": (right, cy), "bottom": (cx, bottom), "left": (left, cy)}[side]


def lead(point: tuple[float, float], side: str, distance: float = 20) -> tuple[float, float]:
    x, y = point
    return {"top": (x, y - distance), "right": (x + distance, y), "bottom": (x, y + distance), "left": (x - distance, y)}[side]


def inside(point: tuple[float, float], obstacle: tuple[float, float, float, float]) -> bool:
    return obstacle[0] < point[0] < obstacle[2] and obstacle[1] < point[1] < obstacle[3]


def segment_hits(a: tuple[float, float], b: tuple[float, float], obstacles: list[tuple[float, float, float, float]]) -> bool:
    for left, top, right, bottom in obstacles:
        if a[0] == b[0] and left < a[0] < right and max(a[1], b[1]) > top and min(a[1], b[1]) < bottom:
            return True
        if a[1] == b[1] and top < a[1] < bottom and max(a[0], b[0]) > left and min(a[0], b[0]) < right:
            return True
        if a[0] != b[0] and a[1] != b[1]:
            return True
    return False


def simplify(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    unique: list[tuple[float, float]] = []
    for point in points:
        if not unique or point != unique[-1]:
            unique.append(point)
    return [point for index, point in enumerate(unique) if index in {0, len(unique) - 1} or not ((unique[index - 1][0] == point[0] == unique[index + 1][0]) or (unique[index - 1][1] == point[1] == unique[index + 1][1]))]


def length(points: list[tuple[float, float]]) -> float:
    return sum(abs(point[0] - points[index][0]) + abs(point[1] - points[index][1]) for index, point in enumerate(points[1:]))


def clear(points: list[tuple[float, float]], obstacles: list[tuple[float, float, float, float]]) -> bool:
    return all(not segment_hits(points[index], point, obstacles) for index, point in enumerate(points[1:]))


def find_path(start: tuple[float, float], end: tuple[float, float], obstacles: list[tuple[float, float, float, float]]) -> list[tuple[float, float]]:
    direct = [[start, (end[0], start[1]), end], [start, (start[0], end[1]), end]]
    direct = [candidate for candidate in direct if clear(candidate, obstacles)]
    if direct:
        return simplify(min(direct, key=length))
    xs = sorted({start[0], end[0], *(value for obstacle in obstacles for value in (obstacle[0], obstacle[2]))})
    ys = sorted({start[1], end[1], *(value for obstacle in obstacles for value in (obstacle[1], obstacle[3]))})
    points = {(x, y) for x in xs for y in ys if not any(inside((x, y), obstacle) for obstacle in obstacles)}
    distances = {start: 0.0}
    previous: dict[tuple[float, float], tuple[float, float]] = {}
    queue: list[tuple[float, float, tuple[float, float]]] = [(length([start, end]), 0.0, start)]
    visited: set[tuple[float, float]] = set()
    while queue:
        _, current_distance, current = heapq.heappop(queue)
        if current in visited:
            continue
        visited.add(current)
        if current == end:
            break
        xi, yi = xs.index(current[0]), ys.index(current[1])
        candidates = []
        for nx, ny in ((xi - 1, yi), (xi + 1, yi), (xi, yi - 1), (xi, yi + 1)):
            if 0 <= nx < len(xs) and 0 <= ny < len(ys) and (xs[nx], ys[ny]) in points:
                candidates.append((xs[nx], ys[ny]))
        for neighbor in candidates:
            if segment_hits(current, neighbor, obstacles):
                continue
            candidate_distance = current_distance + length([current, neighbor])
            if candidate_distance < distances.get(neighbor, math.inf):
                distances[neighbor] = candidate_distance
                previous[neighbor] = current
                heapq.heappush(queue, (candidate_distance + length([neighbor, end]), candidate_distance, neighbor))
    if end not in distances:
        return [start, (end[0], start[1]), end]
    result = [end]
    while result[0] != start:
        result.insert(0, previous[result[0]])
    return simplify(result)


def route(nodes: dict[str, dict[str, Any]], edge: dict[str, Any]) -> list[tuple[float, float]]:
    source, target = nodes[edge["sourceNodeId"]], nodes[edge["targetNodeId"]]
    start = anchor(source, edge["sourceAnchorId"])
    end = anchor(target, edge["targetAnchorId"])
    start_lead, end_lead = lead(start, edge["sourceAnchorId"]), lead(end, edge["targetAnchorId"])
    obstacles = [rect(node, 16) for node_id, node in nodes.items() if node_id not in {source["id"], target["id"]}]
    return simplify([start, start_lead, *find_path(start_lead, end_lead, obstacles), end_lead, end])


def segments(points: list[tuple[float, float]]) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    return [(points[index], point) for index, point in enumerate(points[1:]) if point != points[index]]


def between(value: float, first: float, second: float) -> bool:
    return min(first, second) <= value <= max(first, second)


def segment_conflict(a1: tuple[float, float], a2: tuple[float, float], b1: tuple[float, float], b2: tuple[float, float]) -> bool:
    av, bv = a1[0] == a2[0], b1[0] == b2[0]
    if av and bv:
        return a1[0] == b1[0] and min(max(a1[1], a2[1]), max(b1[1], b2[1])) > max(min(a1[1], a2[1]), min(b1[1], b2[1]))
    if not av and not bv:
        return a1[1] == b1[1] and min(max(a1[0], a2[0]), max(b1[0], b2[0])) > max(min(a1[0], a2[0]), min(b1[0], b2[0]))
    vertical = (a1, a2) if av else (b1, b2)
    horizontal = (b1, b2) if av else (a1, a2)
    return between(vertical[0][0], horizontal[0][0], horizontal[1][0]) and between(horizontal[0][1], vertical[0][1], vertical[1][1])


def descendants(start: str, outgoing: dict[str, list[dict[str, Any]]]) -> set[str]:
    found: set[str] = set()
    queue = deque([start])
    while queue:
        node_id = queue.popleft()
        if node_id in found:
            continue
        found.add(node_id)
        queue.extend(edge["targetNodeId"] for edge in outgoing[node_id])
    return found


def validate_document(file: Path, document: Any) -> int:
    prefix = str(file)
    require(isinstance(document, dict), f"{prefix}: root must be an object")
    require(document.get("format") == "activity-diagram" and document.get("version") == 4, f"{prefix}: expected FLOX v4")
    metadata = document.get("metadata")
    require(isinstance(metadata, dict) and 0 < len(str(metadata.get("title", "")).strip()) <= 120, f"{prefix}: invalid metadata")
    require(isinstance(document.get("appearance"), dict), f"{prefix}: missing appearance")
    processes = document.get("processes")
    require(isinstance(processes, list) and len(processes) == 1, f"{prefix}: expected exactly one process")
    process = processes[0]
    lanes, node_list, edges = process.get("lanes"), process.get("nodes"), process.get("edges")
    require(isinstance(lanes, list) and isinstance(node_list, list) and isinstance(edges, list), f"{prefix}: invalid process arrays")
    require(0 < len(lanes) <= 1000 and len(node_list) <= 5000 and len(edges) <= 10000, f"{prefix}: item limits exceeded")
    all_items = [process, *lanes, *node_list, *edges]
    ids = [str(item.get("id", "")) for item in all_items]
    require(all(ids) and len(ids) == len(set(ids)) and all(len(item) <= 80 for item in ids), f"{prefix}: missing, duplicate, or oversized ID")
    lane_ids = {lane["id"] for lane in lanes}
    for lane in lanes:
        require(0 < len(str(lane.get("name", "")).strip()) <= 120 and 180 <= lane.get("width", 0) <= 1200 and lane.get("colorIndex") in range(8), f"{prefix}: invalid lane {lane.get('id')}")
    nodes = {node["id"]: node for node in node_list}
    for node in node_list:
        require(node.get("type") in NODE_TYPES and isinstance(node.get("position"), dict), f"{prefix}: invalid node {node.get('id')}")
        require(node.get("laneId") is None or node.get("laneId") in lane_ids, f"{prefix}: missing lane for {node['id']}")
        require(isinstance(node.get("label"), str) and len(node["label"]) <= 500, f"{prefix}: invalid label on {node['id']}")
        require(not (node["type"] in {"decision", "merge"} and node["label"]), f"{prefix}: labelled {node['type']} {node['id']}")
        require(node["type"] == "object-in-state" or "state" not in node, f"{prefix}: state on invalid node {node['id']}")
        require(node["type"] == "constraint" or "body" not in node, f"{prefix}: body on invalid node {node['id']}")
    incoming: dict[str, list[dict[str, Any]]] = defaultdict(list)
    outgoing: dict[str, list[dict[str, Any]]] = defaultdict(list)
    occupied: set[tuple[str, str]] = set()
    for edge in edges:
        require(edge.get("type") in {"control-flow", "object-flow"} and edge.get("routing") == "automatic", f"{prefix}: invalid edge {edge.get('id')}")
        require(edge.get("sourceNodeId") in nodes and edge.get("targetNodeId") in nodes and edge["sourceNodeId"] != edge["targetNodeId"], f"{prefix}: dangling/self edge {edge.get('id')}")
        require(edge.get("sourceAnchorId") in ANCHORS and edge.get("targetAnchorId") in ANCHORS, f"{prefix}: invalid anchors on {edge['id']}")
        for endpoint in ((edge["sourceNodeId"], edge["sourceAnchorId"]), (edge["targetNodeId"], edge["targetAnchorId"])):
            require(endpoint not in occupied, f"{prefix}: reused webhook {endpoint[0]}:{endpoint[1]}")
            occupied.add(endpoint)
        outgoing[edge["sourceNodeId"]].append(edge); incoming[edge["targetNodeId"]].append(edge)
    starts = [node for node in node_list if node["type"] == "initial"]
    finals = [node for node in node_list if node["type"] == "final"]
    require(len(starts) == len(finals) == 1, f"{prefix}: expected one initial and one final")
    require(not incoming[starts[0]["id"]] and not outgoing[finals[0]["id"]], f"{prefix}: invalid initial/final direction")
    final_id = finals[0]["id"]
    for node in node_list:
        if node["type"] == "decision":
            branches = outgoing[node["id"]]
            require(len(branches) >= 2 and all(str(edge.get("guardLabel", "")).strip() for edge in branches), f"{prefix}: unguarded/incomplete decision {node['id']}")
            common = set.intersection(*(descendants(edge["targetNodeId"], outgoing) for edge in branches))
            merges = [candidate for candidate in common if nodes[candidate]["type"] == "merge" and final_id in descendants(candidate, outgoing)]
            require(bool(merges), f"{prefix}: decision {node['id']} does not converge through a merge before final")
        if node["type"] == "fork":
            branches = outgoing[node["id"]]
            require(len(branches) >= 2, f"{prefix}: fork {node['id']} has fewer than two branches")
            common = set.intersection(*(descendants(edge["targetNodeId"], outgoing) for edge in branches))
            joins = [candidate for candidate in common if nodes[candidate]["type"] == "join" and final_id in descendants(candidate, outgoing)]
            require(bool(joins), f"{prefix}: fork {node['id']} does not converge through a join before final")
        if node["type"] in {"merge", "join"}:
            require(len(incoming[node["id"]]) >= 2, f"{prefix}: {node['type']} {node['id']} has fewer than two inputs")
    require(final_id in descendants(starts[0]["id"], outgoing), f"{prefix}: final is unreachable")
    for left_index, first in enumerate(node_list):
        first_rect = rect(first)
        for second in node_list[left_index + 1:]:
            second_rect = rect(second)
            overlap = min(first_rect[2], second_rect[2]) > max(first_rect[0], second_rect[0]) and min(first_rect[3], second_rect[3]) > max(first_rect[1], second_rect[1])
            require(not overlap, f"{prefix}: nodes {first['id']} and {second['id']} overlap")
    routes = {edge["id"]: route(nodes, edge) for edge in edges}
    for edge in edges:
        obstacles = [rect(node, 1) for node_id, node in nodes.items() if node_id not in {edge["sourceNodeId"], edge["targetNodeId"]}]
        for first, second in segments(routes[edge["id"]]):
            require(not segment_hits(first, second, obstacles), f"{prefix}: edge {edge['id']} crosses a node")
    for left_index, first in enumerate(edges):
        for second in edges[left_index + 1:]:
            for a1, a2 in segments(routes[first["id"]]):
                for b1, b2 in segments(routes[second["id"]]):
                    require(not segment_conflict(a1, a2, b1, b2), f"{prefix}: edges {first['id']} and {second['id']} intersect or overlap")
    return len(lanes)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--spec", type=Path)
    arguments = parser.parse_args()
    require(arguments.output.is_dir(), f"Missing output folder: {arguments.output}")
    files = sorted(arguments.output.rglob("*.json"))
    require(bool(files), "No JSON files found")
    if arguments.spec:
        spec = json.loads(arguments.spec.read_text(encoding="utf-8-sig"))
        expected = sum(len(project.get("diagrams", [])) for project in spec.get("projects", []))
        require(len(files) == expected, f"Expected {expected} JSON files, found {len(files)}")
    lane_counts: Counter[int] = Counter()
    total_bytes = 0
    for file in files:
        require(file.stat().st_size <= 5_000_000, f"{file}: exceeds 5 MB")
        lane_counts[validate_document(file, json.loads(file.read_text(encoding="utf-8-sig")))] += 1
        total_bytes += file.stat().st_size
    project_folders = {file.relative_to(arguments.output).parts[0] for file in files}
    print(json.dumps({"output": str(arguments.output.resolve()), "projectFolders": len(project_folders), "jsonFiles": len(files), "bytes": total_bytes, "laneCounts": dict(sorted(lane_counts.items()))}, indent=2))


if __name__ == "__main__":
    main()
