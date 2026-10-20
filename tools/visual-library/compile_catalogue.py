"""Compile reviewed local evidence into an import plan and derived catalogues.

No subject is guessed from a filename: review-notes.json is an explicit human/agent
visual-review input. This tool never writes project.json or changes production files.
The package builder registers these records with the application's real serializer.
"""
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import json
from pathlib import Path
import re
import uuid

import fitz
from PIL import Image, ImageOps

from inspect_sources import digest, write_json


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def numbers(value):
    # Workbook refs mix comma-separated numbers, ranges and conditional prose.
    found = set()
    for match in re.finditer(r"(?<![A-Za-z0-9])(\d{1,2})(?:[–-](\d{1,2}))?(?!\d)", str(value)):
        first, last = int(match[1]), int(match[2] or match[1])
        found.update(n for n in range(first, last + 1) if 1 <= n <= 29)
    return sorted(found)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--inspection", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--comparison", type=Path, required=True)
    args = parser.parse_args()
    root, evidence = args.source.resolve(), args.inspection.resolve()
    worktree = Path(__file__).resolve().parents[2]
    if evidence == root or root in evidence.parents or evidence == worktree or worktree in evidence.parents:
        raise ValueError("Inspection and catalogue outputs must be outside production and the worktree")
    discovery, review = read(evidence / "discovery.json"), read(evidence / "review-notes.json")
    # Review labels are local sequence keys, not identity. Reject stale annotations
    # if another discovery changes their ordering or the underlying source bytes.
    if review.get("reviewedDiscoverySha256") != digest(evidence / "discovery.json"):
        raise ValueError("Review notes must bind reviewedDiscoverySha256 to the inspected discovery.json")
    for source in discovery["files"]:
        if digest(root / source["sourceRelativePath"]) != source["sha256"]:
            raise ValueError(f"Source changed since visual review: {source['sourceRelativePath']}")
    workbook = read(evidence / "workbook.json")
    baseline, comparison = read(args.baseline)["projects"][0], read(args.comparison)["projects"][0]
    entities = baseline["workspace"]["world"]["entities"]
    by_name = {e["name"]: e["id"] for e in entities}
    scenes = {}

    def walk(node):
        if node.get("kind") == "scene":
            scenes[node["refId"]] = node["title"]
        for child in node.get("children", []):
            walk(child)
    walk(baseline["workspace"]["project"]["binder"])
    metadata = evidence / "catalogue"
    metadata.mkdir(exist_ok=True)
    derivatives = evidence / "derivatives"
    derivatives.mkdir(exist_ok=True)
    identities_path = evidence / "identities.json"
    identities = read(identities_path) if identities_path.exists() else {}
    assets, hashes, plan, page_records, occurrences = [], {}, [], [], []
    source_hashes = {f["sourceRelativePath"]: f["sha256"] for f in discovery["files"]}

    def add(item, classification, physical, origin, selected):
        group, description, *overrides = classification
        info = {**review["groups"][group], **(overrides[0] if overrides else {})}
        provenance = {
            "rootAliasId": "production-art",
            "relativePath": item["sourceRelativePath"],
            "originalFilename": Path(item["sourceRelativePath"]).name,
            "sourceSha256": source_hashes[item["sourceRelativePath"]],
            "kind": origin,
            "reviewKey": item["reviewKey"],
            **{k: item[k] for k in ["page", "xref", "softMaskXref"] if k in item},
        }
        if info.get("exclude"):
            occurrences.append({**provenance, "disposition": "excluded-structural-or-blank", "description": description})
            return
        sha = digest(physical)
        if sha in hashes:
            existing = hashes[sha]
            existing["metadata"]["sources"].append(provenance)
            occurrences.append({**provenance, "assetId": existing["id"], "disposition": "duplicate-bytes"})
            return
        # Allocate UUID once; registry identity survives rename and future reclassification.
        identity_key = "sha256:" + sha
        asset_id = identities.setdefault(identity_key, "asset-" + str(uuid.uuid4()))
        with Image.open(physical) as image:
            width, height, fmt, mode = image.width, image.height, image.format, image.mode
            thumb = ImageOps.contain(ImageOps.exif_transpose(image).convert("RGB"), (512, 512))
            thumb_path = derivatives / (asset_id + ".jpg")
            thumb.save(thumb_path, quality=86)
        ext = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}.get(fmt, physical.suffix.lstrip("."))
        managed = selected and not info.get("external", False)
        # Neutral stable filenames avoid encoding an uncertain fictional identity.
        file_ref = f"assets/images/originals/SV_ASSET_{asset_id[6:]}.{ext}" if managed else ""
        locator = {"kind": "project-owned", "relativePath": file_ref} if managed else {
            "kind": "external-folder" if origin == "file" else "pdf-embedded",
            "rootAliasId": "production-art", "relativePath": item["sourceRelativePath"],
            **{k: item[k] for k in ["page", "xref", "softMaskXref"] if k in item},
        }
        entity_ids = [by_name[name] for name in info["entityNames"] if name in by_name]
        scene_ids = [f"scene-{n:04}" for n in info["sceneNumbers"] if f"scene-{n:04}" in scenes]
        meta = {
            "catalogueSchemaVersion": 1, "title": info["subject"], "description": description,
            "category": info["category"], "subject": info["subject"], "status": "reference" if info["provenance"] == "reference" else "concept",
            "canonStatus": "not-approved", "confidence": info["confidence"],
            "entityIds": entity_ids, "sceneIds": scene_ids,
            "associationBasis": "Reviewed design reference; scene suitability is proposed, not a claim the image depicts that scene.",
            "visualState": info["state"], "artisticStyle": info["style"], "notes": info["notes"],
            "originAssessment": info["provenance"], "creator": None, "licence": "unverified",
            "sha256": sha, "width": width, "height": height, "format": fmt, "mode": mode,
            "sizeBytes": physical.stat().st_size, "locator": locator,
            "thumbnailRelativePath": f"cache/visual-previews/{asset_id}.jpg",
            "reviewStatus": "needs-author-review", "reviewDate": review["reviewDate"],
            "reviewMethod": review["method"], "sources": [provenance],
            "relatedGroup": group, "requirementIds": info["requirements"],
        }
        record = {"id": asset_id, "kind": "image", "role": info["category"], "fileRef": file_ref, "path": file_ref, "metadata": meta}
        assets.append(record)
        hashes[sha] = record
        plan.append({"assetId": asset_id, "sourcePath": str(physical), "copy": managed, "thumbnailSourcePath": str(thumb_path)})
        occurrences.append({**provenance, "assetId": asset_id, "disposition": "import" if managed else "external-reference"})

    # Preserve exact original bytes for selected raster files; external photos stay external.
    for item in discovery["images"]:
        add(item, review["images"][item["reviewKey"]], root / item["sourceRelativePath"], "file", True)
    embedded = read(evidence / "embedded-review.json")
    for item in embedded:
        classification = review["embedded"][item["reviewKey"]]
        selected = len(classification) > 2 and classification[2].get("select", False)
        add(item, classification, evidence / item["extractedPath"], "pdf-embedded", selected)
    # Rasterize the full composited page to retain handwriting, vector marks and masks.
    # At most 4096 px on the long edge; never silently call this a native embedded image.
    for pdf in discovery["pdfs"]:
        doc = fitz.open(root / pdf["sourceRelativePath"])
        for item in pdf["pages"]:
            classification = review["pages"][item["reviewKey"]]
            if len(classification) > 2 and classification[2].get("exclude"):
                occurrences.append({"reviewKey": item["reviewKey"], "rootAliasId": "production-art", "relativePath": item["sourceRelativePath"], "page": item["page"], "disposition": "excluded-blank", "description": classification[1]})
                page_records.append({**item, "disposition": "blank"})
                continue
            pg = doc[item["page"] - 1]
            scale = min(4, 4096 / max(pg.rect.width, pg.rect.height))
            path = derivatives / (item["reviewKey"] + ".png")
            pix = pg.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
            pix.save(path)
            page_records.append({**item, "renderSha256": digest(path), "renderWidth": pix.width, "renderHeight": pix.height, "renderScale": scale, "disposition": "reviewed"})
            add(item, classification, path, "pdf-page-render", True)
        doc.close()
    write_json(identities_path, identities)
    write_json(evidence / "import-plan.json", {"assets": assets, "files": plan})

    # Workbook rows are preserved whole; indexes point into the one asset registry.
    tables = {}
    for sheet in workbook["sheets"]:
        headers = next((r["cells"] for r in sheet["rows"] if r["row"] == 4), {})
        headers = {re.sub(r"\d+$", "", k): v for k, v in headers.items()}
        rows = []
        for row in sheet["rows"]:
            if row["row"] < 5:
                continue
            fields = {headers.get(re.sub(r"\d+$", "", k), k): v for k, v in row["cells"].items()}
            rows.append({"row": row["row"], "fields": fields, "source": {"rootAliasId": "production-art", "relativePath": "Project_Serva_Vitae_World_Art_Design_Bible.xlsx", "sheet": sheet["name"], "row": row["row"]}})
        tables[sheet["name"]] = rows
    write_json(metadata / "workbook-records.json", {"sourceStatus": "Production proposal based on older snapshot, not manuscript canon", "tables": tables, "rawWorkbook": workbook})
    associations = defaultdict(list)
    for asset in assets:
        for req_id in asset["metadata"]["requirementIds"]:
            associations[req_id].append(asset["id"])
    char_names = [
        "John Walker", "Shai Siante", "Tao Vang", "Tex Kovachnikov",
        "Ava Meerakavita (Lady Meera)", "Marcellus Athos", "G Wolfgang", None,
        "Nova Serra", "Professor Julie Henderson", "Tor Engineer", "XA24795", None,
    ]
    character_ids = {f"CH{i+1:02}": by_name.get(name) for i, name in enumerate(char_names)}
    state_prefix = dict(zip(["JW", "SS", "TV", "TX", "AM", "MA", "GW", "TB", "NS", "JH", "TE", "XA", "AI"], [f"CH{i+1:02}" for i in range(13)]))
    requirements = []
    sheet_specs = [
        ("CHARACTER BIBLE", "ID", "Character", "character", None),
        ("COSTUME DESIGN", "Look ID", "Character", "visual-state", "Linked scenes"),
        ("SET DESIGN", "Set ID", "Set / environment", "environment", "Scenes"),
        ("PROPS & TECH", "Prop ID", "Asset", "technology", "Scene refs"),
        ("SCENE DESIGN", "Scene", "Scene title", "scene", "Scene"),
    ]
    for sheet_name, id_field, title_field, kind, scene_field in sheet_specs:
        for row in tables[sheet_name]:
            fields = row["fields"]
            req_id = fields[id_field]
            if kind == "scene":
                req_id = f"SCENE-{int(req_id):04}"
            entity_id = character_ids.get(req_id) if kind == "character" else character_ids.get(state_prefix.get(req_id.split("-")[0], ""))
            scene_ids = [f"scene-{n:04}" for n in numbers(fields.get(scene_field, ""))] if scene_field else []
            phase = fields.get("Wardrobe phase", fields.get("Relative chronology", fields.get("Era / function", "Unfixed; see source")))
            refs = associations[req_id]
            if kind == "scene":
                refs = [a["id"] for a in assets if set(scene_ids) & set(a["metadata"]["sceneIds"])]
            requirements.append({
                "id": req_id, "kind": kind, "title": fields[title_field], "worldEntityIds": [entity_id] if entity_id else [],
                "sceneIds": scene_ids, "narrativePeriod": phase, "source": row["source"], "designFields": fields,
                "existingReferenceAssetIds": refs, "approvedAssetIds": [],
                "coverage": "partial-reference-needs-review" if refs else "missing",
                "sceneKeyframeStatus": "missing" if kind == "scene" else None,
                "requiredImages": ["Scene keyframe and staging geography"] if kind == "scene" else ["Identity / silhouette reference", "Relevant views and state variations"],
                "missingImages": ["Approved scene-specific keyframe"] if kind == "scene" else ["Approved production reference and required variations"],
                "priority": fields.get("Production priority", fields.get("Art priority", "Hero" if kind == "character" else "Secondary")),
                "nextAction": "Review existing references against all constraints before generating variants." if refs else "Resolve linked design questions, then create concept references.",
            })
    # World coverage includes entities absent from the workbook (including placeholders).
    for entity in entities:
        refs = [a["id"] for a in assets if entity["id"] in a["metadata"]["entityIds"]]
        requirements.append({"id": "WORLD-" + entity["id"], "kind": entity.get("templateName", "entity").lower(), "title": entity["name"], "worldEntityIds": [entity["id"]], "sceneIds": [],
            "source": {"rootAliasId": "baseline-project", "relativePath": args.baseline.name, "entityId": entity["id"]},
            "designConstraints": entity.get("notes", ""), "existingReferenceAssetIds": refs, "approvedAssetIds": [],
            "coverage": "partial-reference-needs-review" if refs else "missing",
            "priority": "Secondary", "requiredImages": ["Identity/silhouette and scale sheet"], "missingImages": ["Approved identity and variations"],
            "narrativePeriod": "See source notes; no invented dates", "nextAction": "Clarify placeholder entities before generation." if entity["name"] in ["Station", "Weapon", "Creature", "Tempest", "Psycho Fungus"] else "Review source identity and existing art; plan missing views."})
    for req_id, title in [("SHIP-BEVERLY", "Beverly"), ("SHIP-GREY", "Grey Class"), ("PRODUCTION-STORMRAY", "StormRay"), ("PRODUCTION-IRIS", "The Iris"), ("PRODUCTION-HAULER", "Unidentified hauler")]:
        requirements.append({"id": req_id, "kind": "production-design", "title": title, "worldEntityIds": sorted({eid for a in assets if req_id in a["metadata"]["requirementIds"] for eid in a["metadata"]["entityIds"]}), "sceneIds": [], "source": {"rootAliasId": "production-art"}, "existingReferenceAssetIds": associations[req_id], "approvedAssetIds": [], "coverage": "partial-reference-needs-review", "priority": "Secondary", "requiredImages": ["Scale and coherent turnaround", "Approved identity and version order"], "missingImages": ["Approved model sheet"], "nextAction": "Confirm fictional identity and shared morphology; retain variants."})
    # Scene relationships derive from reviewed asset suitability and verified binder IDs.
    scene_links = [{"sceneId": sid, "title": title, "assetIds": [a["id"] for a in assets if sid in a["metadata"]["sceneIds"]], "basis": "Proposed reference suitability; not approved scene illustration"} for sid, title in scenes.items()]
    entity_links = [{"entityId": e["id"], "name": e["name"], "assetIds": [a["id"] for a in assets if e["id"] in a["metadata"]["entityIds"]]} for e in entities]
    crosswalk = []
    for entity in entities:
        suffix = entity["id"].removeprefix("source-entity-")
        candidates = [e for e in comparison["workspace"]["world"]["entities"] if e.get("sourceDocumentId", "").lower() == suffix]
        crosswalk.append({"baselineId": entity["id"], "baselineName": entity["name"], "comparisonIds": [e["id"] for e in candidates], "basis": "Shared source-document UUID; no automatic rebinding", "notesChanged": bool(candidates and candidates[0].get("notes") != entity.get("notes"))})
    groups = defaultdict(list)
    for asset in assets:
        groups[asset["metadata"]["relatedGroup"]].append(asset["id"])
    derivatives_map = []
    for asset in assets:
        source = asset["metadata"]["sources"][0]
        if source["kind"] == "pdf-embedded":
            parents = [a["id"] for a in assets if any(s["kind"] == "pdf-page-render" and s["relativePath"] == source["relativePath"] and s.get("page") == source.get("page") for s in a["metadata"]["sources"])]
            derivatives_map.append({"assetId": asset["id"], "relatedAssetIds": parents, "relationship": "embedded-in-page-composition"})
    outputs = {
        "requirements-register.json": {"schemaVersion": 1, "requirements": requirements},
        "visual-states.json": {"states": [r for r in requirements if r["kind"] == "visual-state"], "rule": "Physical identity, costume, damage and transformation remain separately described by the source fields; no automatic approval."},
        "entity-asset-links.json": {"derivedFrom": "project.json projectSettings.assetRegistry", "links": entity_links},
        "scene-asset-links.json": {"derivedFrom": "project.json projectSettings.assetRegistry", "links": scene_links},
        "entity-id-crosswalk.json": {"baselineSource": args.baseline.name, "comparisonSource": args.comparison.name, "crosswalk": crosswalk},
        "provenance.json": {"sources": discovery["files"], "occurrences": occurrences, "rule": "Resolve original locations via machine bindings outside package; original bytes untouched."},
        "pdf-inspection.json": {"sourceRootAliasId": "production-art", "evidenceRootAliasId": "inspection-evidence", "pathSemantics": "sourceRelativePath resolves under sourceRootAliasId; preview and extractedPath resolve under evidenceRootAliasId. Inspection evidence is external, not portable project-owned media.", "pdfs": discovery["pdfs"], "reviewedPages": page_records, "embeddedImages": embedded, "renderWarning": "MuPDF reported missing ExtGState GSa on some drawing pages. Visible drawings reviewed; preserve original PDFs for authoritative vector interpretation."},
        "relationships.json": {"groups": [{"id": k, "assetIds": v, "relationship": "visual-family-not-established-version-order"} for k, v in groups.items()], "derivations": derivatives_map, "exactDuplicates": [{"assetId": a["id"], "sources": a["metadata"]["sources"]} for a in assets if len(a["metadata"]["sources"]) > 1]},
        "design-decisions.json": {"workbookDecisions": tables["DECISIONS"], "continuity": tables["CONTINUITY"], "rules": tables["DESIGN RULES"], "catalogueReview": review},
        "character-references.json": {"requirements": [r["id"] for r in requirements if r["kind"] == "character"], "entityLinks": [x for x in entity_links if next(e for e in entities if e["id"] == x["entityId"]).get("templateName") == "Character"]},
        "ship-technology-references.json": {"assetIds": [a["id"] for a in assets if a["metadata"]["category"] in ["ship", "weapon", "technology"]], "worldRequirementIds": [r["id"] for r in requirements if r["kind"] in ["ship", "weapon", "technology"]]},
        "location-environment-references.json": {"assetIds": [a["id"] for a in assets if a["metadata"]["category"] == "environment"], "requirements": [r["id"] for r in requirements if r["kind"] in ["environment", "planet", "station"]]},
        "asset-catalogue.json": {"schemaVersion": 1, "authoritativeRegistry": {"file": "../../../project.json", "projectSelector": "activeProjectId", "jsonPointerWithinProject": "/projectSettings/assetRegistry"}, "assetIds": [a["id"] for a in assets], "rule": "This is a derived entry-point index; edit canonical registry through application service. Supplementary requirements are not yet an application-owned DTO."},
    }
    for name, data in outputs.items():
        write_json(metadata / name, data)
    for asset in assets:
        asset["metadata"]["relatedAssetIds"] = [aid for aid in groups[asset["metadata"]["relatedGroup"]] if aid != asset["id"]]
    # Re-emit after relationship enrichment; this plan is local build input, not another authority.
    write_json(evidence / "import-plan.json", {"assets": assets, "files": plan})
    with (metadata / "inventory.csv").open("w", newline="", encoding="utf-8-sig") as stream:
        columns = ["assetId", "description", "category", "subject", "confidence", "canonStatus", "visualState", "artisticStyle", "width", "height", "format", "sha256", "fileRef", "originalLocations", "entityIds", "sceneIds", "notes"]
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader()
        for a in assets:
            m = a["metadata"]
            writer.writerow({**{k: m.get(k, "") for k in columns}, "assetId": a["id"], "fileRef": a["fileRef"],
                "originalLocations": json.dumps(m["sources"], ensure_ascii=False), "entityIds": ";".join(m["entityIds"]), "sceneIds": ";".join(m["sceneIds"])})
    stats = {"sourceFiles": len(discovery["files"]), "sourceRasterFiles": len(discovery["images"]), "pdfFiles": len(discovery["pdfs"]), "pdfPages": sum(p["pageCount"] for p in discovery["pdfs"]), "uniqueEmbeddedImages": len(embedded), "registryAssets": len(assets), "ownedImages": sum(p["copy"] for p in plan), "externalReferences": sum(not p["copy"] for p in plan), "requirements": len(requirements), "coverage": dict(Counter(r["coverage"] for r in requirements)), "ownedOrigins": dict(Counter(a["metadata"]["sources"][0]["kind"] for a in assets if a["fileRef"])), "workbookSheets": len(workbook["sheets"])}
    write_json(metadata / "discovery-summary.json", stats)
    write_json(metadata / "development-backlog.json", {"completed": ["Recursive hash inventory", "Visual review of raster files, PDF pages and embedded resources", "All workbook sheets extracted and reviewed", "Explicit baseline entity/scene cross-reference", "Bounded catalogue compilation"], "pending": [{"requirementId": r["id"], "status": r["coverage"], "priority": r["priority"], "nextAction": r["nextAction"]} for r in requirements], "nextImplementationTicket": "Secure shared media resolver (#3), then durable import/metadata lifecycle (#4); no UI before storage verification."})
    print(json.dumps(stats))


if __name__ == "__main__":
    main()
