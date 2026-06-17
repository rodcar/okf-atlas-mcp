# okf-atlas-mcp

[![CI](https://github.com/rodcar/okf-atlas-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/rodcar/okf-atlas-mcp/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

`okf-atlas-mcp` is a TypeScript MCP server for navigating OKF knowledge bundles.

It loads OKF bundles from GitHub tree URLs, parses Markdown concepts and YAML frontmatter, builds local in-memory graphs, and exposes MCP tools/resources so agents can inspect, search, and navigate the bundles without loading the entire knowledge base into context.

## Why

OKF is the source of truth. This server treats each loaded OKF bundle as a navigable graph:

```text
OKF bundle URL
  -> download bundle
  -> parse Markdown + YAML frontmatter
  -> build local concept graph
  -> expose MCP resources and tools
  -> agent navigates concepts
```

The server does not execute domain-specific queries. For example, the Bitcoin OKF bundle can explain tables, schemas, and relationships, but BigQuery execution should be handled by a separate tool.

## Requirements

- Node.js 20 or newer
- npm
- An MCP client such as Claude Desktop or Claude Code

## Install From Source

```bash
git clone https://github.com/rodcar/okf-atlas-mcp.git
cd okf-atlas-mcp
npm ci
npm run build
```

Run locally:

```bash
node dist/cli.js --bundle-url "https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf/bundles/crypto_bitcoin"
```

During development:

```bash
npm run dev -- --bundle-url "https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf/bundles/crypto_bitcoin"
```

## Future npm Usage

The package is prepared for npm publication, but publishing is not automated yet. After publication, usage will look like:

```bash
npx okf-atlas-mcp --bundle-url "https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf/bundles/crypto_bitcoin"
```

## CLI

Start empty and let the agent load bundles at runtime:

```bash
okf-atlas-mcp
```

Start with one bundle:

```bash
okf-atlas-mcp --bundle-url "https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf/bundles/crypto_bitcoin"
```

Start with multiple bundles:

```bash
okf-atlas-mcp \
  --bundle-url "https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf/bundles/crypto_bitcoin" \
  --bundle-url "https://github.com/example/repo/tree/main/okf/bundles/another_bundle"
```

Options:

```bash
okf-atlas-mcp \
  --bundle-url <url> \
  --bundle-url <url> \
  --cache-dir .okf-cache \
  --refresh false \
  --server-name okf-atlas-mcp
```

`--bundle-url` can be repeated and is optional. If omitted, use `okf_load_bundle` from the MCP client.

## Claude Desktop

Edit your Claude Desktop MCP config.

On macOS:

```text
~/Library/Application Support/Claude/claude_desktop_config.json
```

Start empty:

```json
{
  "mcpServers": {
    "okf-atlas-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/okf-atlas-mcp/dist/cli.js"
      ]
    }
  }
}
```

Start with a preloaded bundle:

```json
{
  "mcpServers": {
    "okf-atlas-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/okf-atlas-mcp/dist/cli.js",
        "--bundle-url",
        "https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf/bundles/crypto_bitcoin",
        "--cache-dir",
        "/absolute/path/to/okf-atlas-mcp/.okf-cache"
      ]
    }
  }
}
```

If Claude Desktop cannot find `node`, replace `"command": "node"` with the absolute path from `which node`.

### Private GitHub Repositories

For private repositories, configure a GitHub App with read-only repository contents access and pass the app credentials to the MCP server environment. The user still provides normal GitHub tree URLs; credentials are never passed through MCP tool arguments.

Claude Desktop example:

```json
{
  "mcpServers": {
    "okf-atlas-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/okf-atlas-mcp/dist/cli.js"
      ],
      "env": {
        "GITHUB_APP_ID": "123456",
        "GITHUB_APP_PRIVATE_KEY_PATH": "/secure/path/okf-atlas-mcp.private-key.pem"
      }
    }
  }
}
```

You can also use `GITHUB_APP_PRIVATE_KEY` for an inline PEM value. If using JSON config, encode newlines as `\n`.

GitHub admin setup:

1. Create a GitHub App.
2. Grant repository permission `Contents: Read-only`.
3. Install the app only on repositories that contain OKF bundles.
4. Generate a private key for the app.
5. Provide `GITHUB_APP_ID` and either `GITHUB_APP_PRIVATE_KEY_PATH` or `GITHUB_APP_PRIVATE_KEY` to the MCP server process.

When these variables are present, `okf-atlas-mcp` auto-discovers the app installation for each requested repository and downloads through GitHub's API zipball endpoint. Public unauthenticated loading continues to work when the variables are absent.

## Runtime Bundle Loading

Ask your MCP client to call:

```json
{
  "bundle_url": "https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf/bundles/crypto_bitcoin",
  "refresh": false
}
```

with the tool:

```text
okf_load_bundle
```

The loaded bundle is session-only. It stays available until the MCP server process exits. Downloaded archives are cached locally under `--cache-dir`.

## MCP Tools

- `okf_list_bundles({})`
- `okf_load_bundle({ bundle_url, refresh? })`
- `okf_bundle_overview({ bundle_id })`
- `okf_list_concepts({ bundle_id, type?, tag?, limit?, offset? })`
- `okf_get_concept({ bundle_id, concept_id, include_body?, include_links?, include_backlinks? })`
- `okf_get_index({ bundle_id, include_body?, include_links?, include_backlinks? })`
- `okf_search_concepts({ bundle_id, query, type?, tag?, limit? })`
- `okf_get_neighbors({ bundle_id, concept_id, direction?, depth? })`
- `okf_get_backlinks({ bundle_id, concept_id, limit? })`
- `okf_validate_bundle({ bundle_id })`

## MCP Resources

- `okf://{bundle_id}/`
- `okf://{bundle_id}/{concept_id}`

## MCP Prompt

- `navigate_okf_bundle`

## Example Agent Flow

```text
User: What concepts are related to transactions?

Agent:
1. okf_list_bundles()
2. If needed, okf_load_bundle(bundle_url="https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf/bundles/crypto_bitcoin")
3. okf_get_index(bundle_id="crypto_bitcoin")
4. okf_search_concepts(bundle_id="crypto_bitcoin", query="transactions")
5. okf_get_concept(bundle_id="crypto_bitcoin", concept_id="tables/transactions")
6. okf_get_neighbors(bundle_id="crypto_bitcoin", concept_id="tables/transactions", direction="both")
7. Answer using concept body and linked concepts.
```

## Development

Install:

```bash
npm ci
```

Run checks:

```bash
npm run typecheck
npm test
npm run build
```

Run all checks:

```bash
npm run check
```

Preview the npm package:

```bash
npm pack --dry-run
```

## Security And Privacy

`okf-atlas-mcp` downloads user-provided GitHub bundle URLs and stores archives in the configured local cache directory. Only load bundles from sources you trust.

For private repositories, keep GitHub App credentials in environment variables or a secret manager. Do not paste tokens, private keys, or installation tokens into prompts or MCP tool arguments.

The server does not send bundle contents to any service by itself. Your MCP client decides what context is sent to a model.

Report security issues privately. See [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
