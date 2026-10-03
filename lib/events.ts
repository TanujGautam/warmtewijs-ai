import type { ToolOutcome, Profile } from "./tools";

/** Events streamed from /api/chat to the browser as Server-Sent Events. */
export type AgentEvent =
  | { type: "status"; mode: "claude" | "offline"; model?: string }
  | { type: "text"; delta: string }
  | { type: "thinking"; delta: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; isError: boolean; preview: string; ui?: ToolOutcome["ui"] }
  | { type: "server_tool"; name: string; detail: string }
  | { type: "guardrail"; message: string }
  | { type: "memory"; profile: Profile }
  | { type: "history"; messages: unknown[] }
  | { type: "usage"; input: number; output: number; cacheRead: number; cacheWrite: number }
  | { type: "error"; message: string }
  | { type: "done" };
