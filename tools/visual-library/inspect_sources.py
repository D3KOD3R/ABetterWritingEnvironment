"""Read-only production discovery; write review evidence outside the source tree.

Requires Pillow and PyMuPDF. XLSX is read directly to retain sheet/cell provenance
without installing a spreadsheet application or evaluating workbook formulas.
"""
import argparse
import hashlib
import json
from pathlib import Path
import textwrap
import xml.etree.ElementTree as ET
import zipfile

import fitz
from PIL import Image, ImageDraw, ImageFont, ImageOps


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def workbook(path):
    ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(path) as z:
        strings = []
        if "xl/sharedStrings.xml" in z.namelist():
            for item in ET.fromstring(z.read("xl/sharedStrings.xml")):
                strings.append("".join(item.itertext()))
        rels = {r.attrib["Id"]: r.attrib["Target"] for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
        result = []
        for sheet in ET.fromstring(z.read("xl/workbook.xml")).findall("s:sheets/s:sheet", ns):
            rel = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            target = rels[rel]
            target = target.lstrip("/") if target.startswith("/") else "xl/" + target
            root = ET.fromstring(z.read(target))
            rows = []
            for row in root.findall("s:sheetData/s:row", ns):
                cells = {}
                for cell in row:
                    kind = cell.get("t")
                    value = cell.find("s:v", ns)
                    text = value.text if value is not None else ""
                    if kind == "s" and text:
                        text = strings[int(text)]
                    elif kind == "inlineStr":
                        text = "".join(t.text or "" for t in cell.findall(".//s:t", ns))
                    if text:
                        cells[cell.get("r")] = text
                    formula = cell.find("s:f", ns)
                    if formula is not None:
                        cells[cell.get("r") + ":formula"] = formula.text
                if cells:
                    rows.append({"row": int(row.get("r")), "cells": cells})
            result.append({"name": sheet.get("name"), "state": sheet.get("state", "visible"), "rows": rows})
        return {"sheets": result, "embeddedMedia": [n for n in z.namelist() if n.startswith("xl/media/")]}


def contact_sheets(items, output, prefix="contact"):
    font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 16)
    for offset in range(0, len(items), 12):
        canvas = Image.new("RGB", (1600, 1440), "#e6e6e6")
        draw = ImageDraw.Draw(canvas)
        for slot, item in enumerate(items[offset:offset + 12]):
            x, y = (slot % 4) * 400, (slot // 4) * 480
            with Image.open(output / item["preview"]) as image:
                thumb = ImageOps.contain(image.convert("RGB"), (390, 390))
                canvas.paste(thumb, (x + (400 - thumb.width) // 2, y))
            label = f'{item["reviewKey"]} | {item["sourceRelativePath"]}'
            if "page" in item:
                label += f' | page {item["page"]}'
            draw.text((x + 8, y + 394), "\n".join(textwrap.wrap(label, 45)[:4]), fill="black", font=font)
        canvas.save(output / f"{prefix}-{offset // 12 + 1:02}.jpg", quality=92)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    worktree = Path(__file__).resolve().parents[2]
    if output == source or source in output.parents or output == worktree or worktree in output.parents:
        raise ValueError("Evidence must be outside production sources and the worktree")
    output.mkdir(parents=True, exist_ok=True)
    (output / "previews").mkdir(exist_ok=True)
    (output / "extracted").mkdir(exist_ok=True)
    files, images, pdfs, reviews = [], [], [], []
    # Stable file hashes make duplicate detection independent of source spelling.
    for path in sorted(source.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(source).as_posix()
        record = {"sourceRelativePath": relative, "sizeBytes": path.stat().st_size, "sha256": digest(path), "extension": path.suffix.lower()}
        files.append(record)
        if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".tif", ".tiff", ".bmp"}:
            key = f"I{len(images) + 1:03}"
            with Image.open(path) as img:
                entry = {**record, "reviewKey": key, "width": img.width, "height": img.height, "format": img.format, "mode": img.mode, "preview": f"previews/{key}.jpg"}
                preview = ImageOps.contain(ImageOps.exif_transpose(img).convert("RGB"), (1400, 1400))
                preview.save(output / entry["preview"], quality=92)
            images.append(entry)
            reviews.append(entry)
        elif path.suffix.lower() == ".pdf":
            doc = fitz.open(path)
            pages = []
            for page_index, page in enumerate(doc):
                key = f"P{len(pdfs) + 1:02}-{page_index + 1:02}"
                preview = f"previews/{key}.png"
                # Tall drawing canvases can exceed 170 MP at ordinary PDF DPI.
                # Bound the review raster; the untouched PDF remains the source.
                scale = min(2, 2400 / max(page.rect.width, page.rect.height))
                page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False).save(output / preview)
                embedded = []
                for item in page.get_images(full=True):
                    xref = item[0]
                    data = doc.extract_image(xref)
                    target = output / "extracted" / f'{record["sha256"][:16]}-xref-{xref}.{data["ext"]}'
                    if not target.exists():
                        target.write_bytes(data["image"])
                    embedded.append({"xref": xref, "softMaskXref": item[1], "width": data["width"], "height": data["height"], "format": data["ext"], "sha256": digest(target), "extractedPath": target.relative_to(output).as_posix()})
                entry = {"reviewKey": key, "sourceRelativePath": relative, "sourceSha256": record["sha256"], "page": page_index + 1, "preview": preview, "text": page.get_text(), "embeddedImages": embedded}
                pages.append(entry)
                reviews.append(entry)
            pdfs.append({**record, "pageCount": len(doc), "pages": pages})
            doc.close()
        elif path.suffix.lower() == ".xlsx":
            data = workbook(path)
            write_json(output / "workbook.json", data)
            lines = []
            for sheet in data["sheets"]:
                lines.append(f'\n## {sheet["name"]} ({sheet["state"]})')
                for row in sheet["rows"]:
                    lines.append(" | ".join(f"{k}: {v}" for k, v in row["cells"].items()))
            (output / "workbook.txt").write_text("\n".join(lines), encoding="utf-8")
    write_json(output / "discovery.json", {"files": files, "images": images, "pdfs": pdfs})
    contact_sheets(reviews, output)
    # Review native embedded resources separately from composited PDF pages.
    # Soft masks remain provenance; raw extraction is not a faithful composite.
    embedded, seen = [], set()
    for pdf in pdfs:
        for page in pdf["pages"]:
            for item in page["embeddedImages"]:
                if item["sha256"] in seen:
                    continue
                seen.add(item["sha256"])
                key = f"E{len(embedded) + 1:03}"
                entry = {**item, "reviewKey": key, "sourceRelativePath": pdf["sourceRelativePath"], "page": page["page"], "preview": item["extractedPath"]}
                embedded.append(entry)
    write_json(output / "embedded-review.json", embedded)
    contact_sheets(embedded, output, prefix="embedded")
    print(json.dumps({"files": len(files), "images": len(images), "pdfs": len(pdfs), "pdfPages": sum(p["pageCount"] for p in pdfs), "reviewSheets": (len(reviews) + 11) // 12}))


if __name__ == "__main__":
    main()
