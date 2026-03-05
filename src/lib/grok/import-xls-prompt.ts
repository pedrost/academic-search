/**
 * Grok Prompt for XLS Academic Extraction
 *
 * Sends raw spreadsheet data to Grok and asks it to extract
 * academics in a structured format, regardless of the original
 * column layout or language.
 */

export const XLS_EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting academic/researcher data from spreadsheet content.

YOUR MISSION: Analyze the raw spreadsheet data and extract all academics/researchers you can identify.

The spreadsheet can be in ANY format - columns may be named differently, in Portuguese or English, or may not have headers at all. Use your judgment to identify:
- Person names
- Educational institutions
- Academic programs or departments
- Degree levels (Mestrado = MASTERS, Doutorado = PHD, Pós-Doutorado = POSTDOC)
- Graduation/defense years
- Dissertation or thesis titles
- Research fields or areas of expertise
- Email addresses
- Any other academic information

RULES:
- Extract as many academics as you can identify from the data
- If a field cannot be determined, set it to null
- "name" is the only truly required field - skip rows where you can't identify a person's name
- Normalize degree levels to: MASTERS, PHD, or POSTDOC
- Respond in JSON format only`

export function buildXlsExtractionPrompt(rawData: string, chunkIndex: number, totalChunks: number): string {
  return `Extract academics from this spreadsheet data (chunk ${chunkIndex + 1} of ${totalChunks}):

RAW DATA:
${rawData}

Return a JSON object with this structure:
{
  "academics": [
    {
      "name": string,
      "institution": string | null,
      "program": string | null,
      "degreeLevel": "MASTERS" | "PHD" | "POSTDOC" | null,
      "graduationYear": number | null,
      "researchField": string | null,
      "email": string | null,
      "dissertationTitle": string | null,
      "dissertationAbstract": string | null,
      "keywords": string[] | null
    }
  ]
}

If no academics can be identified, return: { "academics": [] }`
}

export interface ExtractedAcademic {
  name: string
  institution: string | null
  program: string | null
  degreeLevel: 'MASTERS' | 'PHD' | 'POSTDOC' | null
  graduationYear: number | null
  researchField: string | null
  email: string | null
  dissertationTitle: string | null
  dissertationAbstract: string | null
  keywords: string[] | null
}

export interface XlsExtractionResponse {
  academics: ExtractedAcademic[]
}

export function parseXlsExtractionResponse(rawResponse: any): XlsExtractionResponse | null {
  try {
    if (!rawResponse || typeof rawResponse !== 'object') return null
    if (!Array.isArray(rawResponse.academics)) return null

    // Filter out entries without a name
    rawResponse.academics = rawResponse.academics.filter(
      (a: any) => a.name && typeof a.name === 'string' && a.name.trim().length > 0
    )

    return rawResponse as XlsExtractionResponse
  } catch {
    return null
  }
}
