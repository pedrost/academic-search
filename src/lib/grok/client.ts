/**
 * xAI Grok API Client
 *
 * Wrapper for calling xAI's Grok API with web search capabilities
 * to find current professional information about academics.
 */

const XAI_BASE_URL = "https://api.x.ai/v1";

export interface GrokMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GrokAPIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
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
 * Call Grok API with web search and X search tools enabled
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

  try {
    const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-3",
        messages,
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json() as GrokAPIError;
      throw new Error(
        `xAI API error (${response.status}): ${errorData.error?.message || response.statusText}`
      );
    }

    const data = await response.json() as GrokAPIResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new Error("xAI API returned no choices");
    }

    const messageContent = data.choices[0].message.content;

    if (!messageContent) {
      throw new Error("xAI API returned empty message content");
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
    // Re-throw fetch errors with more context
    if (error instanceof Error) {
      if (error.message.includes("fetch")) {
        throw new Error(`Network error calling xAI API: ${error.message}`);
      }
      throw error;
    }
    throw new Error("Unknown error calling xAI API");
  }
}
