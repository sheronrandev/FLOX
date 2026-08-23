import { resolveEdgeColor, type DiagramAppearance, type DiagramDocument, type DiagramNode } from "../domain/diagram";
import { defaultNodeStyles, getExternalLabelLayout, getNodeDimensions, getNodeTextLayout, resolveNodeStyle, wrapText } from "../domain/notation";
import { getSwimlanePoolGeometry } from "../domain/swimlane-layout";
import type { ExportPreferences } from "../domain/preferences";
import { guardLabelPoint, routeAll, type Point } from "./routing";
import { flattenProcesses } from "../domain/process-layout";
import { safeArchiveSegment } from "./process-export";

const xml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
export const safeExportName = safeArchiveSegment;

function assertExportGeometry(document: DiagramDocument) {
  const coordinates = document.processes.flatMap((process) => [
    { path: `process ${process.name}`, position: process.position },
    ...process.nodes.map((node) => ({ path: `node ${node.label || node.id}`, position: node.position })),
  ]);
  if (coordinates.some(({ position }) => !position || !Number.isFinite(position.x) || !Number.isFinite(position.y))) {
    throw new Error("This diagram contains an incomplete node or process position. Re-import the diagram JSON after saving it from FLOX, then try exporting again.");
  }
}

function safeSuppliedExportName(filenameBase: string): string {
  const stripped = filenameBase.replace(/\.(?:png|svg)$/i, "");
  const numbered = /^(.*)-(\d{3})$/.exec(stripped);
  return numbered ? `${safeExportName(numbered[1])}-${numbered[2]}` : safeExportName(stripped);
}

