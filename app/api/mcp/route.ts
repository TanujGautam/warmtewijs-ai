// Model Context Protocol server (Streamable HTTP transport, stateless, JSON responses).
// Exposes the same tools the in-app agent uses, so Claude Desktop / Claude Code /
// any MCP client can plan a house:  claude mcp add --transport http warmtewijs https://<host>/api/mcp
import { clientKey, rateLimit } from "@/lib/guardrails";
import { SKILLS } from "@/lib/skills";
import { executeTool, TOOL_DEFS } from "@/lib/tools";

const PROTOCOL_VERSION = "2025-06-18";
// `remember` is session memory for the web UI; it has no meaning over stateless MCP.
const MCP_TOOLS = TOOL_DEFS.filter((t) => t.name !== "remember");

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

function result(id: RpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function error(id: RpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function handle(msg: RpcRequest) {
  switch (msg.method) {
    case "initialize":
      return result(msg.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {}, prompts: {} },
        serverInfo: { name: "warmtewijs", version: "1.0.0" },
        instructions: "Independent energy advice for Dutch homes. Call calculate_plan for any numbers; load_skill for domain procedures.",
      });
    case "ping":
      return result(msg.id, {});
    case "tools/list":
      return result(msg.id, { tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema })) });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      if (!MCP_TOOLS.some((t) => t.name === name)) return error(msg.id, -32602, `Unknown tool: ${name}`);
      const out = executeTool(name, msg.params?.arguments ?? {}, {});
      return result(msg.id, { content: [{ type: "text", text: out.content }], isError: !!out.isError });
    }
    case "prompts/list":
      return result(msg.id, { prompts: SKILLS.map((s) => ({ name: s.name, description: s.description })) });
    case "prompts/get": {
      const s = SKILLS.find((x) => x.name === msg.params?.name);
      if (!s) return error(msg.id, -32602, "Unknown prompt");
      return result(msg.id, { description: s.description, messages: [{ role: "user", content: { type: "text", text: s.body } }] });
    }
    default:
      return error(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(req: Request) {
  if (!rateLimit(clientKey(req))) return Response.json(error(null, -32000, "Rate limited"), { status: 429 });
  let body: RpcRequest | RpcRequest[];
  try {
    body = await req.json();
  } catch {
    return Response.json(error(null, -32700, "Parse error"), { status: 400 });
  }
  const batch = Array.isArray(body) ? body : [body];
  // Notifications (no id) get no response body.
  const responses = batch.filter((m) => m.id !== undefined && m.id !== null).map(handle);
  if (!responses.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? responses : responses[0], { headers: { "MCP-Protocol-Version": PROTOCOL_VERSION } });
}

export async function GET() {
  // No server-initiated stream in this stateless server.
  return new Response("Method Not Allowed — POST JSON-RPC to this endpoint.", { status: 405, headers: { Allow: "POST" } });
}
