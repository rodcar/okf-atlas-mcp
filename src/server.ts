import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { loadBundleFromUrl } from "./bundles/loadBundle.js";
import type { OkfBundleRegistry } from "./bundles/registry.js";
import type { OkfGraphApi } from "./graph/api.js";
import type { ConceptDetail } from "./models.js";

export interface CreateOkfMcpServerOptions {
  cacheDir?: string;
  serverName?: string;
  version?: string;
}

export function createOkfMcpServer(registry: OkfBundleRegistry, options: CreateOkfMcpServerOptions = {}): McpServer {
  const cacheDir = options.cacheDir ?? ".okf-cache";
  const server = new McpServer({
    name: options.serverName ?? "okf-atlas-mcp",
    version: options.version ?? "0.1.0"
  });

  server.registerResource(
    "okf-bundle-overview",
    new ResourceTemplate("okf://{bundleId}/", { list: undefined }),
    {
      title: "OKF Bundle Overview",
      description: "High-level overview of the loaded OKF bundle.",
      mimeType: "text/markdown"
    },
    async (uri, variables) => {
      const api = registry.requireApi(variableToString(variables.bundleId));
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: renderBundleOverview(api)
          }
        ]
      };
    }
  );

  server.registerResource(
    "okf-concept",
    new ResourceTemplate("okf://{bundleId}/{+conceptId}", { list: undefined }),
    {
      title: "OKF Concept",
      description: "Markdown representation of an OKF concept or reserved navigation file.",
      mimeType: "text/markdown"
    },
    async (uri, variables) => {
      const bundleId = variableToString(variables.bundleId);
      const conceptId = decodeURIComponent(variableToString(variables.conceptId));
      const api = registry.requireApi(bundleId);
      const concept = api.getConcept({
        conceptId,
        includeBody: true,
        includeLinks: true,
        includeBacklinks: true
      });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: renderConceptResource(concept)
          }
        ]
      };
    }
  );

  server.registerTool(
    "okf_list_bundles",
    {
      title: "OKF List Bundles",
      description: "List OKF bundles currently loaded in this MCP server.",
      inputSchema: {}
    },
    async () => jsonToolResult({ bundles: registry.listBundles() })
  );

  server.registerTool(
    "okf_load_bundle",
    {
      title: "OKF Load Bundle",
      description: "Load an OKF bundle from a supported GitHub tree URL for this server session.",
      inputSchema: {
        bundle_url: z.string().url(),
        refresh: z.boolean().default(false)
      }
    },
    async ({ bundle_url, refresh = false }) => {
      const entry = await loadBundleFromUrl({ bundleUrl: bundle_url, cacheDir, refresh });
      registry.addBundle(entry);
      const api = registry.requireApi(entry.bundle_id);
      const report = api.validateBundle();
      return jsonToolResult({
        ...api.getBundleOverview(),
        validation_warnings: report.warnings
      });
    }
  );

  server.registerTool(
    "okf_bundle_overview",
    {
      title: "OKF Bundle Overview",
      description: "Return high-level information about the loaded OKF bundle.",
      inputSchema: {
        bundle_id: z.string()
      }
    },
    async ({ bundle_id }) => jsonToolResult(registry.requireApi(bundle_id).getBundleOverview())
  );

  server.registerTool(
    "okf_list_concepts",
    {
      title: "OKF List Concepts",
      description: "List OKF concepts with optional type or tag filtering.",
      inputSchema: {
        bundle_id: z.string(),
        type: z.string().nullable().optional(),
        tag: z.string().nullable().optional(),
        limit: z.number().int().min(0).max(500).default(50),
        offset: z.number().int().min(0).default(0)
      }
    },
    async ({ bundle_id, type = null, tag = null, limit = 50, offset = 0 }) =>
      jsonToolResult(registry.requireApi(bundle_id).listConcepts({ type, tag, limit, offset }))
  );

  server.registerTool(
    "okf_get_concept",
    {
      title: "OKF Get Concept",
      description: "Get a concept by ID.",
      inputSchema: {
        bundle_id: z.string(),
        concept_id: z.string(),
        include_body: z.boolean().default(true),
        include_links: z.boolean().default(true),
        include_backlinks: z.boolean().default(true)
      }
    },
    async ({ bundle_id, concept_id, include_body = true, include_links = true, include_backlinks = true }) =>
      jsonToolResult(
        registry.requireApi(bundle_id).getConcept({
          conceptId: concept_id,
          includeBody: include_body,
          includeLinks: include_links,
          includeBacklinks: include_backlinks
        })
      )
  );

  server.registerTool(
    "okf_get_index",
    {
      title: "OKF Get Index",
      description: "Get the bundle index.md navigation file.",
      inputSchema: {
        bundle_id: z.string(),
        include_body: z.boolean().default(true),
        include_links: z.boolean().default(true),
        include_backlinks: z.boolean().default(true)
      }
    },
    async ({ bundle_id, include_body = true, include_links = true, include_backlinks = true }) =>
      jsonToolResult(
        registry.requireApi(bundle_id).getConcept({
          conceptId: "index",
          includeBody: include_body,
          includeLinks: include_links,
          includeBacklinks: include_backlinks
        })
      )
  );

  server.registerTool(
    "okf_search_concepts",
    {
      title: "OKF Search Concepts",
      description: "Search for concepts relevant to a query.",
      inputSchema: {
        bundle_id: z.string(),
        query: z.string(),
        type: z.string().nullable().optional(),
        tag: z.string().nullable().optional(),
        limit: z.number().int().min(0).max(100).default(10)
      }
    },
    async ({ bundle_id, query, type = null, tag = null, limit = 10 }) =>
      jsonToolResult(registry.requireApi(bundle_id).searchConcepts({ query, type, tag, limit }))
  );

  server.registerTool(
    "okf_get_neighbors",
    {
      title: "OKF Get Neighbors",
      description: "Return related concepts through graph links.",
      inputSchema: {
        bundle_id: z.string(),
        concept_id: z.string(),
        direction: z.enum(["outbound", "backlinks", "both"]).default("both"),
        depth: z.number().int().min(1).max(5).default(1)
      }
    },
    async ({ bundle_id, concept_id, direction = "both", depth = 1 }) =>
      jsonToolResult(registry.requireApi(bundle_id).getNeighbors({ conceptId: concept_id, direction, depth }))
  );

  server.registerTool(
    "okf_get_backlinks",
    {
      title: "OKF Get Backlinks",
      description: "Return concepts that link to a concept.",
      inputSchema: {
        bundle_id: z.string(),
        concept_id: z.string(),
        limit: z.number().int().min(0).max(500).default(50)
      }
    },
    async ({ bundle_id, concept_id, limit = 50 }) =>
      jsonToolResult(registry.requireApi(bundle_id).getBacklinks({ conceptId: concept_id, limit }))
  );

  server.registerTool(
    "okf_validate_bundle",
    {
      title: "OKF Validate Bundle",
      description: "Return permissive validation warnings and errors.",
      inputSchema: {
        bundle_id: z.string()
      }
    },
    async ({ bundle_id }) => jsonToolResult(registry.requireApi(bundle_id).validateBundle())
  );

  server.registerPrompt(
    "navigate_okf_bundle",
    {
      title: "Navigate OKF Bundle",
      description: "Guide an agent to answer questions by navigating OKF tools instead of loading everything."
    },
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "You are navigating an OKF knowledge bundle through MCP tools.",
              "",
              "Do not assume the full bundle is already in context.",
              "",
              "For each user question:",
              "1. Call okf_list_bundles to see which bundles are loaded.",
              "2. If the needed bundle is missing and the user provides a URL, call okf_load_bundle.",
              "3. Pass bundle_id to every bundle-specific tool.",
              "4. Search for relevant concepts.",
              "5. Open the most relevant concept.",
              "6. Inspect neighbors and backlinks when relationships matter.",
              "7. Use concept frontmatter, body, links, and citations to answer.",
              "8. If information is missing or links are broken, say so clearly.",
              "9. Do not assume domain-specific execution tools exist unless provided separately."
            ].join("\n")
          }
        }
      ]
    })
  );

  return server;
}

