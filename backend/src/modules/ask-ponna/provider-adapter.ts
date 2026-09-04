// Provider Adapter interface (Specification v3, §1.2/§1.3, BINDING).
//
// This is the ONLY place in the entire codebase that any file outside
// this ask-ponna module is allowed to reference. Every provider
// (Gemini today, Claude/GPT/any future provider later) implements this
// SAME interface — the Orchestrator, the Tool Layer, PONNA's core
// systems, routes, and frontend never know or care which concrete
// adapter is behind it.
//
// A model swap (Spec v3 §1.5, Acceptance Criterion #12) means writing a
// new class that implements ProviderAdapter and pointing
// PlatformSettings.askPonnaProvider at it — nothing else in this file,
// nothing in tool-layer.ts, nothing in orchestrator.ts, and nothing
// outside this module needs to change.

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

/** A tool the provider MAY choose to call — matches the plain,
 * provider-neutral shape every major provider's function-calling
 * feature can be mapped to/from inside its own adapter. */
export type ToolDefinition = {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
};

export type ToolCallRequest = {
  id: string; // provider-issued call id, opaque outside the adapter
  name: string;
  arguments: Record<string, unknown>;
};

/** What sendMessage returns — either the provider wants to call one or
 * more tools (Orchestrator executes them via the Tool Layer and calls
 * sendMessage again with the results appended), or it has a final text
 * answer ready. Never both undefined. */
export type ProviderResponse =
  | { type: 'tool_calls'; toolCalls: ToolCallRequest[] }
  | { type: 'text'; text: string };

/** One executed tool's result, fed back to the provider on the next
 * sendMessage call — the adapter translates this generic shape into
 * whatever wire format that provider expects for a tool result. */
export type ToolResult = {
  toolCallId: string;
  name: string;
  result: unknown;
};

export interface ProviderAdapter {
  /** The exact model identifier in use (Spec v3 §7 — documented, never
   * hard-coded elsewhere; read from PlatformSettings.askPonnaModel). */
  readonly modelName: string;

  sendMessage(params: {
    systemPrompt: string;
    history: ChatMessage[];
    tools: ToolDefinition[];
    pendingToolResults?: ToolResult[]; // present only when continuing after tool execution
  }): Promise<ProviderResponse>;
}
