/**
 * Signal: Claude API helper
 * Uses claude-agent-sdk query() with OAuth token for text completions.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes

/**
 * Simple text completion using the agent SDK.
 * @param {string} prompt - The user prompt
 * @param {object} opts - Options
 * @param {string} [opts.model] - Model to use (default: claude-sonnet-4-6)
 * @param {number} [opts.maxTurns] - Max turns (default: 1)
 * @param {number} [opts.timeoutMs] - Timeout in ms (default: 120000)
 * @returns {Promise<string>} The assistant text response
 */
export async function complete(prompt, { model = "claude-sonnet-4-6", maxTurns = 1, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const conversation = query({
      prompt,
      options: {
        model,
        maxTurns,
        tools: [],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        persistSession: false,
        abortController,
      },
    });

    let result = "";
    for await (const event of conversation) {
      if (event.type === "assistant") {
        for (const block of event.message?.content || []) {
          if (block.type === "text") {
            result += block.text;
          }
        }
      }
      if (event.type === "result") {
        if (event.subtype === "error") {
          throw new Error(`Claude query failed: ${event.result || "unknown error"}`);
        }
        break;
      }
    }

    if (!result) {
      throw new Error("Claude returned empty response");
    }

    return result.trim();
  } catch (err) {
    if (abortController.signal.aborted) {
      throw new Error(`Claude query timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
