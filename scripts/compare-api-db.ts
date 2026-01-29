/**
 * Compare API data format with Database storage
 */
import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { upsertAcademicWithDissertation } from '../src/lib/academic-upsert'

// Exact CAPES API record format (from actual API response)
const apiRecord = {
  NM_DISCENTE: 'RENATO NUNES VAEZ',
  NM_PRODUCAO: 'A INTERAÇÃO GENÓTIPOS X AMBIENTES IMPACTA A EMISSÃO DE CO2 DO SOLO EM MILHO?',
  AN_BASE: 2024,
  NM_ENTIDADE_ENSINO: 'UNIVERSIDADE FEDERAL DE MATO GROSSO DO SUL',
  NM_GRAU_ACADEMICO: 'MESTRADO',
  NM_ORIENTADOR: 'PAULO EDUARDO TEODORO',
  DS_RESUMO: 'A PESQUISA BUSCOU ENTENDER A VARIABILIDADE DO FLUXO DE DIÓXIDO DE CARBONO (CO2) EM SOLOS CULTIVADOS COM DIFERENTES HÍBRIDOS DE MILHO',
  NM_AREA_CONHECIMENTO: 'AGRONOMIA',
  DS_URL_TEXTO_COMPLETO: 'https://sucupira.capes.gov.br/sucupira/public/consultas/coleta/trabalhoConclusao/viewTrabalhoConclusao.jsf?popup=true&id_trabalho=15768211',
  DS_PALAVRA_CHAVE: 'FLUXO DE CO2, GENÓTIPOS DE MILHO, ANÁLISES DE COMPONENTES PRINCIPAIS',
}

