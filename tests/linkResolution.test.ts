import { describe, expect, it } from "vitest";
import { resolveLink } from "../src/parser/linkResolver.js";

const knownConceptIds = new Set(["systems/app", "systems/api", "playbooks/incident"]);

describe("link resolution", () => {
  it("resolves bundle-absolute links", () => {
    expect(resolveLink("systems/app", "/systems/api.md", knownConceptIds)).toMatchObject({
      target_id: "systems/api",
      resolved: true,
      external: false
    });
  });

  it("resolves relative links", () => {
    expect(resolveLink("systems/app", "../playbooks/incident.md", knownConceptIds)).toMatchObject({
      target_id: "playbooks/incident",
      resolved: true
    });
  });

  it("marks external and broken links", () => {
    expect(resolveLink("systems/app", "https://example.com", knownConceptIds)).toMatchObject({
      target_id: null,
      resolved: false,
      external: true
    });
    expect(resolveLink("systems/app", "./missing.md", knownConceptIds)).toMatchObject({
      target_id: null,
      resolved: false,
      external: false
    });
  });
});
