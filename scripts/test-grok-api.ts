/**
 * Test script to debug Grok API calls
 *
 * Run with: npx tsx scripts/test-grok-api.ts
 */

import 'dotenv/config'
import { SYSTEM_PROMPT, buildUserPrompt } from '../src/lib/grok/prompts'

const XAI_BASE_URL = "https://api.x.ai/v1";
const API_TIMEOUT_MS = 300000; // 5 minutes timeout

async function testGrokAPI() {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    console.error("❌ XAI_API_KEY not set in environment");
    process.exit(1);
  }

  console.log("✅ API Key found");
  console.log("🔍 Testing with: ALEF FERNANDO BORILLE DOS SANTOS");
  console.log(`⏱️  Timeout: ${API_TIMEOUT_MS / 60000} minutes\n`);

  // Use the actual prompts from the app
  const userPrompt = buildUserPrompt({
    name: "ALEF FERNANDO BORILLE DOS SANTOS",
    institution: "UFMS",
    researchField: "Agronomia",
    graduationYear: null,
    dissertationTitle: null
  });

  console.log("📋 System Prompt (first 300 chars):");
  console.log(SYSTEM_PROMPT.substring(0, 300) + "...\n");

  console.log("📋 User Prompt (first 500 chars):");
  console.log(userPrompt.substring(0, 500) + "...\n");

  console.log("📤 Sending request to grok-4-0709 with web search...\n");

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const startTime = Date.now();

    const response = await fetch(`${XAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "grok-4-0709",
        instructions: SYSTEM_PROMPT,
        input: userPrompt,
        tools: [
          { type: "web_search" }
        ],
        text: {
          format: {
            type: "json_object"
          }
        }
      }),
    });

    clearTimeout(timeoutId);

    const elapsed = Date.now() - startTime;
    console.log(`⏱️  Response received in ${Math.round(elapsed / 1000)}s`);
    console.log(`📊 Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API Error Response:");
      console.error(errorText);
      return;
    }

    const data = await response.json();

    // Log search calls
    const searchCalls = data.output?.filter((o: any) => o.type === 'web_search_call');
    if (searchCalls?.length) {
      console.log(`🔎 Performed ${searchCalls.length} web searches`);
    }

    // Extract text content from the response
    const messageOutput = data.output?.find((o: any) => o.type === 'message');

    let messageContent: string | undefined;

    if (messageOutput?.content && Array.isArray(messageOutput.content)) {
      const textItem = messageOutput.content.find((c: any) => c.type === 'output_text');
      messageContent = textItem?.text;
    } else if (typeof messageOutput?.content === 'string') {
      messageContent = messageOutput.content;
    } else if (messageOutput?.text) {
      messageContent = messageOutput.text;
    }

    if (messageContent) {
      try {
        const parsed = JSON.parse(messageContent);
        console.log("\n✅ Parsed JSON Response:");
        console.log(JSON.stringify(parsed, null, 2));

        // Highlight key findings
        console.log("\n" + "=".repeat(50));
        console.log("🎯 KEY FINDINGS:");
        console.log("=".repeat(50));
        console.log(`   LinkedIn: ${parsed.social?.linkedinUrl || '❌ NOT FOUND'}`);
        console.log(`   Lattes: ${parsed.social?.lattesUrl || '❌ NOT FOUND'}`);
        console.log(`   Job: ${parsed.employment?.jobTitle || 'NOT FOUND'}`);
        console.log(`   Company: ${parsed.employment?.company || 'NOT FOUND'}`);
        console.log(`   Confidence: ${parsed.findings?.confidence || 'UNKNOWN'}`);
        console.log(`   Summary: ${parsed.findings?.summary || 'N/A'}`);
        console.log("=".repeat(50));
      } catch (e) {
        console.error("❌ Failed to parse as JSON:", e);
        console.log("Raw content:", messageContent);
      }
    } else {
      console.log("⚠️  No text content found in response");
      console.log("Output types:", data.output?.map((o: any) => o.type));
      console.log("Full response:", JSON.stringify(data, null, 2));
    }

  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`❌ Request timed out after ${API_TIMEOUT_MS / 60000} minutes`);
    } else {
      console.error("❌ Fetch error:", error);
    }
  }
}

testGrokAPI();
