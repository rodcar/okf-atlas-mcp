# Contributing

Thanks for your interest in improving `okf-atlas-mcp`.

## Development Setup

Requirements:

- Node.js 20 or newer
- npm

Install dependencies:

```bash
npm ci
```

Build and test:

```bash
npm run typecheck
npm test
npm run build
```

Run all checks:

```bash
npm run check
```

Start the server in development:

```bash
npm run dev -- --bundle-url "https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf/bundles/crypto_bitcoin"
```

## Pull Requests

- Keep changes focused and documented.
- Add or update tests for behavior changes.
- Run `npm run check` before opening a pull request.
- Update `README.md` or `CHANGELOG.md` when user-facing behavior changes.

## Issues

Use GitHub issues for bugs, feature requests, and design discussion. Include reproduction steps, expected behavior, actual behavior, and relevant bundle URLs when reporting bugs.

## License

By contributing, you agree that your contributions are licensed under the Apache License 2.0.
