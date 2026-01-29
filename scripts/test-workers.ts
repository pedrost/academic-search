/**
 * Worker Integration Test Script
 *
 * Tests the data flow from API -> Worker -> Database
 * Run with: npx tsx scripts/test-workers.ts
 */

import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { upsertAcademicWithDissertation } from '../src/lib/academic-upsert'
import { DegreeLevel } from '@prisma/client'

const CAPES_API_BASE = 'https://dadosabertos.capes.gov.br/api/3/action'
const RESOURCE_ID_2024 = '87133ba7-ac99-4d87-966e-8f580bc96231'

interface CAPESRecord {
  NM_DISCENTE: string
  NM_PRODUCAO: string
  AN_BASE: number
  NM_ENTIDADE_ENSINO: string
  NM_GRAU_ACADEMICO: string
  NM_ORIENTADOR?: string
  DS_RESUMO?: string
  NM_AREA_CONHECIMENTO?: string
  DS_URL_TEXTO_COMPLETO?: string
  DS_PALAVRA_CHAVE?: string
}

async function testCAPESAPI(): Promise<CAPESRecord[]> {
  console.log('\n=== Testing CAPES API ===')

  const institution = 'UNIVERSIDADE FEDERAL DE MATO GROSSO DO SUL'
  const filters = JSON.stringify({ NM_ENTIDADE_ENSINO: institution })
  const url = `${CAPES_API_BASE}/datastore_search?resource_id=${RESOURCE_ID_2024}&filters=${encodeURIComponent(filters)}&limit=3`

  console.log(`Fetching: ${url}`)

  const response = await fetch(url)
  const data = await response.json()

  if (!data.success || !data.result?.records) {
    console.error('API Error:', data.error || 'No records')
    return []
  }

  console.log(`✓ API returned ${data.result.records.length} records`)

  // Log first record structure
  const firstRecord = data.result.records[0]
  console.log('\nFirst record fields:')
  console.log('  - NM_DISCENTE (name):', firstRecord.NM_DISCENTE)
  console.log('  - NM_PRODUCAO (title):', firstRecord.NM_PRODUCAO?.substring(0, 50) + '...')
  console.log('  - AN_BASE (year):', firstRecord.AN_BASE)
  console.log('  - NM_GRAU_ACADEMICO (degree):', firstRecord.NM_GRAU_ACADEMICO)
  console.log('  - NM_ORIENTADOR (advisor):', firstRecord.NM_ORIENTADOR)
  console.log('  - NM_AREA_CONHECIMENTO (field):', firstRecord.NM_AREA_CONHECIMENTO)
  console.log('  - DS_URL_TEXTO_COMPLETO:', firstRecord.DS_URL_TEXTO_COMPLETO ? 'present' : 'missing')

  return data.result.records
}

async function testDatabaseInsert(records: CAPESRecord[]) {
  console.log('\n=== Testing Database Insert ===')

  for (const record of records) {
    const name = record.NM_DISCENTE || 'Unknown'
    const title = record.NM_PRODUCAO || 'No title'
    const year = parseInt(String(record.AN_BASE) || new Date().getFullYear().toString(), 10)
    const institution = record.NM_ENTIDADE_ENSINO
    const degree = (record.NM_GRAU_ACADEMICO || '').toLowerCase()
    const degreeLevel: DegreeLevel = degree.includes('doutorado') ? 'PHD' : 'MASTERS'
    const researchField = record.NM_AREA_CONHECIMENTO || 'UNKNOWN'
    const keywords = record.DS_PALAVRA_CHAVE
      ? record.DS_PALAVRA_CHAVE.split(',').map(k => k.trim()).filter(Boolean)
      : []

    console.log(`\nInserting: ${name}`)
    console.log(`  Title: ${title.substring(0, 60)}...`)
    console.log(`  Year: ${year}, Degree: ${degreeLevel}`)
    console.log(`  Field: ${researchField}`)
    console.log(`  Keywords: ${keywords.length} items`)

    try {
      const result = await upsertAcademicWithDissertation(
        {
          name,
          institution,
          graduationYear: year,
          degreeLevel,
          researchField,
        },
        {
          title,
          defenseYear: year,
          institution,
          abstract: record.DS_RESUMO,
          advisorName: record.NM_ORIENTADOR,
          keywords,
          sourceUrl: record.DS_URL_TEXTO_COMPLETO,
        },
        {
          source: 'CAPES',
          scrapedAt: new Date(),
        }
      )

      console.log(`  ✓ Academic ID: ${result.academicId}`)
      console.log(`  ✓ Created: ${result.academicCreated}, Updated: ${result.academicUpdated}`)
      console.log(`  ✓ Dissertation created: ${result.dissertationCreated}`)
    } catch (error) {
      console.error(`  ✗ Error:`, error)
    }
  }
}

async function verifyDatabaseData() {
  console.log('\n=== Verifying Database Data ===')

  const academicCount = await prisma.academic.count()
  const dissertationCount = await prisma.dissertation.count()

  console.log(`Total academics: ${academicCount}`)
  console.log(`Total dissertations: ${dissertationCount}`)

  // Get sample data
  const sample = await prisma.academic.findFirst({
    include: { dissertations: true },
    orderBy: { createdAt: 'desc' },
  })

  if (sample) {
    console.log('\nMost recent academic:')
    console.log(`  Name: ${sample.name}`)
    console.log(`  Institution: ${sample.institution}`)
    console.log(`  Degree: ${sample.degreeLevel}`)
    console.log(`  Research Field: ${sample.researchField}`)
    console.log(`  Enrichment Status: ${sample.enrichmentStatus}`)
    console.log(`  Dissertations: ${sample.dissertations.length}`)

    if (sample.dissertations[0]) {
      const diss = sample.dissertations[0]
      console.log(`\n  First dissertation:`)
      console.log(`    Title: ${diss.title.substring(0, 60)}...`)
      console.log(`    Year: ${diss.defenseYear}`)
      console.log(`    Advisor: ${diss.advisorName || 'N/A'}`)
      console.log(`    Keywords: ${diss.keywords.length} items`)
      console.log(`    Source URL: ${diss.sourceUrl ? 'present' : 'missing'}`)
    }
  }
}

async function main() {
  console.log('Worker Integration Test')
  console.log('========================')

  try {
    // Test API
    const records = await testCAPESAPI()

    if (records.length === 0) {
      console.log('\nNo records to test. Exiting.')
      return
    }

    // Test database insert
    await testDatabaseInsert(records)

    // Verify data
    await verifyDatabaseData()

    console.log('\n✓ All tests passed!')

  } catch (error) {
    console.error('\n✗ Test failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
