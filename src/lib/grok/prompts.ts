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
    "jobTitle": string | null,
    "company": string | null,
    "sector": "ACADEMIA" | "GOVERNMENT" | "PRIVATE" | "NGO" | null,
    "city": string | null,
    "state": string | null,
    "confidence": "high" | "medium" | "low",
    "context": string | null (brief description of what you found about their current role)
  },
  "professional": {
    "recentPublications": string[] (include titles with year if found),
    "researchProjects": string[] (include project names and institutions),
    "conferences": string[] (include event names and years),
    "awards": string[] (include award names and years)
  },
  "social": {
    "linkedinUrl": string | null (full LinkedIn profile URL),
    "twitterHandle": string | null (full Twitter/X URL or @handle),
    "lattesUrl": string | null (full Lattes CV URL),
    "personalWebsite": string | null (full URL),
    "email": string | null
  },
  "findings": {
    "summary": string (2-3 sentences summarizing what you found about this person),
    "confidence": "high" | "medium" | "low" (overall confidence you found the right person)
  },
  "sources": [
    {
      "url": string (direct link to source),
      "title": string (page title or source name),
      "context": string (what information you found on this page)
    }
  ]
}

IMPORTANT: Include all URLs found. For sources array, include at least the LinkedIn, Lattes, and any other pages you visited. Context should explain what specific information came from each source.`
