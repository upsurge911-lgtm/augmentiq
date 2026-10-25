import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";

const DEFAULT_BASE_URL = "http://127.0.0.1:3710/mcp";

const NOT_CONFIGURED_HINT =
  "AugmentiQ is not configured: set plugins.augmentiq.token in the Gateway config " +
  '(prefer a SecretRef: {"$ref": "secrets://AUGMENTIQ_TOKEN"}). ' +
  "Copy the token from the Obsidian plugin — ribbon icon or Settings → Community Plugins → AugmentiQ.";

interface AugmentiQPluginConfig {
  token?: string;
  baseUrl?: string;
}

/** One MCP tools/call round-trip to the AugmentiQ Obsidian plugin's embedded server. */
async function callAugmentiQ(
  mcpToolName: string,
  args: Record<string, unknown>,
  config: AugmentiQPluginConfig,
  signal?: AbortSignal
): Promise<unknown> {
  const baseUrl = (config.baseUrl ?? "").trim() || DEFAULT_BASE_URL;
  if (!config.token) {
    throw new Error(NOT_CONFIGURED_HINT);
  }

  let res: Response;
  try {
    res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: mcpToolName, arguments: args },
      }),
      signal,
    });
  } catch (err) {
    const reason = (err as Error).name === "AbortError" ? "aborted" : (err as Error).message;
    if ((err as Error).name === "AbortError") throw err;
    throw new Error(
      `AugmentiQ MCP server unreachable at ${baseUrl} — is the AugmentiQ Obsidian plugin installed, enabled, and running? (${reason})`
    );
  }

  if (res.status === 401) {
    throw new Error(
      "AugmentiQ rejected the bearer token (401). Update plugins.augmentiq.token in the Gateway config — " +
        "regenerate the token from the Obsidian plugin settings if it changed."
    );
  }
  if (!res.ok) {
    throw new Error(`AugmentiQ MCP server returned HTTP ${res.status}.`);
  }

  const envelope = (await res.json()) as {
    error?: { code: number; message: string };
    result?: { content?: { type: string; text?: string }[] };
  };
  if (envelope.error) {
    throw new Error(`AugmentiQ error ${envelope.error.code}: ${envelope.error.message}`);
  }
  const text = envelope.result?.content?.[0]?.text ?? "null";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const recordSchema = Type.Object(
  {
    content: Type.String({ description: "The record content (the fact being remembered)." }),
  },
  {
    additionalProperties: true,
    description:
      "The AugmentIQ Context Record per references/record-schema.md §1 — " +
      "id, timestamp, scope, source, content, tags, classification, retention_policy, provenance, pii_patterns.",
  }
);

const deleteTypeSchema = Type.Union([
  Type.Literal("redact"),
  Type.Literal("destroy"),
  Type.Literal("erasure"),
]);

const classificationSchema = Type.Union([
  Type.Literal("public"),
  Type.Literal("internal"),
  Type.Literal("confidential"),
  Type.Literal("restricted"),
]);

const memoryTypeSchema = Type.Union([
  Type.Literal("observation"),
  Type.Literal("conclusion"),
  Type.Literal("preference"),
  Type.Literal("instruction"),
  Type.Literal("summary"),
]);

const memoryActionSchema = Type.Union([
  Type.Literal("recall"),
  Type.Literal("remember"),
  Type.Literal("forget"),
  Type.Literal("health"),
  Type.Literal("profile"),
  Type.Literal("consolidate"),
]);

