import { promises as fs } from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OkfBundleRegistry } from "../src/bundles/registry.js";
import { buildGraph } from "../src/graph/builder.js";
import { InMemoryOkfGraphApi } from "../src/graph/memoryGraph.js";
import { parseOkfBundle } from "../src/parser/okfParser.js";
import { createOkfMcpServer } from "../src/server.js";

const samplePath = path.resolve("tests/fixtures/sample_bundle");
const secondPath = path.resolve("tests/fixtures/second_bundle");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MCP server", () => {
  it("lists loaded bundles and routes searches by bundle_id", async () => {
    const client = await createClientWithFixtures();

    const bundles = await client.callTool({ name: "okf_list_bundles", arguments: {} });
    const sampleSearch = await client.callTool({
      name: "okf_search_concepts",
      arguments: {
        bundle_id: "sample_bundle",
        query: "Atlas API"
      }
    });
    const secondSearch = await client.callTool({
      name: "okf_search_concepts",
      arguments: {
        bundle_id: "second_bundle",
        query: "warehouse"
      }
    });

    expect((bundles.structuredContent as { bundles: Array<{ bundle_id: string }> }).bundles.map((item) => item.bundle_id)).toEqual([
      "sample_bundle",
      "second_bundle"
    ]);
    expect((sampleSearch.structuredContent as { results: Array<{ concept_id: string }> }).results[0]?.concept_id).toBe(
      "systems/api"
    );
    expect((secondSearch.structuredContent as { results: Array<{ concept_id: string }> }).results[0]?.concept_id).toBe(
      "domains/warehouse"
    );
  });

  it("requires bundle_id on bundle-specific tools", async () => {
    const client = await createClientWithFixtures();

    const result = await client.callTool({
      name: "okf_get_index",
      arguments: {}
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ type: "text" });
  });

  it("returns the reserved index file through okf_get_index with bundle_id", async () => {
    const client = await createClientWithFixtures();
    const result = await client.callTool({
      name: "okf_get_index",
      arguments: {
        bundle_id: "sample_bundle"
      }
    });

    expect(result.content[0]).toMatchObject({ type: "text" });
    expect((result.structuredContent as { concept_id: string; body_markdown: string }).concept_id).toBe("index");
    expect((result.structuredContent as { body_markdown: string }).body_markdown).toContain("Sample OKF Bundle");
  });

  it("reads overview and slash-containing concept resources by bundle", async () => {
    const client = await createClientWithFixtures();
    const overview = await client.readResource({ uri: "okf://second_bundle/" });
    const concept = await client.readResource({ uri: "okf://sample_bundle/systems/api" });

    expect(overview.contents[0]).toMatchObject({ text: expect.stringContaining("# second_bundle") });
    expect(concept.contents[0]).toMatchObject({ text: expect.stringContaining("Concept ID: `systems/api`") });
  });

  it("loads a dynamic bundle from URL and rejects duplicate dynamic loads", async () => {
    const cacheDir = path.resolve("tests/.tmp/server-dynamic-cache");
    await fs.rm(cacheDir, { recursive: true, force: true });
    const url = "https://github.com/owner/repo/tree/main/okf/bundles/dynamic_bundle";
    stubArchiveFetch("repo-main/okf/bundles/dynamic_bundle");
    const client = await createClientWithFixtures(new OkfBundleRegistry(), cacheDir);

    const loaded = await client.callTool({
      name: "okf_load_bundle",
      arguments: {
        bundle_url: url
      }
    });
    const duplicate = await client.callTool({
      name: "okf_load_bundle",
      arguments: {
        bundle_url: url
      }
    });

    expect((loaded.structuredContent as { bundle_id: string }).bundle_id).toBe("dynamic_bundle");
    expect(duplicate.isError).toBe(true);
    expect(duplicate.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Bundle is already loaded: dynamic_bundle")
    });
    await fs.rm(cacheDir, { recursive: true, force: true });
  });

  it("exposes the navigation prompt with multi-bundle guidance", async () => {
    const client = await createClientWithFixtures();
    const prompt = await client.getPrompt({ name: "navigate_okf_bundle" });

    expect(prompt.messages[0]?.content).toMatchObject({
      type: "text",
      text: expect.stringContaining("okf_list_bundles")
    });
  });
});

async function createClientWithFixtures(registry = new OkfBundleRegistry(), cacheDir = ".okf-cache"): Promise<Client> {
  if (!registry.hasBundle("sample_bundle") && cacheDir === ".okf-cache") {
    registry.addBundle(await entryForFixture(samplePath, "fixture://sample"));
    registry.addBundle(await entryForFixture(secondPath, "fixture://second"));
  }
  const server = createOkfMcpServer(registry, { cacheDir, serverName: "okf-atlas-mcp-test" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.1.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

async function entryForFixture(bundlePath: string, sourceUrl: string) {
  const parsed = await parseOkfBundle(bundlePath, { sourceUrl });
  const api = new InMemoryOkfGraphApi(buildGraph(parsed));
  const overview = api.getBundleOverview();
  return {
    bundle_id: overview.bundle_id,
    source_url: sourceUrl,
    api
  };
}

function stubArchiveFetch(bundleRoot: string): void {
  const zip = new AdmZip();
  zip.addFile(`${bundleRoot}/index.md`, Buffer.from("# Dynamic Bundle\n\nSee [dynamic concept](./concepts/dynamic.md)."));
  zip.addFile(
    `${bundleRoot}/concepts/dynamic.md`,
    Buffer.from("---\ntype: Dynamic\ntitle: Dynamic Concept\ntags: [dynamic]\n---\n\nRuntime-loaded content.")
  );
  const buffer = zip.toBuffer();

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    }))
  );
}
