# AGENTS.md

This repository is empty. Nothing to build, test, or run yet.

## Useful OpenCode Skills

| Skill | Install | Use |
|-------|---------|-----|
| [Obra Superpowers](https://github.com/obra/superpowers) | `"plugin": ["superpowers@git+https://github.com/obra/superpowers.git"]` in opencode.json | Full agentic SD methodology (brainstorm → plan → TDD → subagent → review) |
| [Vercel React Best Practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | `npx skills add https://github.com/vercel-labs/agent-skills --skill react-best-practices` | React/Next.js perf rules, waterfall detection, bundle-size, RSC/SSR checks |
| [Composio Skills + CLI](https://github.com/ComposioHQ/skills/tree/main/skills/composio) | `npx skills add composiohq/skills` + `curl -fsSL https://composio.dev/install \| bash` | 1000+ SaaS tools via CLI/MCP (GitHub, Linear, Slack, Stripe, etc.) |
| [Vault Daydream](https://github.com/glebis/claude-skills/tree/main/daydream) | `git clone https://github.com/glebis/claude-skills.git && cp -r claude-skills/daydream ~/.claude/skills/` | Multi-agent Obsidian vault mining — finds non-obvious note connections |
| [Anthropic Skill Creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator) | `npx skills add https://github.com/anthropics/skills --skill skill-creator` | Create, test, benchmark, and improve SKILL.md files |
| [Anthropic Frontend Design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | `npx skills add https://github.com/anthropics/skills --skill frontend-design` | Production UI with named aesthetic direction, typography, color, motion |
| [Anthropic MCP Builder](https://github.com/anthropics/skills/tree/main/skills/mcp-builder) | `npx skills add https://github.com/anthropics/skills --skill mcp-builder` | Build MCP servers with TS/Python SDK, Zod/Pydantic schemas, evals |
| [Cloudflare Skills](https://github.com/cloudflare/skills/tree/main/skills/cloudflare) | `npx skills add https://github.com/cloudflare/skills` | Workers, D1, R2, KV, AI, Wrangler, product decision trees |
| [stop-slop](https://github.com/hardikpandya/stop-slop) | `git clone https://github.com/hardikpandya/stop-slop.git ~/.agents/skills/stop-slop` | Clean AI-writing tells from docs, READMEs, release notes; 1–10 scoring rubric |
| [Anthropic Webapp Testing](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) | `npx skills add https://github.com/anthropics/skills --skill webapp-testing` | Playwright-based local web app testing with server lifecycle helper |
