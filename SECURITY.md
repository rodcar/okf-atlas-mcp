# Security Policy

## Supported Versions

Security fixes are provided for the latest released version.

## Reporting a Vulnerability

Please report security vulnerabilities privately by emailing the project maintainer or by opening a private vulnerability report on GitHub if available.

Do not include exploit details in public issues.

## Security Notes

`okf-atlas-mcp` downloads user-provided GitHub bundle URLs and stores archives in the configured local cache directory. Only load bundles from sources you trust.

For private GitHub repositories, use a GitHub App with the minimum repository permission:

```text
Contents: Read-only
```

Install the app only on repositories that contain OKF bundles. Provide credentials to the MCP server through environment variables:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY_PATH` or `GITHUB_APP_PRIVATE_KEY`

Do not pass GitHub credentials in prompts or MCP tool arguments. Installation access tokens are generated in memory and are not persisted to disk.
