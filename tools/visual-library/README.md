# Offline visual-library foundation tools

These operator helpers inspect explicitly supplied local production sources and
build a dedicated test package using existing application services. They do not
wire the Visual Studio UI, change persistence semantics or generate artwork.

Keep artwork, review annotations, imported manuscript content, catalogue outputs,
machine bindings and test packages **outside Git**.

Requirements: Node 24+, Python 3, Pillow and PyMuPDF. No cloud service is used.

1. Run `inspect_sources.py --source <production-root> --output <inspection-root>`.
   It inventories hashes, reads every XLSX sheet/cell, extracts PDF text/images
   and renders bounded contact sheets. Review the actual images and pages.
2. Create `review-notes.json` in the inspection root, with explicit per-image,
   per-page and per-embedded-resource descriptions. Do not infer identities from
   filenames. `compile_catalogue.py` documents the input fields in its code.
   Set `reviewedDiscoverySha256` to the SHA-256 of the reviewed `discovery.json`;
   compilation rejects annotations bound to a different discovery.
   `embedded-review.json` lists the visually reviewed unique embedded resources.
3. Run `compile_catalogue.py --source <production-root> --inspection <inspection-root>
   --baseline <snapshot.json> --comparison <snapshot.json>`.
   The UUID allocation file is durable local build input. Reclassification should
   keep an existing asset UUID; changed bytes are a new version, not an overwrite.
4. Run `node --experimental-strip-types tools/visual-library/build_package.mjs
   --source <production-root> --inspection <inspection-root>
   --baseline <snapshot.json> --comparison <snapshot.json> --parent <external-parent>`.
   The fixed child name is `Serva Vitae Visual Development`. The native writer
   rejects an existing destination. This is a creation helper, not an incremental
   updater: do not regenerate a library over later author edits.
5. Run `node --experimental-strip-types tools/visual-library/validate_package.mjs
   <absolute-package-root>`. It uses actual desktop handlers for reopen, Save As,
   relocation, missing image handling and path rejection. It temporarily renames
   only the supplied test package to prove the Save As copy works independently,
   restores it in `finally`, and retains a clearly separate validation copy.

The actual production asset registry is `projectSettings.assetRegistry`, populated
with `ProjectService.registerAsset`; portable serialization and staged package
writes use the existing persistence/desktop code. Images use the existing media
boundary with an explicit active package root and relative path.

Requirements/workbook/decision records are supplementary files under
`assets/reference/visual-studio`, because those domain DTOs are not implemented. The native writer omits unregistered metadata sidecars during Save As, so supplementary documents use the existing managed assets tree. Derived
catalogue indexes reference the registry rather than maintaining another asset
authority. Folder Save As copies them; a legacy single-file export cannot.
External locators are metadata only until a secure resolver/Relink is implemented.
Bindings remain outside the package. Cached reference thumbnails do not make
external full-resolution sources portable.

No interactive browser test or UI memory benchmark is implied by in-process
handler validation. See each local package's handoff and validation results for
the exact completed scope.
