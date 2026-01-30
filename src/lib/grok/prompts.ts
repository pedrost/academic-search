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
Return ONLY valid JSON matching the schema provided. No markdown, no explanation.`

export function buildUserPrompt(context: PromptContext): string {
  const { name, institution, graduationYear, researchField, dissertationTitle } = context

  return `Find current information about this academic researcher:

Name: ${name}
Known institution: ${institution || 'Unknown'}
Graduation year: ${graduationYear || 'Unknown'}
Research field: ${researchField || 'Unknown'}
Dissertation: ${dissertationTitle || 'Unknown'}

Search for:
1. PRIORITY: Current employment (job title, company/institution, sector)
2. Recent publications, research projects, conference presentations
3. Social profiles (LinkedIn, Twitter/X, Lattes CV, personal website, email)

Focus on Brazilian academic and professional sources.
Return JSON matching this schema:
${JSON_SCHEMA}`
}

const JSON_SCHEMA = `{
  employment: {
    jobTitle: string | null,
    company: string | null,
    sector: "ACADEMIA" | "GOVERNMENT" | "PRIVATE" | "NGO" | null,
    city: string | null,
    state: string | null,
    confidence: "high" | "medium" | "low"
  },
  professional: {
    recentPublications: string[],
    researchProjects: string[],
    conferences: string[],
    awards: string[]
  },
  social: {
    linkedinUrl: string | null,
    twitterHandle: string | null,
    lattesUrl: string | null,
    personalWebsite: string | null,
    email: string | null
  },
  sources: string[]
}`
