/**
 * Test Grok API Connection
 *
 * Run with: npx tsx scripts/test-grok-api.ts
 */

import 'dotenv/config'

const XAI_BASE_URL = "https://api.x.ai/v1"

async function testGrokAPI() {
  const apiKey = process.env.XAI_API_KEY

  if (!apiKey) {
    console.error('❌ XAI_API_KEY not found in environment')
    process.exit(1)
  }

  console.log('✓ API Key found:', apiKey.substring(0, 10) + '...')
  console.log('✓ Testing Grok API connection...\n')

  try {
    const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4-1-fast",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant. Search the web and return ONLY valid JSON."
          },
          {
            role: "user",
            content: "Search the web RIGHT NOW for today's weather in São Paulo, Brazil and return JSON with fields: { city: string, temperature: string, conditions: string, source: string }"
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
        search: {
          max_results: 5
        }
      }),
    })

    console.log('Response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API Error Response:', errorText)
      process.exit(1)
    }

    const data = await response.json()
    console.log('\n✓ API Response:', JSON.stringify(data, null, 2))

    if (data.choices && data.choices[0]) {
      const content = data.choices[0].message.content
      console.log('\n✓ Message Content:', content)

      try {
        const parsed = JSON.parse(content)
        console.log('\n✓ Parsed JSON:', parsed)
        console.log('\n✅ Grok API is working correctly!')
      } catch (e) {
        console.error('\n❌ Failed to parse response as JSON')
        console.error('Content was:', content)
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

testGrokAPI()