function centeredText(x: number, y: number, value: string, color: string, size = 13, weight = 600, maxCharacters = 30) {
  if (value.length > maxCharacters) return centeredMultilineText(x, y, wrapText(value, maxCharacters), color, size, weight, size + 3);
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Inter,Segoe UI,sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="middle" dominant-baseline="middle">${xml(value)}</text>`;
}

function processTitleText(x: number, y: number, value: string, poolWidth: number, fontSize: number) {
  const maxCharacters = Math.max(1, Math.floor((poolWidth - 32) / (fontSize * 0.58)));
  return centeredText(x, y, value, defaultNodeStyles.activity.textColor, fontSize, 700, maxCharacters);
}

function centeredMultilineText(x: number, y: number, lines: string[], color: string, size = 13, weight = 600, lineHeight = 16) {
  if (!lines.length) return "";
  const offset = -((lines.length - 1) * lineHeight) / 2;
  const tspans = lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? offset : lineHeight}">${xml(line)}</tspan>`).join("");
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Inter,Segoe UI,sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="middle" dominant-baseline="middle">${tspans}</text>`;
}

function externalLabel(node: DiagramNode, color: string, appearance: DiagramAppearance) {
  if (!node.label) return "";
  const size = getNodeDimensions(node, appearance);
  const layout = getExternalLabelLayout(node, appearance);
  return centeredMultilineText(node.position.x + size.width / 2, node.position.y + size.height + 7 + (layout.lines.length - 1) * layout.lineHeight / 2, layout.lines, color, appearance.nodeFontSize, 500, layout.lineHeight);
}

function nodeSvg(node: DiagramNode, appearance: DiagramAppearance) {
  const { width, height } = getNodeDimensions(node, appearance);
  const { fill, stroke, textColor: text } = resolveNodeStyle(node);
  const { x, y } = node.position;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  if (node.type === "initial") {
    return `<circle cx="${centerX}" cy="${centerY}" r="19" fill="${fill}" stroke="${stroke}" stroke-width="3"/>${externalLabel(node, text, appearance)}`;
  }
  if (node.type === "final") {
    return `<circle cx="${centerX}" cy="${centerY}" r="19" fill="${fill}" stroke="${stroke}" stroke-width="3"/><circle cx="${centerX}" cy="${centerY}" r="11" fill="${stroke}"/>${externalLabel(node, text, appearance)}`;
  }
  if (node.type === "fork" || node.type === "join") {
    return `<rect x="${x}" y="${y + 5}" width="${width}" height="10" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1"/>${externalLabel(node, text, appearance)}`;
  }
  if (node.type === "decision" || node.type === "merge") {
    const points = `${centerX},${y + 5} ${x + width - 5},${centerY} ${centerX},${y + height - 5} ${x + 5},${centerY}`;
    const label = node.type === "decision" && node.label ? centeredMultilineText(centerX, centerY, getNodeTextLayout(node, appearance).lines, text, appearance.nodeFontSize, 500, appearance.nodeFontSize + 4) : externalLabel(node, text, appearance);
    return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>${label}`;
  }
  if (node.type === "object-in-state") {
    const verticalPadding = Math.max(2, appearance.nodeInnerPadding - 2);
    const lineHeight = appearance.nodeFontSize + 4;
    const maxCharacters = Math.max(1, Math.floor((width - appearance.nodeInnerPadding * 2) / (appearance.nodeFontSize * 0.58)));
    const labelLines = wrapText(node.label, maxCharacters);
    const stateLines = wrapText(`[${node.state ?? ""}]`, maxCharacters);
    const headerHeight = verticalPadding * 2 + labelLines.length * lineHeight;
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="2"/><line x1="${x}" y1="${y + headerHeight}" x2="${x + width}" y2="${y + headerHeight}" stroke="${stroke}"/>${centeredMultilineText(centerX, y + headerHeight / 2, labelLines, text, appearance.nodeFontSize, 600, lineHeight)}${centeredMultilineText(centerX, y + headerHeight + (height - headerHeight) / 2, stateLines, text, appearance.nodeFontSize, 400, lineHeight)}`;
  }
  if (node.type === "constraint" || node.type === "note") {
    const fold = 15;
    const shape = `<path d="M ${x} ${y} H ${x + width - fold} L ${x + width} ${y + fold} V ${y + height} H ${x} Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/><path d="M ${x + width - fold} ${y} V ${y + fold} H ${x + width}" fill="none" stroke="${stroke}"/>`;
    if (node.type === "constraint") {
      return `${shape}${centeredMultilineText(centerX, centerY, getNodeTextLayout(node, appearance).lines, text, appearance.nodeFontSize, 500, appearance.nodeFontSize + 4)}`;
    }
    return `${shape}${centeredMultilineText(centerX, centerY, getNodeTextLayout(node, appearance).lines, text, appearance.nodeFontSize, 500, appearance.nodeFontSize + 4)}`;
  }
  const radius = node.type === "activity" ? 16 : 8;
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>${centeredMultilineText(centerX, centerY, getNodeTextLayout(node, appearance).lines, text, appearance.nodeFontSize, 600, appearance.nodeFontSize + 4)}`;
}

export function diagramToSvg(document: DiagramDocument, transparentBackground: boolean) {
  assertExportGeometry(document);
  const padding = 48;
  const flat = flattenProcesses(document);
  const extents = flat.nodes.map((node) => {
    const { width, height } = getNodeDimensions(node, document.appearance);
    const external = node.label && ["initial", "final", "fork", "join", "merge"].includes(node.type)
      ? 7 + getExternalLabelLayout(node, document.appearance).lines.length * getExternalLabelLayout(node, document.appearance).lineHeight
      : 0;
    return { left: node.position.x, top: node.position.y, right: node.position.x + width, bottom: node.position.y + height + external };
  });
  for (const process of document.processes) {
    const pool = getSwimlanePoolGeometry(process, document.appearance);
    extents.push({ left: pool.x, top: pool.y, right: pool.x + pool.width, bottom: pool.y + pool.height });
  }
  const left = Math.min(0, ...extents.map((entry) => entry.left)) - padding;
  const top = Math.min(0, ...extents.map((entry) => entry.top)) - padding;
  const right = Math.max(640, ...extents.map((entry) => entry.right)) + padding;
  const bottom = Math.max(420, ...extents.map((entry) => entry.bottom)) + padding;
  const routes = routeAll(flat.nodes, flat.edges, document.appearance);
  const pools = document.processes.map((process) => {
    const pool = getSwimlanePoolGeometry(process, document.appearance);
    const titleFill = "#fbfcfd";
    let laneX = pool.x;
    const laneFills = process.lanes.map((lane) => {
      const fill = lane.style?.fill ?? "#ffffff";
      const value = `<rect x="${laneX}" y="${pool.laneY}" width="${lane.width}" height="${pool.laneHeight}" fill="${fill}"/>`;
      laneX += lane.width; return value;
    }).join("");
    laneX = pool.x;
    const laneLabels = process.lanes.map((lane) => {
      const value = centeredText(laneX + lane.width / 2, pool.laneY + 20, lane.name, lane.style?.textColor ?? "#5f6b77", document.appearance.nodeFontSize, 700);
      laneX += lane.width; return value;
    }).join("");
    const stroke = process.lanes.find((lane) => lane.style?.stroke)?.style?.stroke ?? "#6e7977";
    const separators = pool.separatorXs.map((x) => `<line class="swimlane-separator" x1="${x}" y1="${pool.laneY}" x2="${x}" y2="${pool.y + pool.height}" stroke="${stroke}" stroke-dasharray="4 4"/>`).join("");
    const empty = process.lanes.length ? "" : centeredText(pool.x + pool.width / 2, pool.y + pool.titleHeight + 24, "Add a swimlane", "#6e7977", 11, 400);
    return `<g data-process-id="${xml(process.id)}"><rect class="swimlane-title-row" x="${pool.x}" y="${pool.y}" width="${pool.width}" height="${pool.titleHeight}" fill="${titleFill}"/>${laneFills}<rect class="swimlane-pool-outline" x="${pool.x}" y="${pool.y}" width="${pool.width}" height="${pool.height}" fill="none" stroke="${stroke}"/><line class="swimlane-title-rule" x1="${pool.x}" y1="${pool.laneY}" x2="${pool.x + pool.width}" y2="${pool.laneY}" stroke="${stroke}"/>${separators}${processTitleText(pool.x + pool.width / 2, pool.y + pool.titleHeight / 2, process.name, pool.width, document.appearance.nodeFontSize)}${laneLabels}${empty}</g>`;
  }).join("");
  const markers = flat.edges.map((edge, index) => {
    const color = resolveEdgeColor(edge);
    return `<marker id="arrow-${index}" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L0,6 L9,3 z" fill="${color}"/></marker>`;
  }).join("");
  const edges = flat.edges.map((edge, index) => {
    const points = routes[edge.id] ?? [];
    const color = resolveEdgeColor(edge);
    const width = edge.style?.width ?? 1.5;
    const dash = edge.style?.dash === "dotted" ? "2 5" : edge.style?.dash === "dashed" || (!edge.style?.dash && edge.type === "object-flow") ? "7 5" : "";
    const guardPoint = guardLabelPoint(points, edge.guardLabel, document.appearance.nodeFontSize);
    const guard = edge.guardLabel ? centeredText(guardPoint.x, guardPoint.y, edge.guardLabel, color, document.appearance.nodeFontSize, 500) : "";
    const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
    const halo = `<polyline class="edge-halo" points="${polylinePoints}" fill="none" stroke="${document.appearance.canvasColor}" stroke-width="${width + 4}" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `${halo}<polyline points="${polylinePoints}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${dash ? `stroke-dasharray="${dash}"` : ""} marker-end="url(#arrow-${index})"/>${guard}`;
  }).join("");
  const background = transparentBackground ? "" : `<rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="${document.appearance.canvasColor}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${right - left}" height="${bottom - top}" viewBox="${left} ${top} ${right - left} ${bottom - top}"><defs>${markers}</defs>${background}${pools}${edges}${flat.nodes.map((node) => nodeSvg(node, document.appearance)).join("")}</svg>`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function svgToPngBlob(svg: string, scale: 1 | 2 | 3 = 1): Promise<Blob> {
  const size = svg.match(/<svg[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/);
  const width = Number(size?.[1] ?? 0) * scale;
  const height = Number(size?.[2] ?? 0) * scale;
  if (!width || !height) throw new Error("Could not determine diagram dimensions");
  if (width > 16_384 || height > 16_384 || width * height > 268_435_456) {
    throw new Error("PNG at the selected scale is too large for this browser. Choose a lower PNG quality or export SVG.");
  }
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not render the diagram image"));
      image.src = url;
    });
    const canvas = window.document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas export is not supported by this browser");
    context.scale(scale, scale);
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not encode PNG")), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportDiagramImage(document: DiagramDocument, format: "svg" | "png", preferences: ExportPreferences, filenameBase?: string) {
  if (document.processes.length !== 1) throw new Error("Image export supports exactly one process.");
  assertExportGeometry(document);
  const svg = diagramToSvg(document, preferences.transparentBackground);
  const base = filenameBase === undefined
    ? safeExportName(document.metadata.title)
    : safeSuppliedExportName(filenameBase);
  if (format === "svg") {
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${base}.svg`);
    return;
  }
  const blob = await svgToPngBlob(svg, preferences.imageScale);
  downloadBlob(blob, `${base}.png`);
}
