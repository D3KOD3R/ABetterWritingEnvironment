# Anchor / Decoration Drift Handling Design

Do not rely on a full `evidenceExcerpt` as the primary way to detect whether a highlight, comment, or revision decoration has drifted.

The preferred design should separate anchor tracking into three layers:

1. Live edit tracking
2. Load-time validation
3. Recovery fallback

---

## 1. Live Edit Tracking Should Be the Primary Mechanism

When the user edits the manuscript, the editor already knows the edit transaction:

- Edit start offset
- Edit end offset
- Inserted text length
- Deleted text length
- Affected block/scene
- Edit ID / revision ID

Use this transaction to update anchors immediately.

### Rules

```js
if edit occurs before anchor:
  shift anchor startOffset/endOffset

if edit overlaps anchor:
  mark anchor as dirty/contentChanged
  adjust the range if appropriate

if edit fully deletes the anchor range:
  mark anchor as orphaned/deleted
```

If a user edits text inside a highlighted revision range, the anchor should be marked dirty at that moment. It should not need to wait for an evidence excerpt check.

---

## 2. Hash Should Be Used for Validation

A hash is more efficient than storing the entire selected text.

Use a hash to check whether the current text at the stored range still matches the original anchored text.

### Example

```js
currentText = manuscript.slice(startOffset, endOffset)
currentHash = hash(currentText)

if currentHash === originalHash:
  status = "resolved"
else:
  status = "stale"
```

The hash is useful for detecting mismatch, especially after project load or when validating saved anchors.

However, a hash alone only tells us that the content changed. It does not help locate where the text moved.

---

## 3. Context/Preview Should Be Used for Recovery

Do not store huge full excerpts for large highlights.

For long anchors, store bounded recovery evidence instead:

```js
{
  selectedTextPreview,
  prefixContext,
  suffixContext,
  originalHash,
  originalLength
}
```

### Recommended Limits

```js
selectedTextPreview: first 120-240 characters
prefixContext: 40-80 characters before the anchor
suffixContext: 40-80 characters after the anchor
originalHash: hash of the full selected range
originalLength: length of the original selected range
```

This allows recovery if offsets are wrong.

### Example Recovery Flow

```js
search near the original offset for:
  prefixContext
  selectedTextPreview
  suffixContext

if strong match found:
  update startOffset/endOffset
  status = "approximate"
else:
  status = "orphaned"
```

---

## Recommended Anchor DTO

```js
{
  anchorId,
  sceneId,
  blockId,

  startOffset,
  endOffset,

  originalHash,
  originalLength,

  selectedTextPreview,
  prefixContext,
  suffixContext,

  status,
  dirtyReason,
  lastTouchedAt,
  lastTouchedByEditId
}
```

Optional:

```js
evidenceMode: "full" | "hash-context"
```

Use:

```js
evidenceMode: "full"
```

only for short selections where storing the full text is safe.

Use:

```js
evidenceMode: "hash-context"
```

for large highlights, revision ranges, comments over paragraphs, scene-level notes, or anything that could bloat the project JSON.

---

## Key Principle

The manuscript text is the source of truth.

Anchors should not duplicate large manuscript ranges. They should only store enough information to:

1. Track position during live edits
2. Validate the anchor on project load
3. Recover the anchor if offsets become stale

Do not let anchors become revision storage. Revision/session files should store diffs. Anchors should only point to text and carry lightweight validation/recovery metadata.
