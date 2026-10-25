import { describe, expect, it } from "vitest";
import entry from "./index.js";
import { getToolPluginMetadata } from "openclaw/plugin-sdk/tool-plugin";

describe("augmentiq", () => {
  it("declares the 5 contract tools plus the consumer memory tool", () => {
    expect(getToolPluginMetadata(entry)?.tools.map((tool) => tool.name)).toEqual([
      "augmentiq_memory",
      "mcp_add_memory",
      "mcp_search_memory",
      "mcp_update_memory",
      "mcp_delete_memory",
      "mcp_get_audit_entry",
    ]);
  });

  it("declares a config schema with optional token and baseUrl", () => {
    const meta = getToolPluginMetadata(entry);
    expect(meta?.configSchema).toBeDefined();
    const props = (meta?.configSchema as { properties?: Record<string, unknown> })?.properties ?? {};
    expect(Object.keys(props).sort()).toEqual(["baseUrl", "token"]);
  });
});