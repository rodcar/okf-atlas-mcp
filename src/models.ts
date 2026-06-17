export type NeighborDirection = "outbound" | "backlinks" | "both";
export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
  href?: string;
  severity: ValidationSeverity;
}

export interface MarkdownLink {
  href: string;
  label: string | null;
}

export interface ParsedMarkdownFile {
  concept_id: string;
  path: string;
  type: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  frontmatter: Record<string, unknown>;
  body_markdown: string;
  is_reserved: boolean;
  links: MarkdownLink[];
  warnings: ValidationIssue[];
}

export interface ParsedBundle {
  bundle_id: string;
  source_url: string;
  root_path: string;
  files: ParsedMarkdownFile[];
  warnings: ValidationIssue[];
}

export interface GraphNode {
  concept_id: string;
  path: string;
  type: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  frontmatter: Record<string, unknown>;
  body_markdown: string;
  is_reserved: boolean;
}

export interface GraphEdge {
  source_id: string;
  target_id: string | null;
  raw_href: string;
  label: string | null;
  resolved: boolean;
  external: boolean;
}

export interface BundleGraph {
  bundle_id: string;
  source_url: string;
  root_path: string;
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
  backlinks: Record<string, GraphEdge[]>;
  types: Record<string, string[]>;
  tags: Record<string, string[]>;
  warnings: ValidationIssue[];
}

export interface BundleOverview {
  bundle_id: string;
  source_url: string;
  concept_count: number;
  edge_count: number;
  types: Array<{ type: string; count: number }>;
  tags: Array<{ tag: string; count: number }>;
  root_index_available: boolean;
}

export interface ConceptSummary {
  concept_id: string;
  title: string | null;
  type: string | null;
  description: string | null;
  tags: string[];
}

export interface ConceptListResult {
  items: ConceptSummary[];
  total: number;
}

export interface ConceptDetail extends GraphNode {
  outbound_links?: GraphEdge[];
  backlinks?: GraphEdge[];
}

export interface SearchResultItem extends ConceptSummary {
  score: number;
  match_reason: string;
}

export interface SearchResult {
  results: SearchResultItem[];
}

export interface NeighborhoodResult {
  concept_id: string;
  nodes: ConceptSummary[];
  edges: GraphEdge[];
}

export interface BacklinkItem {
  source_id: string;
  source_title: string | null;
  label: string | null;
  raw_href: string;
}

export interface BacklinkResult {
  concept_id: string;
  backlinks: BacklinkItem[];
}

export interface LinkResolutionResult {
  from_concept_id: string;
  href: string;
  target_id: string | null;
  resolved: boolean;
  external: boolean;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ListConceptsOptions {
  type?: string | null;
  tag?: string | null;
  limit?: number;
  offset?: number;
}

export interface GetConceptOptions {
  conceptId: string;
  includeBody?: boolean;
  includeLinks?: boolean;
  includeBacklinks?: boolean;
}

export interface SearchConceptsOptions {
  query: string;
  type?: string | null;
  tag?: string | null;
  limit?: number;
}

export interface GetNeighborsOptions {
  conceptId: string;
  direction?: NeighborDirection;
  depth?: number;
}

export interface GetBacklinksOptions {
  conceptId: string;
  limit?: number;
}

export interface ResolveLinkOptions {
  fromConceptId: string;
  href: string;
}
