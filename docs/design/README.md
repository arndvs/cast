# Brand Guidelines

Standalone HTML brand books — the source-of-truth for visual identity across the Cast POC.
Open any file directly in a browser; no build step.

## Contents

| File | Brand | Role |
|---|---|---|
| [onda-brand-guidelines.html](onda-brand-guidelines.html) | **Onda Beverages** | Parent company. House style that Brisa and Volt inherit from. |
| [brisa-brand-guidelines.html](brisa-brand-guidelines.html) | **Brisa** | Sub-brand of Onda. Sparkling water. Soft naturals palette. |
| [volt-brand-guidelines.html](volt-brand-guidelines.html) | **Volt** | Sub-brand of Onda. Energy drink. High-contrast / dark palette. |
| [cast-brand-guidelines.html](cast-brand-guidelines.html) | **Cast** | The product itself (the studio toolchain). Used for the app's own UI / marketing. |

## How these are consumed

The pipeline does **not** load these HTML files at runtime. They're the rich, human-readable spec from which a much thinner JSON contract — `brandProfileSchema` — is distilled per brand.

The reduction (which sections land in which JSON path, what is intentionally dropped, how to onboard a new brand) is documented in [../brand-extraction.md](../brand-extraction.md). The resulting runtime contract is defined in [../flow-diagrams.md §4.3](../flow-diagrams.md#brand-profile-schema-contract).

## When to update

- **Visual changes** (colors, type, logo variants) → edit the HTML here, then re-derive the JSON profile per [brand-extraction.md](../brand-extraction.md).
- **Runtime contract changes** (new fields the pipeline reads) → update `brandProfileSchema` in [flow-diagrams.md](../flow-diagrams.md) first, then back-fill the HTML so it covers the new field.
