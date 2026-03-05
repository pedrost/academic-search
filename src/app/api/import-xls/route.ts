import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { callGrokAPI } from '@/lib/grok/client'
import {
  XLS_EXTRACTION_SYSTEM_PROMPT,
  buildXlsExtractionPrompt,
  parseXlsExtractionResponse,
  ExtractedRecord,
} from '@/lib/grok/import-xls-prompt'
import { upsertAcademic, upsertAcademicWithDissertation } from '@/lib/academic-upsert'

const CHUNK_SIZE = 50 // rows per chunk

type SSEEvent =
  | { phase: 'parsing'; status: 'start' | 'complete'; message?: string }
  | { phase: 'extracting'; status: 'start' | 'progress' | 'complete'; message?: string; chunk?: number; totalChunks?: number }
  | { phase: 'inserting'; status: 'start' | 'progress' | 'complete'; message?: string; current?: number; total?: number }
  | { phase: 'enhancing'; status: 'start' | 'progress' | 'complete' | 'skipped'; message?: string; current?: number; total?: number }
  | { phase: 'done'; status: 'success'; imported: number; enhanced: number; skipped: number; duplicates: number; academicIds: string[]; enhancedIds: string[] }
  | { phase: 'error'; status: 'error'; message: string }

function sheetToTextChunks(sheet: XLSX.WorkSheet): string[] {
  // Convert sheet to array of arrays (including headers)
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })

  if (data.length === 0) return []

  // First row is likely headers
  const headerRow = data[0] as string[]
  const dataRows = data.slice(1).filter((row: string[]) =>
    row.some((cell: string) => cell !== '')
  )

  if (dataRows.length === 0) return []

  const chunks: string[] = []

  for (let i = 0; i < dataRows.length; i += CHUNK_SIZE) {
    const chunkRows = dataRows.slice(i, i + CHUNK_SIZE)
    // Format as a readable table with headers
    const lines = [headerRow.join(' | ')]
    for (const row of chunkRows) {
      lines.push((row as string[]).join(' | '))
    }
    chunks.push(lines.join('\n'))
  }

  return chunks
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: SSEEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        // Parse form data
        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const enhancementCount = formData.get('enhancementCount') as string | null

        if (!file) {
          send({ phase: 'error', status: 'error', message: 'Nenhum arquivo enviado' })
          controller.close()
          return
        }

        const enhanceCount = enhancementCount === 'all' ? Infinity : parseInt(enhancementCount || '0', 10)

        // ========================================
        // PHASE 1: Parse XLS
        // ========================================
        send({ phase: 'parsing', status: 'start', message: 'Lendo arquivo...' })

        const buffer = Buffer.from(await file.arrayBuffer())
        let workbook: XLSX.WorkBook

        try {
          workbook = XLSX.read(buffer, { type: 'buffer' })
        } catch {
          send({ phase: 'error', status: 'error', message: 'Arquivo não reconhecido. Envie um arquivo .xls ou .xlsx válido.' })
          controller.close()
          return
        }

        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const chunks = sheetToTextChunks(sheet)

        if (chunks.length === 0) {
          send({ phase: 'error', status: 'error', message: 'Arquivo vazio ou sem dados legíveis.' })
          controller.close()
          return
        }

        send({ phase: 'parsing', status: 'complete', message: `${chunks.length} bloco(s) de dados encontrados` })

        // ========================================
        // PHASE 2: Extract academics with Grok
        // ========================================
        send({ phase: 'extracting', status: 'start', message: `Extraindo acadêmicos com IA...`, totalChunks: chunks.length })

        const allExtracted: ExtractedRecord[] = []

        for (let i = 0; i < chunks.length; i++) {
          send({
            phase: 'extracting',
            status: 'progress',
            message: `Processando bloco ${i + 1} de ${chunks.length}...`,
            chunk: i + 1,
            totalChunks: chunks.length,
          })

          let retries = 0
          let extracted: ExtractedRecord[] | null = null
          let lastError: string | null = null

          while (retries < 2 && !extracted) {
            try {
              const response = await callGrokAPI([
                { role: 'system', content: XLS_EXTRACTION_SYSTEM_PROMPT },
                { role: 'user', content: buildXlsExtractionPrompt(chunks[i], i, chunks.length) },
              ], { webSearch: false, timeoutMs: 60000 })

              const parsed = parseXlsExtractionResponse(response)
              if (parsed) {
                extracted = parsed.academics
              } else {
                lastError = 'Resposta da IA inválida'
                retries++
              }
            } catch (err) {
              lastError = err instanceof Error ? err.message : 'Erro desconhecido'
              console.error(`[Import XLS] Chunk ${i + 1} attempt ${retries + 1} failed:`, err)
              retries++
            }
          }

          if (extracted) {
            allExtracted.push(...extracted)
          } else {
            console.warn(`[Import XLS] Skipped chunk ${i + 1} after failed attempts: ${lastError}`)
            send({
              phase: 'extracting',
              status: 'progress',
              message: `Bloco ${i + 1} falhou: ${lastError}`,
              chunk: i + 1,
              totalChunks: chunks.length,
            })
          }
        }

        if (allExtracted.length === 0) {
          send({ phase: 'error', status: 'error', message: `Nenhum acadêmico encontrado no arquivo. ${chunks.length} bloco(s) processado(s).` })
          controller.close()
          return
        }

        send({
          phase: 'extracting',
          status: 'complete',
          message: `${allExtracted.length} acadêmico(s) extraídos`,
        })

        // ========================================
        // PHASE 3: Insert into database
        // ========================================
        send({ phase: 'inserting', status: 'start', message: 'Inserindo no banco...', total: allExtracted.length })

        const insertedIds: string[] = []
        let duplicates = 0

        for (let i = 0; i < allExtracted.length; i++) {
          const { academic: academicData, dissertation: dissertationData } = allExtracted[i]
          const metadata = { source: 'CAPES' as const, scrapedAt: new Date() }

          try {
            let result: { id: string; created: boolean }

            if (dissertationData) {
              const r = await upsertAcademicWithDissertation(academicData, dissertationData, metadata)
              result = { id: r.academicId, created: r.academicCreated }
            } else {
              const r = await upsertAcademic(academicData, metadata)
              result = { id: r.id, created: r.created }
            }

            insertedIds.push(result.id)
            if (!result.created) duplicates++
          } catch (err) {
            console.error(`[Import XLS] Failed to insert academic "${academicData.name}":`, err)
          }

          if ((i + 1) % 5 === 0 || i === allExtracted.length - 1) {
            send({
              phase: 'inserting',
              status: 'progress',
              message: `${i + 1} de ${allExtracted.length} processados...`,
              current: i + 1,
              total: allExtracted.length,
            })
          }
        }

        send({
          phase: 'inserting',
          status: 'complete',
          message: `${insertedIds.length} acadêmico(s) inseridos (${duplicates} já existentes)`,
        })

        // ========================================
        // PHASE 4: Enhancement (optional)
        // ========================================
        let enhanced = 0
        const enhancedIds: string[] = []

        if (enhanceCount > 0 && insertedIds.length > 0) {
          const toEnhance = insertedIds.slice(0, enhanceCount === Infinity ? undefined : enhanceCount)

          send({
            phase: 'enhancing',
            status: 'start',
            message: `Enriquecendo ${toEnhance.length} perfil(is)...`,
            total: toEnhance.length,
          })

          for (let i = 0; i < toEnhance.length; i++) {
            try {
              // Trigger the discover-academic endpoint internally
              const baseUrl = request.nextUrl.origin
              const res = await fetch(
                `${baseUrl}/api/discover-academic?name=${encodeURIComponent(allExtracted[i].academic.name)}`,
              )

              if (res.ok) {
                // Consume the stream to completion
                const reader = res.body?.getReader()
                if (reader) {
                  while (true) {
                    const { done } = await reader.read()
                    if (done) break
                  }
                }
                enhanced++
                enhancedIds.push(toEnhance[i])
              }
            } catch (err) {
              console.error(`[Import XLS] Enhancement failed for "${allExtracted[i].academic.name}":`, err)
            }

            send({
              phase: 'enhancing',
              status: 'progress',
              message: `${i + 1} de ${toEnhance.length} enriquecidos...`,
              current: i + 1,
              total: toEnhance.length,
            })
          }

          send({ phase: 'enhancing', status: 'complete', message: `${enhanced} perfil(is) enriquecido(s)` })
        } else {
          send({ phase: 'enhancing', status: 'skipped', message: 'Enhancement não selecionado' })
        }

        // ========================================
        // DONE
        // ========================================
        send({
          phase: 'done',
          status: 'success',
          imported: insertedIds.length,
          enhanced,
          skipped: allExtracted.length - insertedIds.length,
          duplicates,
          academicIds: insertedIds,
          enhancedIds,
        })
      } catch (error) {
        console.error('[Import XLS] Error:', error)
        send({
          phase: 'error',
          status: 'error',
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