export default defineToolPlugin({
  id: "augmentiq",
  name: "AugmentiQ",
  description:
    "Persistent agent memory in your Obsidian vault, via the AugmentiQ Obsidian plugin's embedded MCP server. " +
    "Exposes the 5 AugmentIQ contract tools (governance-skill compatible) plus the consumer memory loop tool. " +
    "100% local: the server binds 127.0.0.1 only, bearer-token auth, hash-chained audit log.",
  configSchema: Type.Object({
    token: Type.Optional(
      Type.String({
        description:
          "Bearer token for the AugmentiQ MCP server. Copy from the Obsidian plugin (ribbon icon or " +
          'Settings → AugmentiQ). Prefer a SecretRef: {"$ref": "secrets://AUGMENTIQ_TOKEN"}.',
      })
    ),
    baseUrl: Type.Optional(
      Type.String({
        description: `MCP endpoint URL. Default: ${DEFAULT_BASE_URL}`,
      })
    ),
  }),
  tools: (tool) => [
    tool({
      name: "augmentiq_memory",
      label: "AugmentIQ Memory",
      description:
        "The consumer memory loop: recall (search memories), remember (save a typed memory), forget " +
        "(archive, confirm required), health (stats + audit-chain verification), profile (read the vault's " +
        "profile.md), consolidate (non-destructive duplicate/stale analysis).",
      parameters: Type.Object({
        action: memoryActionSchema,
        query: Type.Optional(Type.String({ description: "recall: the search query." })),
        content: Type.Optional(Type.String({ description: "remember: what to remember." })),
        id: Type.Optional(Type.String({ description: "forget: the record id." })),
        confirm: Type.Optional(Type.Boolean({ description: "forget: must be true (records are archived, never silently deleted)." })),
        type: Type.Optional(memoryTypeSchema),
        importance: Type.Optional(Type.Number({ minimum: 1, maximum: 5, description: "remember: 1–5." })),
        scope: Type.Optional(Type.String({ description: "individual | team | department | organisation." })),
        tags: Type.Optional(Type.Array(Type.String())),
        classification: Type.Optional(classificationSchema),
        limit: Type.Optional(Type.Number({ description: "recall: max results (default 10)." })),
      }),
      async execute(args, config, context) {
        context.signal?.throwIfAborted();
        return callAugmentiQ("memory", args, config, context.signal);
      },
    }),
    tool({
      name: "mcp_add_memory",
      label: "AugmentIQ Add Memory",
      description:
        "Contract tool: add an AugmentIQ Context Record (governance skill flows use this). " +
        "The server writes the hash-chained audit entry automatically.",
      parameters: Type.Object({
        record: recordSchema,
        audit_hash: Type.Optional(Type.String()),
        request_id: Type.Optional(Type.String()),
      }),
      async execute(args, config, context) {
        context.signal?.throwIfAborted();
        return callAugmentiQ("mcp_add_memory", args, config, context.signal);
      },
    }),
    tool({
      name: "mcp_search_memory",
      label: "AugmentIQ Search Memory",
      description:
        "Contract tool: hybrid search over records — or the audit timeline via filters.action. " +
        "Empty query with a filter lists by that filter.",
      parameters: Type.Object({
        query: Type.String(),
        scope: Type.Optional(Type.String()),
        filters: Type.Optional(
          Type.Object(
            {
              classification: Type.Optional(Type.Array(classificationSchema)),
              tags: Type.Optional(Type.Array(Type.String())),
              action: Type.Optional(Type.String({ description: "timeline action name; '*' lists the audit log" })),
            },
            { additionalProperties: true }
          )
        ),
        limit: Type.Optional(Type.Number()),
        request_id: Type.Optional(Type.String()),
      }),
      async execute(args, config, context) {
        context.signal?.throwIfAborted();
        return callAugmentiQ("mcp_search_memory", args, config, context.signal);
      },
    }),
    tool({
      name: "mcp_update_memory",
      label: "AugmentIQ Update Memory",
      description:
        "Contract tool: update tags/classification, redact content (updates.redacted: true), or set retention_until.",
      parameters: Type.Object({
        record_id: Type.String(),
        updates: Type.Object(
          {
            tags: Type.Optional(Type.Array(Type.String())),
            classification: Type.Optional(classificationSchema),
            redacted: Type.Optional(Type.Boolean()),
            retention_until: Type.Optional(Type.String()),
          },
          { additionalProperties: true }
        ),
        audit_hash: Type.Optional(Type.String()),
        request_id: Type.Optional(Type.String()),
      }),
      async execute(args, config, context) {
        context.signal?.throwIfAborted();
        return callAugmentiQ("mcp_update_memory", args, config, context.signal);
      },
    }),
    tool({
      name: "mcp_delete_memory",
      label: "AugmentIQ Delete Memory",
      description:
        "Contract tool: delete_type redact (content redacted, audit hash preserved), destroy (content removed), " +
        "or erasure (GDPR Art. 17).",
      parameters: Type.Object({
        record_id: Type.String(),
        delete_type: deleteTypeSchema,
        audit_hash: Type.Optional(Type.String()),
        request_id: Type.Optional(Type.String()),
      }),
      async execute(args, config, context) {
        context.signal?.throwIfAborted();
        return callAugmentiQ("mcp_delete_memory", args, config, context.signal);
      },
    }),
    tool({
      name: "mcp_get_audit_entry",
      label: "AugmentIQ Audit Entry",
      description:
        "Contract tool: read back the latest hash-chained audit entry for a record (chain verification, Principle 5).",
      parameters: Type.Object({
        record_id: Type.String(),
      }),
      async execute(args, config, context) {
        context.signal?.throwIfAborted();
        return callAugmentiQ("mcp_get_audit_entry", args, config, context.signal);
      },
    }),
  ],
});