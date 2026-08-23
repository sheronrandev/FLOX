export interface ExportPreferences {
  transparentBackground: boolean;
  imageScale: 1 | 2 | 3;
  defaultFormat: "png" | "svg";
}

export const defaultExportPreferences: ExportPreferences = {
  transparentBackground: false,
  imageScale: 2,
  defaultFormat: "png",
};

export function parseExportPreferences(value: unknown): ExportPreferences {
  if (!value || typeof value !== "object") return defaultExportPreferences;
  const candidate = value as Partial<ExportPreferences>;
  return {
    transparentBackground: candidate.transparentBackground === true,
    imageScale: candidate.imageScale === 1 || candidate.imageScale === 3 ? candidate.imageScale : 2,
    defaultFormat: candidate.defaultFormat === "svg" ? "svg" : "png",
  };
}
