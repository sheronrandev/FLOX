import type { DiagramNode, DiagramNodeStyle, DiagramNodeType } from "./diagram";

export interface NodeDimensions {
  width: number;
  height: number;
}

export interface TextLayout {
  width: number;
  height: number;
  lines: string[];
  lineHeight: number;
}

export interface NodeLayoutSettings {
  nodeFontSize?: number;
  processNameFontSize?: number;
  nodeInnerPadding?: number;
}

export const UML_NODE_MAX_WIDTH = 240;
export const UML_NODE_HORIZONTAL_PADDING = 24;
export const UML_NODE_VERTICAL_PADDING = 20;
export const UML_NODE_LINE_HEIGHT = 16;
export const UML_EXTERNAL_LABEL_MAX_WIDTH = 140;
export const DEFAULT_NODE_FONT_SIZE = 12;
export const DEFAULT_NODE_INNER_PADDING = 12;
const DEFAULT_NODE_VERTICAL_PADDING = 10;

export const nodeDimensions: Record<DiagramNodeType, NodeDimensions> = {
  activity: { width: 160, height: 64 },
  state: { width: 160, height: 64 },
  "object-in-state": { width: 150, height: 76 },
  decision: { width: 72, height: 72 },
  merge: { width: 72, height: 72 },
  fork: { width: 150, height: 20 },
  join: { width: 150, height: 20 },
  initial: { width: 42, height: 42 },
  final: { width: 42, height: 42 },
  constraint: { width: 160, height: 90 },
  note: { width: 160, height: 90 },
};

const fixedGeometryTypes = new Set<DiagramNodeType>(["initial", "final", "decision", "merge", "fork", "join"]);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function wrapText(value: string, maxCharacters: number): string[] {
  if (!value) return [""];
  return value.split(/\r?\n/).flatMap((paragraph) => {
    if (!paragraph) return [""];
    const words = paragraph.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      if (word.length > maxCharacters) {
        if (current) { lines.push(current); current = ""; }
        for (let index = 0; index < word.length; index += maxCharacters) lines.push(word.slice(index, index + maxCharacters));
        continue;
      }
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxCharacters) {
        lines.push(current);
        current = word;
      } else current = candidate;
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  });
}

function resolvedSettings(settings?: NodeLayoutSettings) {
  const fontSize = settings?.nodeFontSize ?? DEFAULT_NODE_FONT_SIZE;
  const innerPadding = settings?.nodeInnerPadding ?? DEFAULT_NODE_INNER_PADDING;
  return {
    fontSize,
    innerPadding,
    verticalPadding: Math.max(2, DEFAULT_NODE_VERTICAL_PADDING + innerPadding - DEFAULT_NODE_INNER_PADDING),
    lineHeight: fontSize + 4,
    estimatedCharacterWidth: fontSize * 7 / DEFAULT_NODE_FONT_SIZE,
  };
}

function textValues(node: DiagramNode): string[] {
  if (node.type === "object-in-state") return [node.label, `[${node.state ?? ""}]`];
  if (node.type === "constraint") return ["«invariant»", node.label, node.body ?? ""];
  return [node.label];
}

function contentLines(node: DiagramNode, maxCharacters: number): string[] {
  return textValues(node).flatMap((value) => wrapText(value, maxCharacters));
}

export function getNodeTextLayout(node: DiagramNode, settings?: NodeLayoutSettings): TextLayout {
  const base = nodeDimensions[node.type];
  const resolved = resolvedSettings(settings);
  const externalCharacters = Math.max(1, Math.floor(UML_EXTERNAL_LABEL_MAX_WIDTH / resolved.estimatedCharacterWidth));
  if (fixedGeometryTypes.has(node.type)) return { width: base.width, height: base.height, lines: node.label ? wrapText(node.label, externalCharacters) : [], lineHeight: resolved.lineHeight };
  const minimumWidth = Math.max(96, base.width + (resolved.innerPadding - DEFAULT_NODE_INNER_PADDING) * 2);
  const minimumHeight = Math.max(36, base.height + (resolved.verticalPadding - DEFAULT_NODE_VERTICAL_PADDING) * 2);
  const longestValue = Math.max(0, ...textValues(node).map((value) => value.split(/\r?\n/).reduce((length, line) => Math.max(length, line.length), 0)));
  const width = clamp(Math.max(minimumWidth, longestValue * resolved.estimatedCharacterWidth + resolved.innerPadding * 2), minimumWidth, UML_NODE_MAX_WIDTH);
  const maxCharacters = Math.max(1, Math.floor((width - resolved.innerPadding * 2) / resolved.estimatedCharacterWidth));
  const lines = contentLines(node, maxCharacters);
  let height = minimumHeight;
  if (node.type === "object-in-state") height = Math.max(height, resolved.verticalPadding * 2 + lines.length * resolved.lineHeight + 8);
  else if (node.type === "constraint") height = Math.max(height, resolved.verticalPadding * 2 + resolved.lineHeight + lines.slice(1).length * resolved.lineHeight + 16);
  else height = Math.max(height, resolved.verticalPadding * 2 + lines.length * resolved.lineHeight);
  return { width, height, lines, lineHeight: resolved.lineHeight };
}

export function getNodeDimensions(node: DiagramNode, settings?: NodeLayoutSettings): NodeDimensions {
  const layout = getNodeTextLayout(node, settings);
  return { width: layout.width, height: layout.height };
}

export function getExternalLabelLayout(node: DiagramNode, settings?: NodeLayoutSettings): TextLayout {
  const base = nodeDimensions[node.type];
  const resolved = resolvedSettings(settings);
  const lines = wrapText(node.label, Math.max(1, Math.floor(UML_EXTERNAL_LABEL_MAX_WIDTH / resolved.estimatedCharacterWidth)));
  return { width: base.width, height: base.height, lines: node.label ? lines : [], lineHeight: resolved.lineHeight };
}

export const defaultLabels: Record<DiagramNodeType, string> = {
  activity: "New activity",
  state: "New state",
  "object-in-state": "Object",
  decision: "",
  merge: "",
  fork: "",
  join: "",
  initial: "",
  final: "",
  constraint: "Constraint",
  note: "Note",
};

export const defaultNodeStyles: Record<DiagramNodeType, Required<DiagramNodeStyle>> = {
  activity: { fill: "#ffffff", stroke: "#000000", textColor: "#000000" },
  state: { fill: "#ffffff", stroke: "#000000", textColor: "#000000" },
  "object-in-state": { fill: "#ffffff", stroke: "#000000", textColor: "#000000" },
  decision: { fill: "#ffffff", stroke: "#000000", textColor: "#000000" },
  merge: { fill: "#ffffff", stroke: "#000000", textColor: "#000000" },
  fork: { fill: "#000000", stroke: "#000000", textColor: "#000000" },
  join: { fill: "#000000", stroke: "#000000", textColor: "#000000" },
  initial: { fill: "#000000", stroke: "#000000", textColor: "#000000" },
  final: { fill: "#ffffff", stroke: "#000000", textColor: "#000000" },
  constraint: { fill: "#ffffff", stroke: "#000000", textColor: "#000000" },
  note: { fill: "#ffffff", stroke: "#000000", textColor: "#000000" },
};

export function resolveNodeStyle(node: Pick<DiagramNode, "type" | "style">): Required<DiagramNodeStyle> {
  const defaults = defaultNodeStyles[node.type];
  return {
    fill: node.style?.fill ?? defaults.fill,
    stroke: node.style?.stroke ?? defaults.stroke,
    textColor: node.style?.textColor ?? defaults.textColor,
  };
}