async function compare() {
  // Clean first
  await prisma.academic.deleteMany({ where: { name: apiRecord.NM_DISCENTE } })

  // Transform exactly like the Sucupira worker does
  const degree = apiRecord.NM_GRAU_ACADEMICO.toLowerCase()
  const keywords = apiRecord.DS_PALAVRA_CHAVE.split(',').map(k => k.trim()).filter(Boolean)

  await upsertAcademicWithDissertation(
    {
      name: apiRecord.NM_DISCENTE,
      institution: apiRecord.NM_ENTIDADE_ENSINO,
      graduationYear: apiRecord.AN_BASE,
      degreeLevel: degree.includes('doutorado') ? 'PHD' : 'MASTERS',
      researchField: apiRecord.NM_AREA_CONHECIMENTO,
    },
    {
      title: apiRecord.NM_PRODUCAO,
      defenseYear: apiRecord.AN_BASE,
      institution: apiRecord.NM_ENTIDADE_ENSINO,
      abstract: apiRecord.DS_RESUMO,
      advisorName: apiRecord.NM_ORIENTADOR,
      keywords,
      sourceUrl: apiRecord.DS_URL_TEXTO_COMPLETO,
    },
    { source: 'CAPES', scrapedAt: new Date() }
  )

  // Fetch from DB
  const db = await prisma.academic.findFirst({
    where: { name: apiRecord.NM_DISCENTE },
    include: { dissertations: true }
  })

  const diss = db?.dissertations[0]

  console.log('\n=== API vs Database Comparison ===\n')
  console.log('ACADEMIC FIELDS:')
  console.log('─'.repeat(80))
  console.log(`Name:`)
  console.log(`  API: ${apiRecord.NM_DISCENTE}`)
  console.log(`  DB:  ${db?.name}`)
  console.log(`  ${apiRecord.NM_DISCENTE === db?.name ? '✓ MATCH' : '✗ MISMATCH'}`)

  console.log(`\nInstitution:`)
  console.log(`  API: ${apiRecord.NM_ENTIDADE_ENSINO}`)
  console.log(`  DB:  ${db?.institution}`)
  console.log(`  ${apiRecord.NM_ENTIDADE_ENSINO === db?.institution ? '✓ MATCH' : '✗ MISMATCH'}`)

  console.log(`\nGraduation Year:`)
  console.log(`  API: ${apiRecord.AN_BASE}`)
  console.log(`  DB:  ${db?.graduationYear}`)
  console.log(`  ${apiRecord.AN_BASE === db?.graduationYear ? '✓ MATCH' : '✗ MISMATCH'}`)

  console.log(`\nDegree Level:`)
  console.log(`  API: ${apiRecord.NM_GRAU_ACADEMICO} → transformed to MASTERS`)
  console.log(`  DB:  ${db?.degreeLevel}`)
  console.log(`  ${'MASTERS' === db?.degreeLevel ? '✓ MATCH' : '✗ MISMATCH'}`)

  console.log(`\nResearch Field:`)
  console.log(`  API: ${apiRecord.NM_AREA_CONHECIMENTO}`)
  console.log(`  DB:  ${db?.researchField}`)
  console.log(`  ${apiRecord.NM_AREA_CONHECIMENTO === db?.researchField ? '✓ MATCH' : '✗ MISMATCH'}`)

  console.log('\n\nDISSERTATION FIELDS:')
  console.log('─'.repeat(80))

  console.log(`Title:`)
  console.log(`  API: ${apiRecord.NM_PRODUCAO}`)
  console.log(`  DB:  ${diss?.title}`)
  console.log(`  ${apiRecord.NM_PRODUCAO === diss?.title ? '✓ MATCH' : '✗ MISMATCH'}`)

  console.log(`\nDefense Year:`)
  console.log(`  API: ${apiRecord.AN_BASE}`)
  console.log(`  DB:  ${diss?.defenseYear}`)
  console.log(`  ${apiRecord.AN_BASE === diss?.defenseYear ? '✓ MATCH' : '✗ MISMATCH'}`)

  console.log(`\nAdvisor:`)
  console.log(`  API: ${apiRecord.NM_ORIENTADOR}`)
  console.log(`  DB:  ${diss?.advisorName}`)
  console.log(`  ${apiRecord.NM_ORIENTADOR === diss?.advisorName ? '✓ MATCH' : '✗ MISMATCH'}`)

  console.log(`\nAbstract:`)
  console.log(`  API: ${apiRecord.DS_RESUMO.substring(0, 60)}...`)
  console.log(`  DB:  ${diss?.abstract?.substring(0, 60)}...`)
  console.log(`  ${apiRecord.DS_RESUMO === diss?.abstract ? '✓ MATCH' : '✗ MISMATCH'}`)

  console.log(`\nSource URL:`)
  console.log(`  API: ${apiRecord.DS_URL_TEXTO_COMPLETO.substring(0, 60)}...`)
  console.log(`  DB:  ${diss?.sourceUrl?.substring(0, 60)}...`)
  console.log(`  ${apiRecord.DS_URL_TEXTO_COMPLETO === diss?.sourceUrl ? '✓ MATCH' : '✗ MISMATCH'}`)

  console.log(`\nKeywords:`)
  console.log(`  API: ${keywords.join(' | ')}`)
  console.log(`  DB:  ${diss?.keywords?.join(' | ')}`)
  const keywordsMatch = JSON.stringify(keywords) === JSON.stringify(diss?.keywords)
  console.log(`  ${keywordsMatch ? '✓ MATCH' : '✗ MISMATCH'}`)

  // Summary
  const checks = [
    apiRecord.NM_DISCENTE === db?.name,
    apiRecord.NM_ENTIDADE_ENSINO === db?.institution,
    apiRecord.AN_BASE === db?.graduationYear,
    'MASTERS' === db?.degreeLevel,
    apiRecord.NM_AREA_CONHECIMENTO === db?.researchField,
    apiRecord.NM_PRODUCAO === diss?.title,
    apiRecord.AN_BASE === diss?.defenseYear,
    apiRecord.NM_ORIENTADOR === diss?.advisorName,
    apiRecord.DS_RESUMO === diss?.abstract,
    apiRecord.DS_URL_TEXTO_COMPLETO === diss?.sourceUrl,
    keywordsMatch,
  ]

  const passed = checks.filter(Boolean).length
  const total = checks.length

  console.log('\n' + '═'.repeat(80))
  console.log(`RESULT: ${passed}/${total} fields match exactly`)
  console.log(passed === total ? '\n✓ API data is stored correctly in database!' : '\n✗ Some fields do not match')

  // Cleanup
  await prisma.academic.deleteMany({ where: { name: apiRecord.NM_DISCENTE } })
  await prisma.$disconnect()
}

compare()
