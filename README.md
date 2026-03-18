> [!CAUTION]
>
> This project is WIP. Avoid using or contributing until the initial release.

# fCC AI Marketplace

A public marketplace of AI-powered plugins, skills, and agents for freeCodeCamp.

## Introduction

The fCC AI Marketplace is a public collection of AI-powered tooling for freeCodeCamp staff and maintainers. It provides modular plugins, skills, and agents that work with Claude Code as the primary platform, and with other AI coding tools (Codex CLI, OpenCode, Gemini CLI) via the [Agent Skills](https://agentskills.io) standard.

## Installation

### Quick Install (All Tools)

Install portable skills to your preferred AI coding tool:

```sh
npx skills add freeCodeCamp/fCC-AI-Marketplace
```

### Claude Code Full Plugin

For the complete experience including hooks, MCP servers, and agents:

```sh
claude --plugin-dir ./plugins/<plugin-name>
```

## Catalog: Plugins

| Plugin                                                    | Description                                                                  | Skills                     | Status |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------- | ------ |
| [fcc-spanish-curriculum](plugins/fcc-spanish-curriculum/) | Spanish curriculum pipeline — Carmen, Marcos, Curriculum. CEFR levels A1-C2. | carmen, marcos, curriculum | Active |

## Catalog: Skills

| Skill                              | Description                                                                                 | Status |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | ------ |
| [hello-world](skills/hello-world/) | Sample skill that responds with a friendly greeting and explains how the marketplace works. | Sample |

## Catalog: Agents

| Agent                                | Description                                                                         | Status |
| ------------------------------------ | ----------------------------------------------------------------------------------- | ------ |
| [hello-world](agents/hello-world.md) | Sample agent that demonstrates the agent definition format used in the marketplace. | Sample |

## Supported Tools

| Tool        | Skills | Full Plugins |
| ----------- | ------ | ------------ |
| Claude Code | Yes    | Yes          |
| Codex CLI   | Yes    | No           |
| OpenCode    | Yes    | No           |
| Gemini CLI  | Yes    | No           |

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on creating plugins, skills, and agents, including naming rules, the SKILL.md format, plugin structure, and PR expectations. Run `./validate.sh` before submitting a pull request.

## License

Copyright (c) freeCodeCamp. This project is licensed under the [BSD 3-Clause License](https://opensource.org/licenses/BSD-3-Clause).
