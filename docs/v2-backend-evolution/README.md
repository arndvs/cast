# Cast — Documentation (v2)

> Specs, diagrams, and the lo-fi prototype for the **Cast Creative Automation Studio Toolchain**.
> For runtime / Quick Start, see the [root README](../../README.md).

This folder is the design record for the POC and v2 evolution. Read top-to-bottom — each doc builds on the one above it.

## Read in this order

| # | Doc | What it answers |
| --- | --- | --- |
| 1 | [user-stories-v2.md](user-stories-v2.md) | **Who** uses Cast and **what jobs** they need done. Five personas: Maya (production), Priya (brand), Aaron (demo), Jordan (performance), Sam (ops/scheduling). Source of every requirement downstream. |
| 2 | [system-map-v2.md](system-map-v2.md) | **What the system is**: entities, actors, subsystems, three-caller architecture (UI · Fastify · MCP), data flows. The canonical architecture reference. |
| 3 | [flow-diagrams.md](../flow-diagrams.md) | **How requests move through it** (v1): per-screen flows S1–S5, error paths, retry semantics, API contract, brief schema, brand profile schema, future scope §1–§8. |
| 3v2 | [flow-diagrams-v2.md](flow-diagrams-v2.md) | **v2 flow additions** §9–§11: performance feedback import, fatigue score computation, agent/MCP caller session flows. Read after flow-diagrams.md §8. |
| 4 | [attributes-screen-requirements-v2.md](attributes-screen-requirements-v2.md) | **What each screen must show**: S1–S7 (S6 Performance Dashboard and S7 Fatigue Report are v2 additions). |
| 5 | [mockup.html](../mockup.html) | **What it looks like**: rough static HTML mockups of S1–S5 (S6/S7 mocks TBD). |
| 6 | [prototype/](../prototype/) | **What it feels like**: clickable vanilla-React prototype. See [prototype/README.md](../prototype/README.md) to run it. |

## Reference docs

| Doc | Purpose |
| --- | --- |
| [design/](../design/) | Brand guideline HTML books for Onda, Brisa, Volt, and Cast. |
| [brand-extraction-v2.md](brand-extraction-v2.md) | How the brand HTMLs are reduced to the runtime `brandProfileSchema` (Part 1), the Qdrant `cast-knowledge` knowledge base (Part 2), historical asset ingestion (Part 3 — Step 13–16), and output versioning. |
| [agent-integration.md](agent-integration.md) | **New in v2.** How Cast exposes its pipeline to agents, schedulers, and external marketing automation systems. Covers the 6 registered MCP tool definitions (+ 5 roadmap tools), progress streaming model, tool annotations, the performance flywheel, human-in-the-loop checkpoints, the planned `AdsPerformanceProvider` interface, and the Fastify split path. |

## What changed in v2

| Area | v1 | v2 |
| --- | --- | --- |
| User stories | 3 personas (Maya, Priya, Aaron) | 5 personas (+ Jordan, Sam) |
| Audience field | Free-text string | Persona typeahead (saved personas in Qdrant) with free-text fallback |
| Storage | Local filesystem only | StorageAdapter interface: LocalFsAdapter (dev) + AzureBlobAdapter (prod) |
| Image metadata | None | Auto-analyzed post-generation (gpt-4o-mini), stored as `.metadata.json` sidecars; Qdrant vectorization is roadmap |
| Vector database | None | Qdrant Cloud: `cast-creatives` · `cast-knowledge` · `cast-personas` |
| Knowledge base | `voice.json` promptFragments (static) | Chunked markdown → Qdrant RAG (dynamic, market-aware) |
| Approval workflow | None | `status: pending/approved/rejected` + `rejectionReason` on creative metadata |
| Performance tracking | None | `POST /api/performance` → performanceScore on Qdrant payloads |
| Fatigue detection | None | `fatigueScore` + `GET /api/fatigue-report` with refresh recommendations |
| Cost tracking | None | `costs { estimated, actual }` on manifest + run |
| Agent / MCP | None | 6 registered read-only MCP tool definitions in `mcp-tools.ts`; additional tools, resources, and transport documented as roadmap |
| API callers | UI only | UI · Fastify API · MCP transport (three callers, one server layer) |
| Flow diagrams | §1–§8 (screens + API contract) | + §9 (performance feedback) · §10 (fatigue) · §11 (agent/MCP) in flow-diagrams-v2.md |
| Backend split | Not planned | Documented in `agent-integration.md` — mechanical, not architectural |
