# System Map — Cast: Creative Automation Pipeline

### Local Next.js App · POC · v1

> Bridges the [user stories](user-stories.md) to a buildable solution. Entities, actors, and subsystems are pulled directly from the verbs/nouns in Maya's, Priya's, and Aaron's stories.

---

## 1. Entity Map — the nouns in the system

The "things" the system stores, moves, and renders. Pulled from the user-story verbs (edit a **brief**, drop a **photo**, generate a **hero image**, render an **output**, badge for **compliance**, write a **report**).

```mermaid
graph LR
    Brief["Brief<br/>brand · products · markets<br/>audience · message · ratios"]
    Product["Product<br/>name · sku"]
    InputAsset["Input Asset<br/>inputs/assets/[product-slug].{png,jpg,jpeg,webp}"]
    HeroImage["Hero Image<br/>GenAI fallback"]
    Creative["Output Creative<br/>1:1 · 9:16 · 16:9"]
    Message["Localized Message<br/>per locale"]
    Compliance["Compliance Result<br/>OK · WARN · FAIL"]
    RunLog["Run Log<br/>streamed steps"]
    Report["Report<br/>report.json"]

    Brief -->|lists| Product
    Brief -->|carries| Message
    Product -->|resolves to| InputAsset
    Product -.->|falls back to| HeroImage
    InputAsset -->|source for| Creative
    HeroImage -->|source for| Creative
    Message -->|composited onto| Creative
    Creative -->|evaluated by| Compliance
    Creative -->|listed in| Report
    Compliance -->|listed in| Report
    RunLog -->|summarized in| Report
```

---

## 2. Actor Map — who does what

Three actors, each with a distinct primary verb. same system, three lenses.

```mermaid
graph TB
    subgraph Actors
        Maya["Maya<br/>Creative Producer"]
        Priya["Priya<br/>Brand Manager"]
        Aaron["Aaron<br/>Engineer / Demo"]
    end

    subgraph Verbs["Primary actions"]
        Edit["edits brief"]
        Drop["drops photos in /inputs"]
        Generate["clicks Generate"]
        Watch["watches pipeline log"]
        Review["reviews output grid"]
        Read["reads compliance badges"]
        Drill["drills into flagged item"]
        Demo["narrates the demo"]
    end

    Maya --> Edit
    Maya --> Drop
    Maya --> Generate
    Maya --> Watch
    Maya --> Review

    Priya --> Review
    Priya --> Read
    Priya --> Drill

    Aaron --> Generate
    Aaron --> Watch
    Aaron --> Demo
```

---

## 3. Subsystem Map — how the parts fit together

The verbs from the stories cluster into seven subsystems. Anything inside the dashed box runs inside the local Next.js app; anything outside is filesystem or third-party.

```mermaid
graph TB
    subgraph External["External / filesystem"]
        Inputs[("inputs/assets/<br/>product photos")]
        Outputs[("outputs/[campaign]/[market]/<br/>[product]/[ratio].png")]
        GenAI["GenAI Image API<br/>hero fallback"]
        ReportFile[("report.json")]
    end

    subgraph App["Local Next.js app — localhost:3000"]
        direction TB

        subgraph UI["UI layer"]
            Editor["Brief Editor<br/>JSON form, pre-loaded example"]
            LogView["Live Pipeline Log<br/>streamed steps"]
            Grid["Output Grid<br/>row per product · 3 ratio cols"]
            BadgeUI["Compliance Badges<br/>OK / WARN / FAIL + drill-in"]
        end

        subgraph Engine["Pipeline Engine"]
            Orchestrator["Run Orchestrator<br/>steps + streaming"]
            Resolver["Asset Resolver<br/>find or generate"]
            Resizer["Image Processor<br/>Sharp · 1:1 · 9:16 · 16:9"]
            Compositor["Text Compositor<br/>localized message overlay"]
            Checker["Compliance Checker<br/>logo · palette · banned words"]
            Reporter["Reporter<br/>writes report.json"]
        end
    end

    Editor -->|brief| Orchestrator
    Orchestrator --> Resolver
    Resolver -->|lookup| Inputs
    Resolver -.->|on miss| GenAI
    Resolver --> Resizer
    Resizer --> Compositor
    Compositor --> Checker
    Compositor --> Outputs
    Checker --> Reporter
    Reporter --> ReportFile
    Orchestrator -.->|stream| LogView
    Outputs --> Grid
    Checker --> BadgeUI
    BadgeUI -.->|click| Grid
```

