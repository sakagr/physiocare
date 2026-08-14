# CLAUDE.md

This project's engineering and architecture conventions are documented in [AGENTS.md](AGENTS.md). Read and follow it in full before making any changes.

## Phase Implementation Steps

Implementing any phase follows four steps, in order:

1. **Existing architecture and design review** — review the documentation and the codebase for what the phase needs and what is missing.
2. **Implementation plan review.**
3. **Implementation** — begins only after the implementation plan is approved.
4. **Implementation walkthrough review.**

## Review Documents

Architecture reviews, design reviews, implementation plans, and implementation walkthrough reviews must be written to a temporary markdown file rather than only output as chat text. Place the file in the session scratchpad directory (not tracked in the repository) and tell the user its path.

The document is the deliverable, not the chat message. Do not restate its contents in the chat window — no section-by-section summary, no reproducing its findings, tables, or reasoning. Reply with the file path plus a few lines at most: anything that needs a decision, and anything that contradicts what was asked. The user reads the document.

## Questions in Review and Plan Documents

When asking questions in review or plan documents, follow this structure for clarity and decision-making:

1. **Question** — A proper question sentence that clearly states what needs to be decided.
2. **Background** — A very brief explanation of why this question matters or what context the user needs to understand it.
3. **Options** — Present the available choices or approaches, each with a short description.
4. **Recommendations** — State which option(s) you recommend and provide brief reasoning for each recommendation.

This format ensures the user can quickly understand the decision needed, the reasoning behind it, and the recommended path forward.

## Implementation Plans

An implementation plan is structured as a **numbered list of tasks**, in the order they are to be done — the shape of a Jira story broken into tasks and sub-tasks, not a prose narrative.

- Each task is numbered (`1.`, `2.`, `3.` …) and titled with the outcome it produces.
- A task that is too large to verify in one pass is broken into numbered sub-tasks (`1.1`, `1.2` …). Break down only where it helps; a task that stands on its own stays a single item.
- Every task and sub-task carries a short description: what is being changed, which files or modules it touches, and how it is verified. Keep it to what someone picking up that task alone would need.
- Decisions, trade-offs, and rationale belong in their own section, referenced by task number — not woven through the task list.

The task list is the plan's spine. Anything that cannot be expressed as a task to be done belongs in a supporting section around it.

## Implementation Walkthroughs

Whenever an implementation plan was approved and the resulting implementation is now complete, always ask the user whether they would like an implementation walkthrough document before ending the turn.
