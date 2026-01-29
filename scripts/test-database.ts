/**
 * Database Integration Test
 *
 * Tests the upsert logic and schema contract with mock data
 * Run with: npx tsx scripts/test-database.ts
 */

import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { upsertAcademicWithDissertation } from '../src/lib/academic-upsert'
import { DegreeLevel } from '@prisma/client'

// Mock data matching actual CAPES API response format
const mockCAPESRecords = [
  {
    NM_DISCENTE: 'RENATO NUNES VAEZ',
    NM_PRODUCAO: 'A INTERAÇÃO GENÓTIPOS X AMBIENTES IMPACTA A EMISSÃO DE CO2 DO SOLO EM MILHO?',
    AN_BASE: 2024,
    NM_ENTIDADE_ENSINO: 'UNIVERSIDADE FEDERAL DE MATO GROSSO DO SUL',
    NM_GRAU_ACADEMICO: 'MESTRADO',
    NM_ORIENTADOR: 'PAULO EDUARDO TEODORO',
    DS_RESUMO: 'A pesquisa buscou entender a variabilidade do fluxo de dióxido de carbono (CO2) em solos cultivados com diferentes híbridos de milho...',
    NM_AREA_CONHECIMENTO: 'AGRONOMIA',
    DS_URL_TEXTO_COMPLETO: 'https://sucupira.capes.gov.br/sucupira/public/consultas/coleta/trabalhoConclusao/viewTrabalhoConclusao.jsf?popup=true&id_trabalho=15768211',
    DS_PALAVRA_CHAVE: 'FLUXO DE CO2, GENÓTIPOS DE MILHO, ANÁLISES DE COMPONENTES PRINCIPAIS',
  },
  {
    NM_DISCENTE: 'MARIA SILVA SANTOS',
    NM_PRODUCAO: 'ANÁLISE DO IMPACTO AMBIENTAL NA REGIÃO DO PANTANAL',
    AN_BASE: 2024,
    NM_ENTIDADE_ENSINO: 'UNIVERSIDADE FEDERAL DE MATO GROSSO DO SUL',
    NM_GRAU_ACADEMICO: 'DOUTORADO',
    NM_ORIENTADOR: 'JOSÉ FERREIRA LIMA',
    DS_RESUMO: 'Este trabalho analisa os impactos ambientais na região do Pantanal brasileiro...',
    NM_AREA_CONHECIMENTO: 'ECOLOGIA',
    DS_URL_TEXTO_COMPLETO: 'https://example.com/thesis/12345',
    DS_PALAVRA_CHAVE: 'PANTANAL, MEIO AMBIENTE, BIODIVERSIDADE, CONSERVAÇÃO',
  },
]

async function testUpsertLogic() {
  console.log('=== Testing Upsert Logic ===\n')

  for (const record of mockCAPESRecords) {
    const name = record.NM_DISCENTE
    const title = record.NM_PRODUCAO
    const year = record.AN_BASE
    const institution = record.NM_ENTIDADE_ENSINO
    const degree = record.NM_GRAU_ACADEMICO.toLowerCase()
    const degreeLevel: DegreeLevel = degree.includes('doutorado') ? 'PHD' : 'MASTERS'
    const researchField = record.NM_AREA_CONHECIMENTO || 'UNKNOWN'
    const keywords = record.DS_PALAVRA_CHAVE
      ? record.DS_PALAVRA_CHAVE.split(',').map(k => k.trim()).filter(Boolean)
      : []

    console.log(`Inserting: ${name}`)
    console.log(`  Title: ${title.substring(0, 50)}...`)
    console.log(`  Year: ${year}, Degree: ${degreeLevel}`)
    console.log(`  Field: ${researchField}`)
    console.log(`  Keywords: ${keywords.join(', ')}`)

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

    console.log(`  Result: academicId=${result.academicId}`)
    console.log(`  Created: ${result.academicCreated}, Updated: ${result.academicUpdated}`)
    console.log(`  Dissertation created: ${result.dissertationCreated}`)
    console.log('')
  }

  // Test deduplication - insert same record again
  console.log('=== Testing Deduplication ===\n')
  const duplicateRecord = mockCAPESRecords[0]

  console.log(`Re-inserting: ${duplicateRecord.NM_DISCENTE}`)
  const dupResult = await upsertAcademicWithDissertation(
    {
      name: duplicateRecord.NM_DISCENTE,
      institution: duplicateRecord.NM_ENTIDADE_ENSINO,
      graduationYear: duplicateRecord.AN_BASE,
      degreeLevel: 'MASTERS',
      researchField: duplicateRecord.NM_AREA_CONHECIMENTO,
    },
    {
      title: duplicateRecord.NM_PRODUCAO,
      defenseYear: duplicateRecord.AN_BASE,
      institution: duplicateRecord.NM_ENTIDADE_ENSINO,
      abstract: duplicateRecord.DS_RESUMO,
      advisorName: duplicateRecord.NM_ORIENTADOR,
      keywords: [],
      sourceUrl: duplicateRecord.DS_URL_TEXTO_COMPLETO,
    },
    { source: 'CAPES', scrapedAt: new Date() }
  )

  console.log(`  Created: ${dupResult.academicCreated} (should be false)`)
  console.log(`  Dissertation created: ${dupResult.dissertationCreated} (should be false)`)

  if (dupResult.academicCreated || dupResult.dissertationCreated) {
    console.log('  ✗ DEDUPLICATION FAILED - Created duplicate!')
    return false
  }
  console.log('  ✓ Deduplication working correctly')
  return true
}

