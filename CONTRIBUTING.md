# Contributing to KubeMQ JS/TS SDK

Thank you for your interest in contributing to the KubeMQ JS/TS SDK! This document covers the development setup, coding standards, and pull request guidelines.

## Development Setup

### Prerequisites

- Node.js 20+ (22 LTS recommended)
- npm 10+
- A running KubeMQ server for integration tests (optional for unit tests)

### Getting Started

```bash
git clone https://github.com/kubemq-io/kubemq-js.git
cd kubemq-js
npm install
npm run build
npm test
```

### Available Scripts

| Script                     | Description                                              |
| -------------------------- | -------------------------------------------------------- |
| `npm run build`            | Compile TypeScript (ESM + CJS dual build via tsup)       |
| `npm run build:check`      | Type-check without emitting files                        |
| `npm test`                 | Run unit tests                                           |
| `npm run test:unit`        | Run unit tests (alias)                                   |
| `npm run test:watch`       | Run unit tests in watch mode                             |
| `npm run test:coverage`    | Run unit tests with coverage report                      |
| `npm run test:integration` | Run integration tests (requires a running KubeMQ server) |
| `npm run lint`             | Run ESLint with zero-warning threshold                   |
| `npm run lint:fix`         | Auto-fix ESLint issues                                   |
| `npm run format`           | Format code with Prettier                                |
| `npm run format:check`     | Check Prettier formatting without modifying files        |
| `npm run typecheck`        | Type-check the project (alias for `build:check`)         |

### Project Structure

```
kubemq-js/
├── src/                          # SDK source code
│   ├── index.ts                  # Public API barrel export
│   ├── client.ts                 # Unified KubeMQClient class
│   ├── options.ts                # ClientOptions and related configuration types
│   ├── errors.ts                 # Error hierarchy (19 classes)
│   ├── logger.ts                 # Logger interface and implementations
│   ├── version.ts                # SDK_VERSION constant
│   ├── auth/                     # Authentication (CredentialProvider, TLS)
│   ├── messages/                 # Message types per pattern (events, queues, commands, queries)
│   └── internal/                 # Internal implementation (not part of public API)
│       ├── transport/            # gRPC transport, connection state, reconnection
│       ├── middleware/           # Retry, error mapping, auth, telemetry
│       └── ...
├── __tests__/                    # Test suites
│   ├── unit/                     # Unit tests
│   └── integration/              # Integration tests (require KubeMQ server)
├── examples/                     # Usage examples for all messaging patterns
├── docs/                         # Documentation guides
├── dist/                         # Build output (generated)
└── ...
```

## Coding Standards

### TypeScript

- Strict mode is enabled (`strict: true` in `tsconfig.json`)
- All public APIs must have TSDoc comments following the conventions in the codebase
- Use `readonly` for immutable properties
- Prefer `interface` over `type` for object shapes
- Use `enum` (or `const` object + type) for fixed sets of related constants
- Do not use `any` — use `unknown` with runtime narrowing instead

### Naming Conventions

| Element             | Convention                   | Example                         |
| ------------------- | ---------------------------- | ------------------------------- |
| Files               | `kebab-case.ts`              | `connection-state.ts`           |
| Classes             | `PascalCase`                 | `KubeMQClient`                  |
| Interfaces          | `PascalCase` (no `I` prefix) | `ClientOptions`                 |
| Functions / methods | `camelCase`                  | `publishEvent()`                |
| Constants           | `UPPER_SNAKE_CASE`           | `DEFAULT_RETRY_POLICY`          |
| Enum members        | `PascalCase`                 | `EventStoreType.StartFromFirst` |

### Error Handling

- All errors must extend `KubeMQError`
- Never throw raw `Error` objects
- Never swallow errors with empty catch blocks
- Never use `console.log`, `console.error`, or `console.debug` — use the `Logger` interface
- Set `isRetryable` appropriately for each error type

### Import Conventions

- Use `.js` extensions in all relative import paths (required for ESM)
- Import types with `import type { ... }` when only used as type annotations
- Internal modules must not be imported by public-facing code except through `src/index.ts`

### Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint.

**Format:**

```
type(scope): description

[optional body]

[optional footer(s)]
```

**Types:**

| Type       | Description                       | Version Bump |
| ---------- | --------------------------------- | ------------ |
| `feat`     | New feature                       | MINOR        |
| `fix`      | Bug fix                           | PATCH        |
| `docs`     | Documentation only                | None         |
| `test`     | Test changes                      | None         |
| `chore`    | Build/tooling changes             | None         |
| `refactor` | Code refactoring (no feature/fix) | None         |
| `perf`     | Performance improvement           | None         |
| `ci`       | CI/CD changes                     | None         |
| `revert`   | Revert a previous commit          | None         |

**Scope:** module name, e.g., `errors`, `transport`, `queues`, `auth`

**Breaking changes:** Append `!` after type or add `BREAKING CHANGE:` footer:

```
feat!: redesign client API

BREAKING CHANGE: PubsubClient, CQClient, QueuesClient replaced by KubeMQClient
```

**Examples:**

```
feat(queues): add batch send support with partial failure reporting
fix(transport): prevent reconnection loop on auth failure
docs(readme): update quick-start examples for v3 API
test(errors): add unit tests for retry-exhausted error
chore(deps): update @grpc/grpc-js to 1.12.0
```

## Pull Request Guidelines

### Before Submitting

1. Run `npm run lint` — zero warnings required
2. Run `npm run format:check` — zero issues required
3. Run `npm test` — all tests must pass
4. Run `npm run build:check` — no type errors
5. Add tests for new functionality
6. Update documentation if public API changed

### PR Description

- Describe what changed and why
- Link to related issue (if applicable)
- List breaking changes (if any)
- Include before/after code if API changed

### Review Process

- All PRs require at least one review before merge
- PRs that modify public API require TSDoc on new/changed exports
- Breaking changes must be labeled in PR description
- CI must pass before merge (lint, format, type-check, tests)

## Release Process

Releases are automated via GitHub Actions. Only maintainers can create releases:

1. Update `CHANGELOG.md` with the new version entry
2. Run `npm version <major|minor|patch>` (this auto-syncs `SDK_VERSION` in `src/version.ts`)
3. Push with tags: `git push origin main --follow-tags`
4. The release pipeline runs automatically — monitor at [GitHub Actions](https://github.com/kubemq-io/kubemq-js/actions/workflows/release.yml)

### Pre-Release Versions

| Stage             | Format          | npm Tag  | Example         |
| ----------------- | --------------- | -------- | --------------- |
| Alpha             | `X.Y.Z-alpha.N` | `alpha`  | `3.0.0-alpha.1` |
| Beta              | `X.Y.Z-beta.N`  | `beta`   | `3.0.0-beta.1`  |
| Release Candidate | `X.Y.Z-rc.N`    | `rc`     | `3.0.0-rc.1`    |
| Stable            | `X.Y.Z`         | `latest` | `3.0.0`         |

## Reporting Issues

If you find a bug or have a feature request, please [open an issue](https://github.com/kubemq-io/kubemq-js/issues) with:

- A clear, descriptive title
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Node.js version and OS
- Relevant code snippets or error output

## License

By contributing, you agree that your contributions will be licensed under the [Apache 2.0 License](https://github.com/kubemq-io/kubemq-js/blob/main/LICENSE).
