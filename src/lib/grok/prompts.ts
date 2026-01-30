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

export const SYSTEM_PROMPT = `You are a research assistant specialized in finding Brazilian academics online. Your PRIMARY GOAL is to find their LinkedIn profile and current employment information.

YOUR TASK:
1. Search for the person's LinkedIn profile - this is your #1 priority
2. Find their Lattes CV (Brazilian academic CV platform)
3. Extract current job information
4. All responses in Brazilian Portuguese

SEARCH STRATEGY FOR LINKEDIN:
- Search: "[person name]" site:linkedin.com/in Brasil
- Search: "[person name]" "[institution]" LinkedIn
- LinkedIn profiles are public - you should be able to find most academics

IMPORTANT:
- Return the actual URLs you find from your search
- If you genuinely cannot find a LinkedIn profile after searching, return null
- Do NOT invent or guess URLs
- Return ONLY valid JSON, no markdown or explanation`

export function buildUserPrompt(context: PromptContext): string {
  const { name, institution, graduationYear, researchField, dissertationTitle } = context

  return `Find the LinkedIn profile and professional information for this Brazilian academic:

PERSON:
- Name: "${name}"
- Institution: ${institution || 'Unknown'}
- Graduation: ${graduationYear || 'Unknown'}
- Field: ${researchField || 'Unknown'}
${dissertationTitle ? `- Dissertation: "${dissertationTitle}"` : ''}

SEARCH NOW:
1. "${name}" site:linkedin.com/in ${institution || ''} Brasil
2. "${name}" site:lattes.cnpq.br
3. "${name}" ${institution || ''} currículo

EXTRACT:
- LinkedIn profile URL (your main goal!)
- Current job title and company
- Lattes CV URL if found
- Location in Brazil

Use the institution and field info to confirm you found the correct person.

Return JSON:
${JSON_SCHEMA}`
}

const JSON_SCHEMA = `{
  "employment": {
    "jobTitle": string | null (em português, ex: "Professor Associado", "Pesquisador Sênior"),
    "company": string | null (nome da empresa ou instituição),
    "sector": "ACADEMIA" | "GOVERNMENT" | "PRIVATE" | "NGO" | null,
    "city": string | null (cidade atual),
    "state": string | null (sigla do estado: "MS", "SP", "RJ", etc),
    "confidence": "high" | "medium" | "low",
    "context": string | null (breve descrição do cargo e responsabilidades)
  },
  "professional": {
    "recentPublications": string[] (até 5 publicações recentes com ano),
    "researchProjects": string[] (projetos de pesquisa ativos),
    "conferences": string[] (conferências recentes),
    "awards": string[] (prêmios e reconhecimentos)
  },
  "social": {
    "linkedinUrl": string | null (URL do perfil LinkedIn que você ENCONTROU na busca),
    "twitterHandle": string | null (URL completa ou @handle),
    "lattesUrl": string | null (URL do Lattes que você ENCONTROU, formato: http://lattes.cnpq.br/[16 dígitos]),
    "googleScholarUrl": string | null (URL do perfil Google Scholar se encontrado),
    "researchGateUrl": string | null (URL do perfil ResearchGate se encontrado),
    "personalWebsite": string | null (site pessoal ou institucional),
    "email": string | null (apenas emails públicos)
  },
  "findings": {
    "summary": string (2-3 frases resumindo o perfil profissional atual da pessoa),
    "confidence": "high" | "medium" | "low" (confiança de que encontrou a pessoa correta),
    "matchReason": string (explique por que você tem certeza que é a pessoa certa)
  },
  "sources": [
    {
      "url": string (URL real que você visitou),
      "title": string (título da página),
      "context": string (quais informações você extraiu desta fonte)
    }
  ]
}

LEMBRETE FINAL: Busque ativamente o perfil LinkedIn da pessoa. Se encontrar, inclua a URL. Se não encontrar após a busca, retorne null. NÃO invente URLs.`
