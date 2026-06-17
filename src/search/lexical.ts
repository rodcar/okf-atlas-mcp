import type { GraphNode, SearchResultItem } from "../models.js";

export function searchNodes(nodes: GraphNode[], query: string, limit: number): SearchResultItem[] {
  const normalizedQuery = normalize(query);
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return [];
  }

  return nodes
    .map((node) => scoreNode(node, normalizedQuery, terms))
    .filter((item): item is SearchResultItem => item !== null)
    .sort((a, b) => b.score - a.score || a.concept_id.localeCompare(b.concept_id))
    .slice(0, limit);
}

function scoreNode(node: GraphNode, normalizedQuery: string, terms: string[]): SearchResultItem | null {
  const title = normalize(node.title ?? "");
  const description = normalize(node.description ?? "");
  const type = normalize(node.type ?? "");
  const tags = normalize(node.tags.join(" "));
  const body = normalize(node.body_markdown);
  const conceptId = normalize(node.concept_id);
  const path = normalize(node.path);

  let score = 0;
  const reasons: string[] = [];

  if (conceptId === normalizedQuery) {
    score += 100;
    reasons.push("exact concept ID");
  }
  if (title === normalizedQuery && title.length > 0) {
    score += 90;
    reasons.push("exact title");
  }
  if (allTermsIn(terms, title)) {
    score += 70;
    reasons.push("title");
  }
  if (allTermsIn(terms, description)) {
    score += 50;
    reasons.push("description");
  }
  if (allTermsIn(terms, `${tags} ${type}`)) {
    score += 35;
    reasons.push("tags/type");
  }
  if (allTermsIn(terms, body)) {
    score += 20;
    reasons.push("body");
  }
  if (allTermsIn(terms, path)) {
    score += 10;
    reasons.push("path");
  }

  if (score === 0) {
    return null;
  }

  return {
    concept_id: node.concept_id,
    title: node.title,
    type: node.type,
    description: node.description,
    tags: node.tags,
    score,
    match_reason: `Matched ${reasons.join(", ")}.`
  };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^\p{Letter}\p{Number}/_ -]+/gu, " ").replace(/\s+/g, " ").trim();
}

function allTermsIn(terms: string[], haystack: string): boolean {
  return terms.every((term) => haystack.includes(term));
}
