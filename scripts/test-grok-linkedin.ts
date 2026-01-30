/**
 * Test script focused on finding LinkedIn profiles
 *
 * Run with: npx tsx scripts/test-grok-linkedin.ts
 */

import 'dotenv/config'

const XAI_BASE_URL = "https://api.x.ai/v1";

// Very focused prompt just for LinkedIn
const SYSTEM_PROMPT = `Você é um especialista em encontrar perfis do LinkedIn de pessoas brasileiras.

INSTRUÇÕES:
1. Faça MÚLTIPLAS buscas no LinkedIn com variações do nome
2. ABRA cada resultado promissor para verificar se é a pessoa certa
3. Compare informações: empresa, localização, formação
4. Retorne APENAS JSON válido

DICA: Brasileiros frequentemente usam nomes abreviados no LinkedIn.`

async function testLinkedInSearch() {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    console.error("❌ XAI_API_KEY not set");
    process.exit(1);
  }

  console.log("🔍 Searching LinkedIn for: ALEF FERNANDO BORILLE DOS SANTOS\n");

  const userPrompt = `Encontre o perfil LinkedIn de ALEF FERNANDO BORILLE DOS SANTOS.

INFORMAÇÕES CONHECIDAS:
- Trabalha na Cerradinho Bio
- Formado pela UFMS (Universidade Federal de Mato Grosso do Sul)
- Área: Agronomia
- Localização: Chapadão do Sul, MS

BUSCAS OBRIGATÓRIAS (faça TODAS):
1. "Alef Borille" site:linkedin.com/in
2. "Alef Fernando" site:linkedin.com/in Cerradinho
3. "Alef Santos" site:linkedin.com/in UFMS
4. "Alef" "Cerradinho Bio" LinkedIn

QUANDO ENCONTRAR RESULTADOS:
- ABRA o perfil LinkedIn para confirmar
- Verifique se menciona: Cerradinho Bio, UFMS, Agronomia, Chapadão do Sul
- Se confirmar, retorne a URL

Retorne JSON:
{
  "linkedinUrl": string | null (URL que você VISITOU e CONFIRMOU),
  "confidence": "high" | "medium" | "low",
  "matchReason": string (como você confirmou que é a pessoa certa),
  "searchesPerformed": string[] (quais buscas você fez),
  "profileInfo": {
    "name": string (nome como aparece no LinkedIn),
    "headline": string (título/headline do perfil),
    "company": string,
    "location": string
  } | null
}`

  try {
    const startTime = Date.now();

    const response = await fetch(`${XAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4",
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

    const elapsed = Date.now() - startTime;
    console.log(`⏱️  Response in ${elapsed}ms | Status: ${response.status}\n`);

    if (!response.ok) {
      console.error("❌ Error:", await response.text());
      return;
    }

    const data = await response.json();

    // Show what searches were performed
    const searches = data.output?.filter((o: any) => o.type === 'web_search_call') || [];
    console.log(`🔎 Searches performed: ${searches.length}`);
    searches.forEach((s: any, i: number) => {
      if (s.action?.type === 'search') {
        console.log(`   ${i + 1}. ${s.action.query}`);
      } else if (s.action?.type === 'open_page') {
        console.log(`   ${i + 1}. [OPENED] ${s.action.url}`);
      }
    });
    console.log("");

    // Extract result
    const messageOutput = data.output?.find((o: any) => o.type === 'message');
    let messageContent: string | undefined;

    if (messageOutput?.content && Array.isArray(messageOutput.content)) {
      const textItem = messageOutput.content.find((c: any) => c.type === 'output_text');
      messageContent = textItem?.text;
    }

    if (messageContent) {
      const parsed = JSON.parse(messageContent);
      console.log("📋 Result:");
      console.log(JSON.stringify(parsed, null, 2));

      console.log("\n🎯 LINKEDIN URL:", parsed.linkedinUrl || "NOT FOUND");
      if (parsed.profileInfo) {
        console.log("   Name:", parsed.profileInfo.name);
        console.log("   Headline:", parsed.profileInfo.headline);
        console.log("   Company:", parsed.profileInfo.company);
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testLinkedInSearch();
