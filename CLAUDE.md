# CLAUDE.md

This project's engineering and architecture conventions are documented in [AGENTS.md](AGENTS.md). Read and follow it in full before making any changes.

## Review Documents

Architecture reviews, design reviews, implementation plans, and implementation walkthrough reviews must be written to a temporary markdown file rather than only output as chat text. Place the file in the session scratchpad directory (not tracked in the repository) and tell the user its path.

## Implementation Walkthroughs

Whenever an implementation plan was approved and the resulting implementation is now complete, always ask the user whether they would like an implementation walkthrough document before ending the turn.