export async function runStdioServer(registry: OkfBundleRegistry, options: CreateOkfMcpServerOptions = {}): Promise<void> {
  const server = createOkfMcpServer(registry, options);
  await server.connect(new StdioServerTransport());
}

function jsonToolResult(data: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ],
    structuredContent: data as Record<string, unknown>
  };
}

function renderBundleOverview(api: OkfGraphApi): string {
  const overview = api.getBundleOverview();
  const typeLines = overview.types.map((item) => `- ${item.type}: ${item.count}`).join("\n") || "- None";
  const tagLines = overview.tags.map((item) => `- ${item.tag}: ${item.count}`).join("\n") || "- None";
  return [
    `# ${overview.bundle_id}`,
    "",
    `Source URL: ${overview.source_url}`,
    `Concept count: ${overview.concept_count}`,
    `Edge count: ${overview.edge_count}`,
    `Root index available: ${overview.root_index_available}`,
    "",
    "## Types",
    "",
    typeLines,
    "",
    "## Tags",
    "",
    tagLines
  ].join("\n");
}

function renderConceptResource(concept: ConceptDetail): string {
  const title = concept.title ?? concept.concept_id;
  const tags = concept.tags.length > 0 ? concept.tags.join(", ") : "None";
  return [
    `# ${title}`,
    "",
    `Concept ID: \`${concept.concept_id}\``,
    `Path: \`${concept.path}\``,
    `Type: ${concept.type ?? "None"}`,
    `Tags: ${tags}`,
    concept.description ? `Description: ${concept.description}` : null,
    "",
    concept.body_markdown
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function variableToString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value.join("/");
  }
  if (!value) {
    return "";
  }
  return value;
}
