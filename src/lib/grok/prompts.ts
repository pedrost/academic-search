/**
 * Grok API Prompt Templates
 *
 * Prompts for finding current professional information about Brazilian academics
 * using xAI's Grok with web search capabilities.
 */

export interface PromptContext {
  name: string
  institution?: string | null
  graduationYear?: number | null
  researchField?: string | null
  dissertationTitle?: string | null
}

export const SYSTEM_PROMPT = `You are a research assistant with web search capabilities. Search the web RIGHT NOW to find current professional information about Brazilian academics.
Focus on finding LinkedIn profiles, Lattes CV, current employment, and recent publications.
Include detailed context about your findings with direct links to sources.
IMPORTANT: Return ALL text content in Portuguese (Brazilian Portuguese). Job titles, summaries, contexts, and all descriptions must be in Portuguese.
Return ONLY valid JSON matching the schema provided. No markdown, no explanation, just pure JSON.`

export function buildUserPrompt(context: PromptContext): string {
  const { name, institution, graduationYear, researchField, dissertationTitle } = context

  return `Search the web RIGHT NOW for: "${name}"

Background information to help identify the correct person:
- Institution: ${institution || 'Unknown'}
- Graduation year: ${graduationYear || 'Unknown'}
- Research field: ${researchField || 'Unknown'}
- Dissertation: ${dissertationTitle || 'Unknown'}

Search priorities:
1. CRITICAL: Find their LinkedIn profile and extract current employment details
2. Find Lattes CV (plataforma Lattes CNPq) for academic information
3. Recent publications, research projects, conference presentations
4. Other professional profiles (Twitter/X, personal website, institutional page)
5. Current contact information (email, location)

Focus on Brazilian academic and professional sources (LinkedIn, Lattes, Google Scholar, ResearchGate).

Return well-formatted JSON with direct links and context about your findings.
Match this exact schema:
${JSON_SCHEMA}`
}

const JSON_SCHEMA = `{
  "employment": {
    "jobTitle": string | null (em português, ex: "Professor Associado", "Pesquisador"),
    "company": string | null,
    "sector": "ACADEMIA" | "GOVERNMENT" | "PRIVATE" | "NGO" | null,
    "city": string | null,
    "state": string | null (sigla do estado, ex: "MS", "SP"),
    "confidence": "high" | "medium" | "low",
    "context": string | null (breve descrição em português sobre o cargo atual)
  },
  "professional": {
    "recentPublications": string[] (títulos em português com ano),
    "researchProjects": string[] (nomes dos projetos e instituições),
    "conferences": string[] (nomes dos eventos e anos),
    "awards": string[] (nomes dos prêmios e anos)
  },
  "social": {
    "linkedinUrl": string | null (URL completa do LinkedIn),
    "twitterHandle": string | null (URL do Twitter/X ou @handle),
    "lattesUrl": string | null (URL completa do Lattes),
    "personalWebsite": string | null (URL completa),
    "email": string | null
  },
  "findings": {
    "summary": string (2-3 frases em português resumindo o que encontrou sobre esta pessoa),
    "confidence": "high" | "medium" | "low" (confiança geral de que encontrou a pessoa correta)
  },
  "sources": [
    {
      "url": string (link direto da fonte),
      "title": string (título da página),
      "context": string (em português, o que foi encontrado nesta página)
    }
  ]
}

IMPORTANTE: Inclua todas as URLs encontradas. Para o array sources, inclua pelo menos LinkedIn, Lattes e outras páginas visitadas. O context deve explicar em português que informações vieram de cada fonte.`
