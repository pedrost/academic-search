/**
 * Grok Prompt for XLS Academic Extraction
 *
 * Sends raw spreadsheet data to Grok and asks it to extract
 * academics matching our database schema exactly, so we can
 * insert directly via academic-upsert.
 */

import { AcademicData, DissertationData } from '@/lib/academic-upsert'

export const XLS_EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting academic/researcher data from spreadsheet content.

YOUR MISSION: Analyze the raw spreadsheet data and extract all academics/researchers you can identify.

The spreadsheet can be in ANY format - columns may be named differently, in Portuguese or English, or may not have headers at all. Use your judgment to identify people and their academic information.

RULES:
- Extract as many academics as you can identify from the data
- If a field cannot be determined, set it to null
- "name" and "institution" are required - skip rows where you can't identify both
- Normalize degree levels to exactly: "MASTERS", "PHD", or "POSTDOC"
  - Mestrado / Mestre = MASTERS
  - Doutorado / Doutor = PHD
  - Pós-Doutorado / Pós-Doc = POSTDOC
- Normalize sector to exactly: "ACADEMIA", "GOVERNMENT", "PRIVATE", "NGO", or "UNKNOWN"
- graduationYear must be a 4-digit number (e.g. 2023)
- Respond in JSON format only`

export function buildXlsExtractionPrompt(rawData: string, chunkIndex: number, totalChunks: number): string {
  return `Extract academics from this spreadsheet data (chunk ${chunkIndex + 1} of ${totalChunks}):

RAW DATA:
${rawData}

Return a JSON object matching our database schema EXACTLY:
{
  "academics": [
    {
      "academic": {
        "name": string,
        "institution": string,
        "graduationYear": number | null,
        "degreeLevel": "MASTERS" | "PHD" | "POSTDOC" | null,
        "researchField": string | null,
        "email": string | null,
        "linkedinUrl": string | null,
        "lattesUrl": string | null,
        "currentCity": string | null,
        "currentState": string | null,
        "currentJobTitle": string | null,
        "currentCompany": string | null
      },
      "dissertation": {
        "title": string,
        "defenseYear": number,
        "institution": string,
        "abstract": string | null,
        "advisorName": string | null,
        "keywords": string[],
        "program": string | null,
        "sourceUrl": string | null
      } | null
    }
  ]
}

IMPORTANT:
- "academic.name" and "academic.institution" are REQUIRED. Skip rows missing either.
- "dissertation" should be null if no thesis/dissertation info is available.
- If dissertation exists, "title", "defenseYear", and "institution" are required.
- Set any field you cannot determine to null (or [] for keywords).

If no academics can be identified, return: { "academics": [] }`
}

export interface ExtractedRecord {
  academic: AcademicData
  dissertation: DissertationData | null
}

export interface XlsExtractionResponse {
  academics: ExtractedRecord[]
}

export function parseXlsExtractionResponse(rawResponse: any): XlsExtractionResponse | null {
  try {
    if (!rawResponse || typeof rawResponse !== 'object') return null
    if (!Array.isArray(rawResponse.academics)) return null

    // Filter out entries missing required fields
    rawResponse.academics = rawResponse.academics.filter((entry: any) => {
      const a = entry?.academic
      return a && typeof a.name === 'string' && a.name.trim().length > 0
        && typeof a.institution === 'string' && a.institution.trim().length > 0
    })

    // Normalize: ensure graduationYear defaults
    for (const entry of rawResponse.academics) {
      const a = entry.academic
      if (!a.graduationYear) {
        a.graduationYear = new Date().getFullYear()
      }
      // Ensure dissertation has required fields or set to null
      if (entry.dissertation) {
        const d = entry.dissertation
        if (!d.title || !d.institution) {
          entry.dissertation = null
        } else {
          d.defenseYear = d.defenseYear || a.graduationYear
          d.keywords = d.keywords || []
        }
      }
    }

    return rawResponse as XlsExtractionResponse
  } catch {
    return null
  }
}
