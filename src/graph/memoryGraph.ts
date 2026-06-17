import type {
  BacklinkResult,
  BundleGraph,
  BundleOverview,
  ConceptDetail,
  ConceptListResult,
  ConceptSummary,
  GetBacklinksOptions,
  GetConceptOptions,
  GetNeighborsOptions,
  GraphEdge,
  GraphNode,
  LinkResolutionResult,
  ListConceptsOptions,
  NeighborhoodResult,
  ResolveLinkOptions,
  SearchConceptsOptions,
  SearchResult,
  ValidationReport
} from "../models.js";
import { resolveLink as resolveMarkdownLink } from "../parser/linkResolver.js";
import { searchNodes } from "../search/lexical.js";
import { validateBundle } from "../validation/validator.js";
import type { OkfGraphApi } from "./api.js";

export class InMemoryOkfGraphApi implements OkfGraphApi {
  constructor(private readonly graph: BundleGraph) {}

  getBundleOverview(): BundleOverview {
    return {
      bundle_id: this.graph.bundle_id,
      source_url: this.graph.source_url,
      concept_count: this.conceptNodes().length,
      edge_count: this.graph.edges.length,
      types: Object.entries(this.graph.types)
        .map(([type, conceptIds]) => ({ type, count: conceptIds.length }))
        .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)),
      tags: Object.entries(this.graph.tags)
        .map(([tag, conceptIds]) => ({ tag, count: conceptIds.length }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
      root_index_available: Boolean(this.graph.nodes.index)
    };
  }

  listConcepts(options: ListConceptsOptions = {}): ConceptListResult {
    const limit = clampLimit(options.limit ?? 50);
    const offset = Math.max(0, options.offset ?? 0);
    const filtered = this.conceptNodes().filter((node) => {
      if (options.type && node.type !== options.type) {
        return false;
      }
      if (options.tag && !node.tags.includes(options.tag)) {
        return false;
      }
      return true;
    });

    return {
      items: filtered.slice(offset, offset + limit).map(toConceptSummary),
      total: filtered.length
    };
  }

  getConcept(options: GetConceptOptions): ConceptDetail {
    const node = this.requireNode(options.conceptId);
    const detail: ConceptDetail = {
      ...node,
      body_markdown: options.includeBody === false ? "" : node.body_markdown
    };

    if (options.includeLinks !== false) {
      detail.outbound_links = this.outboundEdges(node.concept_id);
    }
    if (options.includeBacklinks !== false) {
      detail.backlinks = this.graph.backlinks[node.concept_id] ?? [];
    }

    return detail;
  }

  searchConcepts(options: SearchConceptsOptions): SearchResult {
    const limit = clampLimit(options.limit ?? 10);
    const nodes = this.conceptNodes().filter((node) => {
      if (options.type && node.type !== options.type) {
        return false;
      }
      if (options.tag && !node.tags.includes(options.tag)) {
        return false;
      }
      return true;
    });
    return {
      results: searchNodes(nodes, options.query, limit)
    };
  }

  getNeighbors(options: GetNeighborsOptions): NeighborhoodResult {
    const direction = options.direction ?? "both";
    const maxDepth = Math.max(1, Math.min(5, options.depth ?? 1));
    this.requireNode(options.conceptId);

    const visitedNodes = new Set<string>([options.conceptId]);
    const collectedEdges = new Map<string, GraphEdge>();
    let frontier = new Set<string>([options.conceptId]);

    for (let depth = 0; depth < maxDepth; depth += 1) {
      const nextFrontier = new Set<string>();
      for (const currentId of frontier) {
        const edges = this.edgesForDirection(currentId, direction);
        for (const edge of edges) {
          const edgeKey = `${edge.source_id}->${edge.target_id ?? edge.raw_href}:${edge.raw_href}`;
          collectedEdges.set(edgeKey, edge);
          const neighborId = edge.source_id === currentId ? edge.target_id : edge.source_id;
          if (neighborId && !visitedNodes.has(neighborId)) {
            visitedNodes.add(neighborId);
            nextFrontier.add(neighborId);
          }
        }
      }
      frontier = nextFrontier;
      if (frontier.size === 0) {
        break;
      }
    }

    visitedNodes.delete(options.conceptId);
    return {
      concept_id: options.conceptId,
      nodes: [...visitedNodes].map((conceptId) => toConceptSummary(this.requireNode(conceptId))),
      edges: [...collectedEdges.values()]
    };
  }

  getBacklinks(options: GetBacklinksOptions): BacklinkResult {
    const node = this.requireNode(options.conceptId);
    const limit = clampLimit(options.limit ?? 50);
    const backlinks = (this.graph.backlinks[node.concept_id] ?? []).slice(0, limit).map((edge) => {
      const source = this.graph.nodes[edge.source_id];
      return {
        source_id: edge.source_id,
        source_title: source?.title ?? null,
        label: edge.label,
        raw_href: edge.raw_href
      };
    });

    return {
      concept_id: node.concept_id,
      backlinks
    };
  }

  resolveLink(options: ResolveLinkOptions): LinkResolutionResult {
    this.requireNode(options.fromConceptId);
    return resolveMarkdownLink(options.fromConceptId, options.href, new Set(Object.keys(this.graph.nodes)));
  }

  validateBundle(): ValidationReport {
    return validateBundle(this.graph);
  }

  private conceptNodes(): GraphNode[] {
    return Object.values(this.graph.nodes)
      .filter((node) => !node.is_reserved)
      .sort((a, b) => a.concept_id.localeCompare(b.concept_id));
  }

  private requireNode(conceptId: string): GraphNode {
    const node = this.graph.nodes[conceptId];
    if (!node) {
      throw new Error(`Concept does not exist: ${conceptId}`);
    }
    return node;
  }

  private outboundEdges(conceptId: string): GraphEdge[] {
    return this.graph.edges.filter((edge) => edge.source_id === conceptId);
  }

  private edgesForDirection(conceptId: string, direction: "outbound" | "backlinks" | "both"): GraphEdge[] {
    const outbound = direction === "outbound" || direction === "both" ? this.outboundEdges(conceptId) : [];
    const backlinks = direction === "backlinks" || direction === "both" ? this.graph.backlinks[conceptId] ?? [] : [];
    return [...outbound, ...backlinks];
  }
}

function toConceptSummary(node: GraphNode): ConceptSummary {
  return {
    concept_id: node.concept_id,
    title: node.title,
    type: node.type,
    description: node.description,
    tags: node.tags
  };
}

function clampLimit(limit: number): number {
  return Math.max(0, Math.min(500, Math.floor(limit)));
}
