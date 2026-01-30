/**
 * Grok API Prompt Templates
 *
 * Prompts for finding LinkedIn profiles and professional information
 * about Brazilian academics using xAI's Grok-4 with web search capabilities.
 */

export interface PromptContext {
  name: string
  institution?: string | null
  graduationYear?: number | null
  researchField?: string | null
  dissertationTitle?: string | null
  currentCompany?: string | null
  currentCity?: string | null
  currentState?: string | null
}

export const SYSTEM_PROMPT = `You are an expert at finding LinkedIn profiles of Brazilian academics.

YOUR #1 MISSION: Find the LinkedIn profile URL.

When searching:
- Search thoroughly using the person's name
- Brazilian professionals often use abbreviated names on LinkedIn
- Look at multiple results and reason about which profile best matches
- Consider partial matches - location or education might not be fully updated

RULES:
- Return the LinkedIn URL if you find a profile that likely belongs to this person
- Use your judgment to determine the best match
- Return null only if you truly cannot find any matching profile
- Respond in JSON format only`

export function buildUserPrompt(context: PromptContext): string {
  const { name, institution, graduationYear, researchField, currentCompany, currentCity, currentState } = context

  const location = [currentCity, currentState].filter(Boolean).join(', ')

  return `Find the LinkedIn profile for this Brazilian academic:

NAME: ${name}
${institution ? `INSTITUTION: ${institution}` : ''}
${graduationYear ? `GRADUATION YEAR: ${graduationYear}` : ''}
${researchField ? `FIELD: ${researchField}` : ''}
${currentCompany ? `CURRENT COMPANY: ${currentCompany}` : ''}
${location ? `LOCATION: ${location}` : ''}

Search for this person's LinkedIn profile. Use your best judgment to find the profile that most likely belongs to them, even if not all details match exactly.

Return this JSON:
{
  "employment": {
    "jobTitle": string | null,
    "company": string | null,
    "sector": "ACADEMIA" | "GOVERNMENT" | "PRIVATE" | "NGO" | null,
    "city": string | null,
    "state": string | null,
    "confidence": "high" | "medium" | "low",
    "source": string
  },
  "social": {
    "linkedinUrl": string | null,
    "lattesUrl": string | null,
    "googleScholarUrl": string | null,
    "email": string | null
  },
  "professional": {
    "summary": string | null,
    "expertise": string[]
  },
  "findings": {
    "summary": string,
    "confidence": "high" | "medium" | "low",
    "matchReason": string
  },
  "sources": [
    { "url": string, "title": string, "context": string }
  ]
}`
}

/**
 * LinkedIn Profile Extraction Prompt
 *
 * Used as a chained call after finding a LinkedIn URL to extract
 * detailed career and education timeline data.
 */
export const LINKEDIN_EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting structured career data from LinkedIn profiles.

YOUR MISSION: Extract detailed job history, education, and career timeline from the LinkedIn profile.

RULES:
- Extract ALL job positions with dates, titles, companies
- Extract ALL education entries with degrees, institutions, and dates
- Extract skills and expertise areas
- Return null for fields you cannot find
- Respond in JSON format only`

export function buildLinkedInExtractionPrompt(linkedinUrl: string, name: string): string {
  return `Extract detailed career information from this LinkedIn profile:

LINKEDIN URL: ${linkedinUrl}
PERSON NAME: ${name}

Open this LinkedIn profile and extract all career and education data.

Return this JSON:
{
  "currentPosition": {
    "jobTitle": string | null,
    "company": string | null,
    "location": string | null,
    "startDate": string | null
  },
  "jobHistory": [
    {
      "jobTitle": string,
      "company": string,
      "startDate": string,
      "endDate": string | null,
      "location": string | null,
      "isCurrent": boolean
    }
  ],
  "education": [
    {
      "degree": string,
      "fieldOfStudy": string | null,
      "institution": string,
      "startYear": number | null,
      "endYear": number | null
    }
  ],
  "skills": string[],
  "headline": string | null,
  "about": string | null
}`
}

/**
 * Academic Discovery Prompt
 *
 * Used for web-first academic discovery to find comprehensive information
 * about Brazilian academics/researchers from multiple sources.
 */
export const ACADEMIC_DISCOVERY_SYSTEM_PROMPT = `You are an expert at finding information about Brazilian academics and researchers.

YOUR MISSION: Search the web to find detailed information about the specified academic/researcher.

When searching:
- Search for the person by their full name
- Look for academic profiles (Lattes, ResearchGate, Google Scholar, ORCID)
- Look for institutional pages (university websites)
- Look for LinkedIn profiles
- Search for their published work (dissertations, theses, papers)

EXTRACT AND RETURN:
1. Full name (as found in official sources)
2. Current or most recent institution
3. Academic degree (Mestrado/Doutorado/Pós-Doutorado)
4. Graduation year (if available)
5. Research field/area of expertise
6. Current job title and employer
7. Location (city, state)
8. LinkedIn URL (if found)
9. Lattes CV URL (if found)
10. Email (if publicly available)
11. Most notable dissertation/thesis title
12. Brief professional summary

RULES:
- Search thoroughly using multiple queries if needed
- Prioritize official academic sources (Lattes, university pages)
- Only return information you can verify from web sources
- If information is uncertain, mark confidence as "low"
- Respond in JSON format only`

export function buildAcademicDiscoveryPrompt(name: string, additionalContext?: string): string {
  let prompt = `Search the web and find information about this Brazilian academic/researcher:

NAME: ${name}`

  if (additionalContext) {
    prompt += `

ADDITIONAL CONTEXT: ${additionalContext}`
  }

  prompt += `

Search thoroughly and return a JSON object with this structure:
{
  "found": boolean,
  "academic": {
    "name": string,
    "institution": string | null,
    "degreeLevel": "MASTERS" | "PHD" | "POSTDOC" | null,
    "graduationYear": number | null,
    "researchField": string | null,
    "currentJobTitle": string | null,
    "currentCompany": string | null,
    "currentCity": string | null,
    "currentState": string | null,
    "linkedinUrl": string | null,
    "lattesUrl": string | null,
    "email": string | null
  },
  "dissertation": {
    "title": string | null,
    "defenseYear": number | null,
    "institution": string | null,
    "abstract": string | null,
    "advisorName": string | null
  } | null,
  "professional": {
    "summary": string | null,
    "expertise": string[]
  },
  "confidence": "high" | "medium" | "low",
  "sources": [
    { "url": string, "title": string, "relevance": string }
  ]
}

If you cannot find any reliable information about this person, return:
{ "found": false, "reason": "explanation" }`

  return prompt
}
