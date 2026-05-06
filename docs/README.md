# Cast — Documentation

> Specs, diagrams, and the lo-fi prototype for the **Cast Creative Automation Studio Toolchain**.
> For runtime / Quick Start, see the [root README](../README.md).

This folder is the design record for the POC. Read top-to-bottom — each doc builds on the one above it.

## Read in this order

| #   | Doc                                                                    | What it answers                                                                                                                                                              |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [user-stories.md](user-stories.md)                                     | **Who** uses Cast and **what jobs** they need done — the source of every requirement downstream.                                                                             |
| 2   | [system-map.md](system-map.md)                                         | **What the system is**: components, filesystem layout, contracts, end-to-end sequence. The canonical architecture reference.                                                 |
| 3   | [flow-diagrams.md](flow-diagrams.md)                                   | **How requests move through it**: per-screen flows (S1–S4), error paths, retry semantics, schemas.                                                                           |
| 4   | [attributes-screen-requirements.md](attributes-screen-requirements.md) | **What each screen must show**: per-screen attributes, inform-vs-act surfaces, decision IDs.                                                                                 |
| 5   | [mockups.html](mockups.html)                                           | **What it looks like**: rough static HTML mockups of S1–S5 screens.                                                                                                          |
| 6   | [prototype/](prototype/)                                               | **What it feels like**: clickable vanilla-React prototype driving S1 / S2 / S2′ / S3 / S4 from in-memory fixtures. See [prototype/README.md](prototype/README.md) to run it. |

## Reference docs

| Doc                                        | Purpose                                                                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| [design/](design/)                         | Brand guideline HTML books for Onda, Brisa, Volt, and Cast. See [design/README.md](design/README.md).                                  |
| [brand-extraction.md](brand-extraction.md) | How the brand HTMLs in `design/` are reduced to the runtime `brandProfileSchema`. The bridge between visual identity and the pipeline. |

<!-- TODO: Remove when done -->

| [prototype-todo.md](prototype-todo.md) | Live working TODO list for the prototype. Not documentation — items get deleted as they land. |

## Conventions

- **Decision IDs (D1–D32).** Every architectural choice is numbered. References like _(D11)_ or _(D32)_ point back to the canonical decision in [system-map.md](system-map.md) or [flow-diagrams.md](flow-diagrams.md).
- **Status.** The architectural spec is locked. Runtime scaffolding (Next.js app, route handlers, real GenAI calls) ships in a follow-up implementation PR — see the [root README](../README.md) Quick Start for the target shape.
