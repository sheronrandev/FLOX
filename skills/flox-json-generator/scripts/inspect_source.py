"""Profile common structured data sources before mapping them to FLOX diagrams."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


def text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def summarize_rows(headers: list[str], rows: list[list[Any]], sample_size: int) -> dict[str, Any]:
    samples = [dict(zip(headers, [text(value) for value in row], strict=False)) for row in rows[:sample_size]]
    return {
        "rowCount": len(rows),
        "columnCount": len(headers),
        "headers": headers,
        "sampleRows": samples,
        "nonEmptyCounts": {
            header: sum(1 for row in rows if index < len(row) and text(row[index]))
            for index, header in enumerate(headers)
        },
    }


def inspect_workbook(path: Path, sample_size: int) -> dict[str, Any]:
    try:
        import openpyxl
    except ImportError as error:
        raise RuntimeError("XLSX inspection requires openpyxl") from error
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheets: dict[str, Any] = {}
    for sheet in workbook.worksheets:
        values = list(sheet.iter_rows(values_only=True))
        if not values:
            sheets[sheet.title] = {"rowCount": 0, "columnCount": 0, "headers": [], "sampleRows": []}
            continue
        headers = [text(value) or f"column_{index + 1}" for index, value in enumerate(values[0])]
        rows = [list(row) for row in values[1:] if any(value is not None for value in row)]
        sheets[sheet.title] = summarize_rows(headers, rows, sample_size)
    return {"kind": "workbook", "sheets": sheets}


def inspect_delimited(path: Path, sample_size: int) -> dict[str, Any]:
    content = path.read_text(encoding="utf-8-sig")
    dialect = csv.Sniffer().sniff(content[:8192], delimiters=",\t;|")
    parsed = list(csv.reader(content.splitlines(), dialect))
    if not parsed:
        return {"kind": "delimited", "delimiter": dialect.delimiter, "rowCount": 0, "headers": []}
    headers = [text(value) or f"column_{index + 1}" for index, value in enumerate(parsed[0])]
    return {"kind": "delimited", "delimiter": dialect.delimiter, **summarize_rows(headers, parsed[1:], sample_size)}


def json_shape(value: Any, depth: int = 0) -> Any:
    if depth >= 4:
        return type(value).__name__
    if isinstance(value, dict):
        return {str(key): json_shape(item, depth + 1) for key, item in list(value.items())[:30]}
    if isinstance(value, list):
        return {"type": "array", "length": len(value), "itemShape": json_shape(value[0], depth + 1) if value else None}
    return type(value).__name__


def inspect_json(path: Path, sample_size: int) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    sample = value[:sample_size] if isinstance(value, list) else value
    return {"kind": "json", "shape": json_shape(value), "sample": sample}


def inspect_plain_text(path: Path, sample_size: int) -> dict[str, Any]:
    lines = path.read_text(encoding="utf-8-sig", errors="replace").splitlines()
    non_empty = [line.strip() for line in lines if line.strip()]
    return {"kind": "text", "lineCount": len(lines), "nonEmptyLineCount": len(non_empty), "sampleLines": non_empty[:sample_size]}


def inspect(path: Path, sample_size: int) -> dict[str, Any]:
    suffix = path.suffix.lower()
    if suffix in {".xlsx", ".xlsm"}:
        details = inspect_workbook(path, sample_size)
    elif suffix in {".csv", ".tsv"}:
        details = inspect_delimited(path, sample_size)
    elif suffix == ".json":
        details = inspect_json(path, sample_size)
    elif suffix in {".txt", ".md"}:
        details = inspect_plain_text(path, sample_size)
    else:
        raise ValueError(f"Unsupported source extension {suffix}; use the relevant PDF, document, or image skill")
    return {"path": str(path.resolve()), "sizeBytes": path.stat().st_size, **details}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--sample-size", type=int, default=5)
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args()
    if not arguments.source.is_file():
        raise FileNotFoundError(arguments.source)
    result = json.dumps(inspect(arguments.source, max(1, arguments.sample_size)), ensure_ascii=False, indent=2)
    if arguments.output:
        arguments.output.write_text(result + "\n", encoding="utf-8")
    else:
        print(result)


if __name__ == "__main__":
    main()
