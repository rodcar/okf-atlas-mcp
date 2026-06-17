import type { BundleGraph, GraphEdge, GraphNode, ParsedBundle, ValidationIssue } from "../models.js";
import { resolveLink } from "../parser/linkResolver.js";

export function buildGraph(parsedBundle: ParsedBundle): BundleGraph {
  const nodes: Record<string, GraphNode> = {};
  const warnings: ValidationIssue[] = [...parsedBundle.warnings];

  for (const file of parsedBundle.files) {
    if (nodes[file.concept_id]) {
      warnings.push({
        severity: "error",
        code: "DUPLICATE_CONCEPT_ID",
        message: `Duplicate concept ID: ${file.concept_id}`,
        path: file.path
      });
      continue;
    }
    nodes[file.concept_id] = {
      concept_id: file.concept_id,
      path: file.path,
      type: file.type,
      title: file.title,
      description: file.description,
      tags: file.tags,
      frontmatter: file.frontmatter,
      body_markdown: file.body_markdown,
      is_reserved: file.is_reserved
    };
  }

  const knownConceptIds = new Set(Object.keys(nodes));
  const edges: GraphEdge[] = [];

  for (const file of parsedBundle.files) {
    for (const link of file.links) {
      const resolution = resolveLink(file.concept_id, link.href, knownConceptIds);
      const edge: GraphEdge = {
        source_id: file.concept_id,
        target_id: resolution.target_id,
        raw_href: link.href,
        label: link.label,
        resolved: resolution.resolved,
        external: resolution.external
      };
      edges.push(edge);

      if (!edge.external && !edge.resolved) {
        warnings.push({
          severity: "warning",
          code: "BROKEN_LINK",
          message: "Link target does not exist.",
          path: file.path,
          href: link.href
        });
      }
    }
  }

  const backlinks: Record<string, GraphEdge[]> = {};
  for (const conceptId of Object.keys(nodes)) {
    backlinks[conceptId] = [];
  }
  for (const edge of edges) {
    if (edge.resolved && edge.target_id) {
      backlinks[edge.target_id] ??= [];
      backlinks[edge.target_id].push(edge);
    }
  }

  const types: Record<string, string[]> = {};
  const tags: Record<string, string[]> = {};

  for (const node of Object.values(nodes)) {
    if (node.is_reserved) {
      continue;
    }
    if (node.type) {
      types[node.type] ??= [];
      types[node.type].push(node.concept_id);
    }
    for (const tag of node.tags) {
      tags[tag] ??= [];
      tags[tag].push(node.concept_id);
    }
  }

  return {
    bundle_id: parsedBundle.bundle_id,
    source_url: parsedBundle.source_url,
    root_path: parsedBundle.root_path,
    nodes,
    edges,
    backlinks,
    types,
    tags,
    warnings
  };
}
