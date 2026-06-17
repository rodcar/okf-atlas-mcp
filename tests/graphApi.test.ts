import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { OkfGraphApi } from "../src/graph/api.js";
import { buildGraph } from "../src/graph/builder.js";
import { InMemoryOkfGraphApi } from "../src/graph/memoryGraph.js";
import { parseOkfBundle } from "../src/parser/okfParser.js";

const fixturePath = path.resolve("tests/fixtures/sample_bundle");

let api: OkfGraphApi;

beforeAll(async () => {
  const parsed = await parseOkfBundle(fixturePath, { sourceUrl: "fixture://sample" });
  api = new InMemoryOkfGraphApi(buildGraph(parsed));
});

describe("InMemoryOkfGraphApi", () => {
  it("returns bundle overview excluding reserved files from concept count", () => {
    const overview = api.getBundleOverview();

    expect(overview.bundle_id).toBe("sample_bundle");
    expect(overview.concept_count).toBe(5);
    expect(overview.root_index_available).toBe(true);
    expect(overview.types).toContainEqual({ type: "System", count: 1 });
  });

  it("lists concepts with type and tag filters", () => {
    expect(api.listConcepts({ type: "Service" }).items.map((item) => item.concept_id)).toEqual(["systems/api"]);
    expect(api.listConcepts({ tag: "atlas" }).total).toBe(2);
  });

  it("gets concept details with outbound links and backlinks", () => {
    const concept = api.getConcept({ conceptId: "systems/api" });

    expect(concept.title).toBe("Atlas API");
    expect(concept.outbound_links?.some((edge) => edge.target_id === "systems/app")).toBe(true);
    expect(concept.backlinks?.some((edge) => edge.source_id === "systems/app")).toBe(true);
  });

  it("searches and ranks compact results", () => {
    const results = api.searchConcepts({ query: "Atlas API", limit: 3 }).results;

    expect(results[0]?.concept_id).toBe("systems/api");
    expect(results[0]?.match_reason).toContain("title");
    expect(results[0]).not.toHaveProperty("body_markdown");
  });

  it("returns graph neighbors and backlinks", () => {
    const neighbors = api.getNeighbors({ conceptId: "systems/app", direction: "both", depth: 1 });
    const backlinks = api.getBacklinks({ conceptId: "systems/api" });

    expect(neighbors.nodes.map((node) => node.concept_id)).toContain("systems/api");
    expect(backlinks.backlinks.some((link) => link.source_id === "systems/app")).toBe(true);
  });

  it("resolves links through the stable API", () => {
    expect(api.resolveLink({ fromConceptId: "systems/app", href: "./api.md" })).toMatchObject({
      target_id: "systems/api",
      resolved: true
    });
  });

  it("returns permissive validation warnings", () => {
    const report = api.validateBundle();

    expect(report.valid).toBe(true);
    expect(report.warnings.some((warning) => warning.code === "BROKEN_LINK")).toBe(true);
    expect(report.warnings.some((warning) => warning.code === "MISSING_TYPE")).toBe(true);
  });
});
