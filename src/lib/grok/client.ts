/**
 * xAI Grok API Client
 *
 * Wrapper for calling xAI's Grok API with web search capabilities
 * to find current professional information about academics.
 *
 * Uses the /v1/responses endpoint with Agent Tools for web search.
 * Docs: https://docs.x.ai/docs/guides/tools/search-tools
 */

const XAI_BASE_URL = "https://api.x.ai/v1";
const API_TIMEOUT_MS = 300000; // 5 minutes timeout for web search

export interface GrokMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Response format for /v1/responses endpoint
export interface GrokResponsesAPIResponse {
  id: string;
  output: Array<{
    type: string;
    // For type: "message"
    content?: Array<{
      type: string;
      text?: string;
    }>;
    // Legacy formats
    text?: string;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

export interface GrokAPIError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

/**
 * Call Grok API with web search enabled via Agent Tools
 *
 * Uses grok-4-0709 model with high search context for thorough LinkedIn discovery.
 * Includes timeout and retry logic for reliability.
 *
 * @param messages - Array of system and user messages
 * @returns Parsed JSON response from Grok
 * @throws Error if API call fails or returns invalid response
 */
export async function callGrokAPI(messages: GrokMessage[]): Promise<any> {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    throw new Error("XAI_API_KEY environment variable is not set");
  }

  // Convert messages to input format, combining system + user into instructions + input
  const systemMessage = messages.find(m => m.role === 'system');
  const userMessage = messages.find(m => m.role === 'user');

  if (!userMessage) {
    throw new Error("User message is required");
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    console.log('[Grok API] Sending request to grok-4-0709 with web search...');

    const response = await fetch(`${XAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "grok-4-0709",
        // System instructions
        instructions: systemMessage?.content || "",
        // User input
        input: userMessage.content,
        // Enable web search tool
        tools: [
          { type: "web_search" }
        ],
        // Request JSON output
        text: {
          format: {
            type: "json_object"
          }
        }
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Try to parse error as JSON, fallback to text
      const errorText = await response.text();
      let errorMessage = errorText;

      try {
        const errorData = JSON.parse(errorText) as GrokAPIError;
        errorMessage = errorData.error?.message || errorText;
      } catch {
        // Not JSON, use raw text
      }

      throw new Error(
        `xAI API error (${response.status}): ${errorMessage}`
      );
    }

    const data = await response.json() as GrokResponsesAPIResponse;

    // Log search calls for debugging
    const searchCalls = data.output?.filter(o => o.type === 'web_search_call');
    if (searchCalls?.length) {
      console.log(`[Grok API] Performed ${searchCalls.length} web searches`);
    }

    // Find the message output from the response
    // The response structure is: output[].type === "message" -> content[].type === "output_text" -> text
    const messageOutput = data.output?.find(o => o.type === 'message');

    let messageContent: string | undefined;

    if (messageOutput?.content && Array.isArray(messageOutput.content)) {
      // New format: content is an array with output_text items
      const textItem = messageOutput.content.find(c => c.type === 'output_text');
      messageContent = textItem?.text;
    } else if (typeof messageOutput?.content === 'string') {
      // Legacy format: content is a string
      messageContent = messageOutput.content;
    } else if (messageOutput?.text) {
      // Alternative format: text field directly
      messageContent = messageOutput.text;
    }

    if (!messageContent) {
      console.error('[Grok API] Full response:', JSON.stringify(data, null, 2));
      throw new Error("xAI API returned no text content");
    }

    // Log the response for debugging
    console.log('[Grok API] Response content (first 500 chars):', messageContent.substring(0, 500));

    // Parse the JSON response
    try {
      return JSON.parse(messageContent);
    } catch (parseError) {
      console.error('[Grok API] Failed to parse response:', messageContent);
      throw new Error(
        `Failed to parse xAI API JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Content: ${messageContent.substring(0, 200)}`
      );
    }
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`xAI API request timed out after ${Math.round(API_TIMEOUT_MS / 60000)} minutes`);
    }

    // Re-throw fetch errors with more context
    if (error instanceof Error) {
      if (error.message.includes("fetch") || error.message.includes("ECONNRESET")) {
        throw new Error(`Network error calling xAI API: ${error.message}`);
      }
      throw error;
    }
    throw new Error("Unknown error calling xAI API");
  }
}
