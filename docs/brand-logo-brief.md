# Wurkz Logo Brief (decisions + generation prompts)

> Owner decisions 2026-07-09. Companion to [`positioning.md`](./positioning.md).

## Decisions

| Concern | Decision | Why |
|---|---|---|
| Form | **Icon + wordmark** | Icon alone = app/tab icon; full lockup = installer, receipts, cloud header |
| Personality | **Dependable & solid** | Matches the "it just works" promise; tool-like, not startup-like |
| Color | **Industrial orange (#F97316) + dark steel (#1F2937)** | Workshop energy; distinct from every-POS blue. Becomes the app accent eventually |
| Motif | **Abstract gear-tooth W** (not a literal wrench/gear) | Ownable, ages well if Wurkz expands beyond repair shops |

## Generation prompts (nano banana)

**Full lockup:**

> Professional logo design for "Wurkz", a repair shop management software. A bold abstract letter W built from interlocking gear teeth — the W's peaks shaped like the teeth of a gear, geometric and chunky, suggesting machinery without being a literal gear. Flat vector style, solid shapes, no gradients, no 3D effects. Color palette: industrial safety orange (#F97316) for the W mark, dark charcoal steel (#1F2937) for the wordmark "Wurkz" set in a heavy, rounded industrial sans-serif to the right of the mark. Clean white background, generous spacing, centered composition. The design should feel dependable, sturdy and honest — like a well-made tool, not a tech startup. Minimal, memorable, readable at small sizes.

**Icon only (app icon / favicon):**

> Minimal flat vector app icon: a bold abstract letter W formed by interlocking gear teeth, geometric and chunky, industrial safety orange (#F97316) on a dark charcoal (#1F2937) rounded-square background. No text, no gradients, no 3D, no outlines. Strong silhouette that stays recognizable at 32 pixels. Sturdy, mechanical, dependable feeling.

**Dark-mode lockup variant:** wordmark in off-white (#F9FAFB) on dark charcoal (#1F2937), W stays safety orange.

## Workflow tips

1. Generate the **icon first**; once a W shape wins, feed the image back with "keep this exact W mark, add the wordmark" (editing is more consistent than regenerating).
2. Always say **"flat vector style"** — otherwise it drifts to shiny 3D that dies at small sizes/print.
3. Too gear-literal? Add: *"the gear teeth are part of the W's own strokes, not a gear surrounding it."*
4. Reject any output with mangled "Wurkz" spelling — the most common AI-logo tell.

## Round 2 (2026-07-09) — mark only; "Wurkz" as plain text beside it

| Concern | Decision |
|---|---|
| Symbol | **Checkmark / motion mark** — plays on the name meaning WORKS, not repair imagery |
| Style | Flat geometric solid |
| Color | Same palette (#F97316 orange / #1F2937 steel) |
| Container | Free-floating mark (badge added later only for the app icon) |
| Text | "Wurkz" rendered as real text next to the mark — NOT part of the graphic |

**Hero prompt (double-check forming a subtle W):**

> Minimal flat vector logo mark, no text: two bold checkmarks placed side by side so together they subtly form the shape of a letter W. Chunky geometric solid shapes with confident thick strokes, no outlines, no gradients, no 3D. Industrial safety orange (#F97316) as the single color of the mark, on a plain white background. The mark floats freely with no badge or container. Feeling: dependable, energetic, "it just works" — like a quality-control stamp from a well-run workshop. Strong simple silhouette, instantly recognizable at 32 pixels.

**Fallback (single check + motion streak):**

> Minimal flat vector logo mark, no text: a single bold checkmark whose tail sweeps forward into a subtle motion streak, suggesting speed and completion. Chunky geometric solid shapes, no outlines, no gradients, no 3D. Industrial safety orange (#F97316), free-floating on a plain white background, no badge or container. Dependable and energetic — "done, and done fast." Clean silhouette readable at 32 pixels.

*Wordmark pairing:* heavy rounded sans (e.g. Nunito Black / app font at 800) in #1F2937, typed as real text.

**Owner feedback:** no interlocking/gear-teeth/fused forms (disliked from round 1). Revised prompts:

**Revised hero (one continuous smooth zigzag — W ending in a check tail):**

> Minimal flat vector logo mark, no text: one single continuous bold zigzag stroke that reads as a smooth letter W, its final upstroke finishing like the tail of a checkmark. One uninterrupted flowing line with rounded corners and uniform thickness — a single clean shape, not multiple pieces joined together. Flat solid color, no outlines, no gradients, no 3D. Industrial safety orange (#F97316), free-floating on a plain white background, no badge or container. Feeling: dependable, smooth, effortless — "it just works." Simple silhouette readable at 32 pixels.

**Alternative (pure single check, rounded, slight forward motion):**

> Minimal flat vector logo mark, no text: a single bold checkmark with softly rounded corners, its tail sweeping slightly forward to suggest momentum. One clean solid shape only. Flat vector, no outlines, no gradients, no 3D. Industrial safety orange (#F97316), free-floating on a plain white background. Confident and calm — a quality mark, "done." Instantly readable at 32 pixels.

**Negative guidance (append to either):** Do not use gears, gear teeth, interlocking parts, overlapping shapes, or mechanical texture. The mark is one smooth, simple form.

## When a winner is picked

- [ ] Replace Tauri icons (`src-tauri/icons/`) — needs 32/128/256 px + .ico/.icns
- [ ] Desktop login/header logo (Settings already supports a shop logo — this is the *product* logo, separate)
- [ ] Cloud header brand mark
- [ ] Consider adopting #F97316 as the app accent (new theme decision — discuss first)
