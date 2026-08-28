# Proof-Read Coverage Overlap Colour Mixing Refinement

Status: authoritative visual-design refinement for the Proof Read overlap work on `feature/manuscript/proofread-history-safe-reversal`.

This document supersedes the **Arithmetic RGB averaging** rule, the RGB-specific overlap acceptance criteria, RGB-specific renderer tests, and the RGB-specific Stage E implementation wording in `proofread-active-run-interaction-and-overlap-design.md`.

All other interaction, persistence, lineage, coverage, selection, viewport, run-colour, intensity-inheritance, and previous-run visibility rules from that design remain unchanged.

This document defines intended behaviour and implementation boundaries only. It does not implement application code.

---

## Decision

Use an **equal-weight N-way average in OKLab** for proof-read coverage overlap colours.

Do not average gamma-encoded sRGB/RGB channels directly.

The visual pipeline is:

```text
saved run colours (sRGB hex)
        ↓
dedupe contributing coverage by durable run ID
        ↓
convert each sRGB colour → linear sRGB → OKLab
        ↓
average L, a and b across all distinct contributing runs
        ↓
convert mixed OKLab → sRGB
        ↓
deterministic gamut mapping when required
        ↓
apply separately resolved theme intensity
        ↓
render derived overlap colour
```

The mixed colour remains render-only derived state. It is never written back onto a proof-read run or coverage record.

---

# Why OKLab is preferable here

The previous arithmetic-RGB proposal had the useful properties of being simple, deterministic and order-independent, but gamma-encoded sRGB channel averaging is not perceptually uniform.

That can make visually strong colours collapse into an unexpectedly dark or muddy result. It also means equal numeric channel movement does not correspond well to equal perceived colour movement.

OKLab is a better fit for this application because the proof-read colours are **UI identity colours**, not simulated pigments or physical light sources.

For this use case we want the overlap to:

- sit perceptually between the participating run colours;
- preserve a sensible perceived lightness;
- remain deterministic;
- remain independent of projection ordering;
- generalise cleanly from two runs to many runs;
- handle neutral colours without special hue-angle rules;
- avoid the hue wrap/circular-mean edge cases introduced by directly averaging OKLCH hue angles;
- avoid the muddy brightness behaviour of naive gamma-encoded RGB averaging.

Example of the difference:

```text
#0000FF blue + #FFFF00 yellow

naive sRGB channel mean
≈ #808080

OKLab equal-weight mean
≈ #6CABC7
```

The exact final 8-bit value may vary by a channel because of rounding/gamut implementation, but the important product behaviour is the perceptual OKLab interpolation, not the old grey-producing sRGB channel mean.

This is still **not painterly/subtractive mixing**. The product is deriving a readable overlap identity for a manuscript UI, not trying to simulate mixed paint.

---

# 1. N-way mixing rule

For a rendered manuscript segment, collect all ordinary proof-read coverage projections containing that segment.

Dedupe them by durable `runId` before colour calculation.

For each distinct run colour `Ci`:

```text
Ci (sRGB hex)
→ decode sRGB transfer curve
→ linear RGB
→ OKLab(Li, ai, bi)
```

For `N` contributing runs calculate the mix **once across the entire set**:

```text
Lmix = (L1 + L2 + ... + LN) / N
amix = (a1 + a2 + ... + aN) / N
bmix = (b1 + b2 + ... + bN) / N
```

Then convert:

```text
OKLab(Lmix, amix, bmix)
→ linear sRGB
→ encoded sRGB
→ rendered colour
```

Do not perform repeated pairwise 50/50 mixing such as:

```text
mix(mix(P1, P2), P3)
```

because that changes the effective weights and can make the result depend on grouping/order.

The direct N-way mean guarantees every participating proof-read run receives exactly one equal vote in the overlap colour.

---

# 2. Determinism and order independence

The same set of contributing run IDs and saved colours must always produce the same rendered result.

These must be equivalent:

```text
[P1, P2, P3]
[P3, P1, P2]
[P2, P3, P1]
```

Implementation should therefore:

1. dedupe by `runId`;
2. gather the complete contributing set for the segment;
3. average the OKLab components using stable numeric helpers;
4. convert/gamut-map once at the end;
5. round only when producing the final display representation.

Do not round each input's OKLab components to display precision before the average.

---

# 3. Gamut handling

An averaged OKLab colour should be converted back to the application's sRGB display space.

If the converted result is outside the sRGB gamut, do not independently hard-clamp R/G/B channels as the primary policy because channel clipping can visibly shift hue.

Use deterministic perceptual gamut mapping:

```text
mixed OKLab
→ convert to OKLCH
→ preserve L and hue
→ reduce chroma C until the colour is inside sRGB gamut
→ convert to encoded sRGB
```

A bounded binary search or equivalent deterministic chroma-reduction helper is appropriate.

If chroma is effectively zero, hue is irrelevant and the neutral colour can be converted directly.

Tests should use one shared tolerance/rounding convention so browser/platform differences do not become UI differences.

---

# 4. Intensity remains separate from colour identity

Do not use a run's Light/Dark highlight intensity as a weight in the OKLab colour average.

