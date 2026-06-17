#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { loadBundleFromUrl } from "./bundles/loadBundle.js";
import { OkfBundleRegistry } from "./bundles/registry.js";
import { runStdioServer } from "./server.js";

interface CliOptions {
  bundleUrl: string[];
  cacheDir: string;
  refresh: boolean;
  serverName: string;
}

export async function main(argv = process.argv): Promise<void> {
  const program = createCliProgram();
  program.parse(argv);
  const options = program.opts<CliOptions>();
  const registry = new OkfBundleRegistry();

  for (const bundleUrl of options.bundleUrl) {
    const entry = await loadBundleFromUrl({
      bundleUrl,
      cacheDir: options.cacheDir,
      refresh: options.refresh
    });
    registry.addBundle(entry);
  }

  await runStdioServer(registry, { cacheDir: options.cacheDir, serverName: options.serverName });
}

export function createCliProgram(): Command {
  const program = new Command();
  return program
    .name("okf-atlas-mcp")
    .description("MCP server for navigating OKF knowledge bundles.")
    .option("--bundle-url <url>", "URL to an OKF bundle. Can be provided multiple times.", collectValues, [])
    .option("--cache-dir <path>", "Local folder for downloaded bundles.", ".okf-cache")
    .option("--refresh <boolean>", "Re-download even if cached.", parseBoolean, false)
    .option("--server-name <name>", "Name exposed by the MCP server.", "okf-atlas-mcp");
}

function parseBoolean(value: string): boolean {
  const normalized = value.toLowerCase().trim();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }
  throw new Error(`Expected boolean value, received: ${value}`);
}

function collectValues(value: string, previous: string[]): string[] {
  return [...previous, value];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