---

## 4. Data flow — one Generate click, end to end

How a single click on **Generate** moves a brief through the system and back to the screen.

```mermaid
sequenceDiagram
    autonumber
    actor User as Maya / Aaron
    participant UI as Brief Editor
    participant Orc as Run Orchestrator
    participant Res as Asset Resolver
    participant FS as inputs/assets
    participant AI as GenAI API
    participant Img as Resizer + Compositor
    participant Out as /outputs
    participant Chk as Compliance Checker
    participant Rep as Reporter
    participant Log as Live Log + Grid

    User->>UI: edit brief, click Generate
    UI->>Orc: POST brief
    Orc-->>Log: step "run started"
    loop for each product
        Orc->>Res: resolve hero for product
        Res->>FS: look up input asset
        alt asset found
            FS-->>Res: file path
        else asset missing
            Res->>AI: generate hero image
            AI-->>Res: image bytes
        end
        Res-->>Orc: hero image
        Orc-->>Log: step "asset ready"
        loop for each ratio (1:1, 9:16, 16:9)
            Orc->>Img: resize + composite message (locale)
            Img->>Out: save creative
            Orc->>Chk: check creative
            Chk-->>Orc: OK / WARN / FAIL
            Orc-->>Log: step "creative ready + badge"
        end
    end
    Orc->>Rep: write report.json
    Rep-->>Log: step "run complete"
    Log-->>User: grid populates with badged creatives
```

---

## 5. Compliance flow — Priya's lens

Priya never touches the pipeline; she lives on the output grid. Her flow is a read-and-drill loop on the artifacts the engine already produced.

```mermaid
graph LR
    Done["Run completes"] --> Grid["Output Grid<br/>all creatives + badges"]
    Grid --> Scan{"All green?"}
    Scan -->|yes| Ship["ship"]
    Scan -->|no| Click["click flagged tile"]
    Click --> Detail["Compliance Detail<br/>which check failed · why"]
    Detail --> Decide{"fixable in brief?"}
    Decide -->|yes| EditBrief["edit brief<br/>(re-run)"]
    Decide -->|no| Escalate["flag for designer"]
    EditBrief --> Done
```

---

## 6. Story → subsystem coverage

A sanity check that every user-story verb has a home in the system map.

| Story verb (from [user-stories.md](user-stories.md))        | Subsystem that owns it               |
| ----------------------------------------------------------- | ------------------------------------ |
| edit campaign brief in UI                                   | Brief Editor                         |
| read brand / products / markets / audience / message        | Brief Editor → Run Orchestrator      |
| look up input assets in `inputs/assets/`                    | Asset Resolver                       |
| generate hero image when missing                            | Asset Resolver → GenAI API           |
| resize to 1:1, 9:16, 16:9                                   | Image Processor (Sharp)              |
| composite localized message overlay                         | Text Compositor                      |
| stream pipeline log in real time                            | Run Orchestrator → Live Pipeline Log |
| display output grid in browser                              | Output Grid                          |
| save outputs to `outputs/[campaign]/[market]/[product]/[ratio].png` | Image Processor → filesystem |
| check logo / colors / prohibited words                      | Compliance Checker                   |
| badge each output OK / WARN / FAIL                          | Compliance Checker → Badge UI        |
| write `report.json`                                         | Reporter                             |

---

_Cast · System Map v1 · Adobe FDE Take-Home · Aaron Davis · 2026_