async function verifyDataIntegrity() {
  console.log('\n=== Verifying Data Integrity ===\n')

  const academics = await prisma.academic.findMany({
    where: {
      name: { in: mockCAPESRecords.map(r => r.NM_DISCENTE) }
    },
    include: { dissertations: true },
  })

  console.log(`Found ${academics.length} academics matching test data`)

  for (const academic of academics) {
    console.log(`\n${academic.name}:`)
    console.log(`  Institution: ${academic.institution}`)
    console.log(`  Degree: ${academic.degreeLevel}`)
    console.log(`  Research Field: ${academic.researchField}`)
    console.log(`  Enrichment Status: ${academic.enrichmentStatus}`)
    console.log(`  Dissertations: ${academic.dissertations.length}`)

    // Verify required fields are not null
    const issues: string[] = []
    if (!academic.name) issues.push('name is null')
    if (!academic.institution) issues.push('institution is null')
    if (!academic.degreeLevel) issues.push('degreeLevel is null')

    for (const diss of academic.dissertations) {
      if (!diss.title) issues.push('dissertation title is null')
      if (!diss.defenseYear) issues.push('dissertation defenseYear is null')

      console.log(`\n  Dissertation: ${diss.title.substring(0, 40)}...`)
      console.log(`    Year: ${diss.defenseYear}`)
      console.log(`    Advisor: ${diss.advisorName || 'N/A'}`)
      console.log(`    Keywords: ${diss.keywords.length} items`)
      console.log(`    Source URL: ${diss.sourceUrl ? '✓ present' : '✗ missing'}`)
      console.log(`    Abstract: ${diss.abstract ? '✓ present' : '✗ missing'}`)
    }

    if (issues.length > 0) {
      console.log(`  ✗ Data issues: ${issues.join(', ')}`)
    } else {
      console.log(`  ✓ All required fields present`)
    }
  }
}

async function cleanup() {
  console.log('\n=== Cleanup ===\n')

  // Delete test data
  const deleted = await prisma.academic.deleteMany({
    where: {
      name: { in: mockCAPESRecords.map(r => r.NM_DISCENTE) }
    }
  })

  console.log(`Deleted ${deleted.count} test academics (cascade deletes dissertations)`)
}

async function main() {
  console.log('Database Integration Test')
  console.log('=========================\n')

  try {
    // Clean up any previous test data
    await cleanup()

    // Test upsert
    const upsertOk = await testUpsertLogic()

    // Verify data
    await verifyDataIntegrity()

    // Clean up
    await cleanup()

    if (upsertOk) {
      console.log('\n✓ All database tests passed!')
    } else {
      console.log('\n✗ Some tests failed')
      process.exit(1)
    }

  } catch (error) {
    console.error('\n✗ Test failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
