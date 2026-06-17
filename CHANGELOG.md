# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-17

### Added

- Initial TypeScript MCP server for navigating OKF knowledge bundles.
- GitHub tree URL bundle loading with local cache support.
- GitHub App authentication support for private GitHub OKF bundle repositories.
- Runtime multi-bundle loading with `okf_load_bundle`.
- MCP tools, resources, and prompt for listing, searching, reading, and validating OKF bundles.
- In-memory graph API with lexical search, links, backlinks, tags, and types.
- Vitest coverage for parsing, loading, graph behavior, MCP tools, and CLI parsing.
