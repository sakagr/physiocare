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

## Implementation Walkthroughs

Whenever an implementation plan was approved and the resulting implementation is now complete, always ask the user whether they would like an implementation walkthrough document before ending the turn.
