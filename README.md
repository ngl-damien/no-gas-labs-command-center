# No_Gas_Labs™ Command Center

## Mandatory agent instructions

Every AI agent and automated contributor must read [AGENTS.md](AGENTS.md) before acting. It points to the shared NGL operating protocol and repository-specific evidence constraints. A GitHub Actions check verifies that the required entry points remain present.

No_Gas_Labs™ Command Center - Coordinating human intention with distributed technical systems.

## Installation

```bash
npm install
```

## Development

Install dependencies and start the UI plus the Command Center API together:

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The Vite UI listens on port `3000`; the Express Command Center API listens on `COMMAND_CENTER_PORT` (default `3003`). Vite forwards `/api/*` to `COMMAND_CENTER_API_URL` (default `http://127.0.0.1:3003`). The API then calls Node-Gate (`NODE_GATE_URL`, default port `3001`) and EvidenceOS (`EVIDENCEOS_URL`, default port `3002`). Those upstream services must be running separately; if they are down, the dashboard should report them as unavailable rather than claim they are operational.

Use `pnpm dev:ui` only when you intentionally want the UI without the local API process. Run `pnpm test`, `pnpm run check`, and `pnpm build` for verification. `pnpm start` serves the production build and API using `PORT` (default `3000`).

## License

See LICENSE file - No-Gas-Labs satirical license applies.

## Part of No-Gas-Labs™ Ecosystem

- [Command Center](https://github.com/No-Gas-Labs-Official/no-gas-labs-command-center)
- [AI Guild Protocol](https://github.com/No-Gas-Labs-Official/ai-guild-hardened-v0.2)
- [Flashware](https://github.com/No-Gas-Labs-Official/flashware-monorepo)

---
*Automated documentation deployment via Ninja AI Agent*
