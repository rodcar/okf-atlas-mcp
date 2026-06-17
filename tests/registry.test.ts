import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loadBundleFromUrl } from "../src/bundles/loadBundle.js";
import { OkfBundleRegistry } from "../src/bundles/registry.js";
import { buildGraph } from "../src/graph/builder.js";
import { InMemoryOkfGraphApi } from "../src/graph/memoryGraph.js";
import { parseOkfBundle } from "../src/parser/okfParser.js";

const samplePath = path.resolve("tests/fixtures/sample_bundle");
const secondPath = path.resolve("tests/fixtures/second_bundle");

describe("OkfBundleRegistry", () => {
  let registry: OkfBundleRegistry;

  beforeEach(() => {
    registry = new OkfBundleRegistry();
  });

  it("lists and retrieves multiple bundle APIs", async () => {
    registry.addBundle(await entryForFixture(samplePath, "fixture://sample"));
    registry.addBundle(await entryForFixture(secondPath, "fixture://second"));

    expect(registry.listBundles().map((bundle) => bundle.bundle_id)).toEqual(["sample_bundle", "second_bundle"]);
    expect(registry.requireApi("second_bundle").searchConcepts({ query: "warehouse" }).results[0]?.concept_id).toBe(
      "domains/warehouse"
    );
  });

  it("rejects duplicate bundle IDs", async () => {
    registry.addBundle(await entryForFixture(samplePath, "fixture://sample"));

    expect(() => registry.addBundle({
      bundle_id: "sample_bundle",
      source_url: "fixture://duplicate",
      api: registry.requireApi("sample_bundle")
    })).toThrow("Bundle is already loaded: sample_bundle");
  });

  it("throws explicit unknown bundle errors", () => {
    expect(() => registry.requireApi("missing_bundle")).toThrow("Bundle does not exist: missing_bundle");
  });
});

describe("loadBundleFromUrl", () => {
  it("validates supported URL format before loading", async () => {
    await expect(
      loadBundleFromUrl({
        bundleUrl: "https://example.com/not-supported",
        cacheDir: "tests/.tmp/unsupported"
      })
    ).rejects.toThrow("Unsupported bundle URL host");
  });
});

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
