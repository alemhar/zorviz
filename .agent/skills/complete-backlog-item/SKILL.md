---
name: complete-backlog-item
description: Use this skill when the user says something like "complete BACK-2-004", "mark BACK-1-002 as done", "finish backlog item BACK-3-001", or mentions a backlog ID (format BACK-{phase}-{number}) to indicate they have finished implementing it. This skill reads the item from the correct phase backlog file, gathers details about what was actually built in the codebase, removes it from the backlog, and appends it with full implementation notes to the corresponding completed file.
---

# Complete Backlog Item Skill

You are helping the user maintain the Zorviz project backlog system located at `d:\Projects\Zorviz\docs\backlog\`.

## Backlog File Map

| Phase | Backlog File | Completed File |
|---|---|---|
| 1 | `d:\Projects\Zorviz\docs\backlog\phase-1-backlog.md` | `d:\Projects\Zorviz\docs\backlog\phase-1-completed.md` |
| 2 | `d:\Projects\Zorviz\docs\backlog\phase-2-backlog.md` | `d:\Projects\Zorviz\docs\backlog\phase-2-completed.md` |
| 3 | `d:\Projects\Zorviz\docs\backlog\phase-3-backlog.md` | `d:\Projects\Zorviz\docs\backlog\phase-3-completed.md` |
| 4 | `d:\Projects\Zorviz\docs\backlog\phase-4-backlog.md` | `d:\Projects\Zorviz\docs\backlog\phase-4-completed.md` |

## ID Convention

- Backlog item ID format: `BACK-{phase}-{number}` (e.g., `BACK-2-004`)
- Completed item ID format: `BACK-{phase}-C{number}` (e.g., `BACK-2-C004`)
- The phase number is the digit after `BACK-`.

## Step-by-Step Instructions

### Step 1 — Parse the ID
Extract the phase number and item number from the user-provided ID.
- Example: `BACK-2-004` → phase `2`, item number `004`

### Step 2 — Read the Backlog File
Read the correct `phase-{phase}-backlog.md` file. Find the section that matches the item ID. The section starts with `## BACK-{phase}-{number}` and ends just before the next `## BACK-` heading or end of file.

### Step 3 — Investigate the Codebase
Before writing the completed entry, actively investigate what was actually built. This is the most important step — the completed entry must reflect reality, not just the original spec.

Do the following:
- List relevant directories mentioned in the backlog item's **Area** field
- Read key source files to understand what was implemented
- Note: which files were created, what methods/components exist, any design decisions that differ from the original spec
- Check for any items from the acceptance criteria checklist that were **not** implemented (partial completions are valid — document honestly)

### Step 4 — Remove from Backlog
Edit `phase-{phase}-backlog.md` to remove the entire section for this item (from its `##` heading to just before the next `##` heading).

### Step 5 — Append to Completed File
Open `phase-{phase}-completed.md` and append a new entry at the end using this exact template:

```markdown
## ✅ BACK-{phase}-C{number} · {Original Title}

**Completed:** {today's date in YYYY-MM-DD}
**Original Backlog ID:** BACK-{phase}-{number}

**What was implemented:**
- {bullet point for each significant thing that was built}
- {include design decisions and trade-offs}
- {if something from the acceptance criteria was NOT done, note it explicitly as "⚠️ Not implemented: ..."}

**Key files:**
- `{relative path from workspace root}`
- `{relative path from workspace root}`
```

### Step 6 — Update the README
Open `d:\Projects\Zorviz\docs\backlog\README.md` and update the progress percentage and item count in the Phase Overview table for the affected phase.

### Step 7 — Confirm to the User
Report back with:
- The item ID that was completed
- A brief summary of what was found in the codebase
- Any acceptance criteria that were NOT implemented (so the user is aware)
- The updated item count for that phase

## Rules

- **Never fabricate implementation details.** Only write what you actually found by reading the codebase files.
- **Be honest about partial completion.** If only some acceptance criteria were met, note which ones are still missing using `⚠️ Not implemented:`.
- **Do not modify anything else** in the backlog files beyond the target item and the README table.
- **Preserve formatting** of both the backlog and completed files exactly.
- **Today's date** should be the actual current date from system context.
