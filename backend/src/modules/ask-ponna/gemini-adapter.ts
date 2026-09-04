// Gemini ProviderAdapter (Specification v3, §1.3 — ALL Gemini-specific
// API/SDK logic lives in this ONE file, nowhere else). Calls Gemini's
// REST API directly via fetch (no SDK dependency) —
// POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
// Auth via the x-goog-api-key header. Function calling per Gemini's
// documented `tools: [{ functionDeclarations: [...] }]` request shape
// and `candidates[0].content.parts[].functionCall` response shape.
//
// If Gemini is ever swapped for another provider (Spec v3 §1.5,
// Acceptance Criterion #12), this file is deleted/replaced and nothing
// else changes — orchestrator.ts, tool-layer.ts, and every route/schema
// stay exactly as they are.

import { ChatMessage, ProviderAdapter, ProviderResponse, ToolCallRequest, ToolDefinition, ToolResult } from './provider-adapter';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiAdapter implements ProviderAdapter {
  readonly modelName: string;
  private readonly apiKey: string;

  constructor(modelName: string, apiKey: string) {
    this.modelName = modelName;
    this.apiKey = apiKey;
  }

  private toGeminiTools(tools: ToolDefinition[]) {
    if (tools.length === 0) return undefined;
    return [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      },
    ];
  }

  private toGeminiContents(systemPrompt: string, history: ChatMessage[], pendingToolResults?: ToolResult[]) {
    // Gemini has no separate "system" role on this endpoint version — the
    // system prompt is prepended as the first user-turn context instead,
    // a documented, standard pattern for this API.
    const contents: any[] = [{ role: 'user', parts: [{ text: `[SYSTEM INSTRUCTIONS]\n${systemPrompt}` }] }];

    for (const m of history) {
      contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
    }

    if (pendingToolResults && pendingToolResults.length > 0) {
      contents.push({
        role: 'user',
        parts: pendingToolResults.map((r) => ({
          functionResponse: { name: r.name, response: { result: r.result } },
        })),
      });
    }

    return contents;
  }

  async sendMessage(params: {
    systemPrompt: string;
    history: ChatMessage[];
    tools: ToolDefinition[];
    pendingToolResults?: ToolResult[];
  }): Promise<ProviderResponse> {
    const body = {
      contents: this.toGeminiContents(params.systemPrompt, params.history, params.pendingToolResults),
      tools: this.toGeminiTools(params.tools),
    };

    const res = await fetch(`${GEMINI_API_BASE}/${this.modelName}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 300)}`);
    }

    const data: any = await res.json();
    const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];

    const functionCallParts = parts.filter((p) => p.functionCall);
    if (functionCallParts.length > 0) {
      const toolCalls: ToolCallRequest[] = functionCallParts.map((p, i) => ({
        id: `${Date.now()}-${i}`, // Gemini's REST responses don't always include a stable call id; synthesized here, fine since it's only used to correlate within one turn
        name: p.functionCall.name,
        arguments: p.functionCall.args ?? {},
      }));
      return { type: 'tool_calls', toolCalls };
    }

    const text = parts.map((p) => p.text ?? '').join('');
    return { type: 'text', text };
  }
}