A proof-read run represents one historical coverage contribution regardless of whether the author chose to display that run more faintly in one theme.

Colour identity:

```text
equal run weights in OKLab
```

Display intensity:

```text
Imix = (I1 + I2 + ... + IN) / N
```

using the participating runs' saved intensity for the currently active theme.

Then apply `Imix` to the already-derived mixed colour.

This keeps durable run identity and author comfort settings conceptually separate.

Do not first composite each run against the manuscript background and then average the resulting screen pixels. That would make the overlap colour depend on Light/Dark page background and would destroy stable run-colour semantics.

---

# 5. One-run and duplicate-span behaviour

If exactly one distinct run contributes to a segment:

```text
render that run's saved colour directly
```

Do not round-trip a single colour through OKLab unless the implementation already does so losslessly enough for the application's display contract.

If several internal spans from the same run cover the same rendered segment, that run is counted once.

Example:

```text
P1 span A
P1 span B
P2 span C
```

where all three overlap one rendered segment is a two-run mix:

```text
P1 + P2
```

not a three-contribution mix weighted twice toward P1.

---

# 6. Semantic separation from history/conflict colours

This refinement applies only to **ordinary proof-read coverage overlap**.

It does not mix the following into the OKLab coverage colour:

- historical selected-run review treatment;
- `changed later` treatment;
- unsafe undo/redo conflict treatment;
- selected change emphasis;
- Proof Map red change markers.

Those remain semantic UI overlays/treatments owned by their respective review/navigation features.

Coverage overlap remains a normal visual composition state, never an undo/redo conflict.

---

# 7. Recommended implementation boundary

Keep conversion/mixing policy out of general manuscript DOM code.

A proof-read visual helper/service should expose an operation conceptually similar to:

```text
mixDraftProofCoverageColours(contributions, activeTheme)
```

with inputs containing at least:

```text
runId
backdropColor
highlightIntensity
```

The helper returns render-ready derived values such as:

```text
color
intensity
contributingRunIds
```

The manuscript renderer remains responsible for determining which coverage projections occupy a text segment, but the colour-space mathematics should have one tested implementation.

Do not rely on browser `color-mix()` behaviour as the authoritative algorithm. Explicit application-side conversion keeps N-way weighting, gamut mapping, rounding, and tests stable across environments.

---

# 8. Updated acceptance criteria

The overlap-mixing acceptance criteria from the parent design are replaced with the following:

- one distinct contributing run renders its own saved colour;
- two distinct contributing runs render their equal-weight OKLab mean;
- three or more distinct runs render the direct N-way OKLab mean across all contributing run IDs;
- changing projection order does not change the result;
- changing grouping does not change the result because pairwise recursive mixing is not used;
- duplicate coverage spans from one run do not increase that run's weight;
- an out-of-sRGB mixed result is gamut-mapped by deterministic chroma reduction rather than arbitrary independent channel clipping;
- theme intensity remains a separately derived arithmetic mean across the participating runs;
- changing Light/Dark page background does not change the base mixed colour;
- ordinary coverage overlap never receives the historical unsafe-reversal `conflict` semantic;
- mixed colours are derived at render time and are never persisted as run data.

---

# 9. Updated test plan

Replace RGB-average renderer tests with perceptual-mixing tests.

Recommended focused tests:

```text
test/draft-proofing-colour-mix.test.mjs
  - sRGB → OKLab → sRGB conversion reference values
  - two-run OKLab mean
  - N-run direct mean
  - input-order independence
  - no pairwise-weighting drift
  - run-ID deduplication
  - neutral-colour handling
  - deterministic sRGB gamut mapping
  - final rounding stability
  - intensity kept separate from colour weighting
```

The manuscript editor/host tests should then verify integration rather than reimplementing the colour mathematics:

```text
test/manuscript-editor-host.test.mjs
  - collects all distinct coverage contributors for a segment
  - delegates to the proof-read colour-mix helper
  - uses returned colour/intensity
  - keeps historical review/conflict projections out of coverage mixing
```

Include at least one regression fixture where naive sRGB averaging and OKLab averaging differ materially, so a future refactor cannot accidentally revert to channel averaging while still passing trivial same-hue tests.

---

# 10. Updated Stage E implementation wording

Stage E of `proofread-active-run-interaction-and-overlap-design.md` should be interpreted as:

```text
Stage E — Coverage overlap rendering

- collect all distinct active coverage projections per rendered segment;
- convert contributing saved sRGB colours to OKLab;
- calculate one direct equal-weight N-way OKLab mean;
- perceptually gamut-map the result back into sRGB when required;
- average theme intensities separately;
- keep historical review/conflict rendering separate;
- add deterministic colour-space and renderer integration tests.
```

This refinement supersedes the previous `arithmetic-average RGB colours` instruction.

---

# Design summary

The overlap colour should represent **equal proof-read run participation in perceptual colour space**.

The governing rule is:

> Dedupe by run ID, average all contributing colours once in OKLab, gamut-map once, then apply theme intensity separately.

This preserves the mathematical properties required by the proof-read architecture while producing a more useful and visually balanced UI result than naive sRGB channel averaging.