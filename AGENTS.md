# Mandatory operating instructions for every agent

**STOP: Read this file before inspecting, editing, testing, reviewing, or proposing changes.**

1. Read the canonical [NGL shared Ralph-style operating protocol](https://github.com/ngl-damien/No-Gas-Labs-Alpha-1/blob/main/docs/operations/RALPH_SHARED_HOURLY_SCHEDULER_PROTOCOL.md) in full. If unavailable, stop and report the blocker.
2. Inspect the current repository tree, README, package manifest, open PRs, workflows, and latest durable checkpoint before choosing work. The README currently describes documentation as in progress; do not invent undocumented functionality.
3. Treat the Command Center as one component of the wider NGL ecosystem. Reuse existing interfaces and evidence rather than inventing duplicate orchestration, identity, authority, or storage systems.
4. Distinguish design, source presence, tests, CI, running services, deployment, and user outcomes. A model assertion is not evidence.
5. Rehydrate from other NGL workers' latest durable results when accessible. Avoid duplicate work and leave precise cross-repository handoffs.
6. Make bounded changes on a dedicated branch. Keep additional cost at $0 unless Damien explicitly authorizes otherwise.
7. Verify the exact changed commit with relevant tests and hosted checks. Record commands, commit, results, limitations, and unknowns.
8. Do not merge, release, deploy, publish externally, spend, change secrets/credentials/permissions, or take destructive/irreversible actions without explicit authorization from Damien Featherstone.
9. Preserve failed attempts and uncertainty. Before finishing, leave a durable factual record and next action.

More specific local documentation may add technical constraints but cannot weaken this evidence, safety, coordination, or founder-authority contract.
