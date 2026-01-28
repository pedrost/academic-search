import { PrismaClient, DegreeLevel, Sector, EnrichmentStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

const testAcademics = [
  {
    name: 'Maria Silva Santos',
    researchField: 'Ciências Agrárias',
    degreeLevel: DegreeLevel.PHD,
    graduationYear: 2020,
    institution: 'UFMS - Universidade Federal de Mato Grosso do Sul',
    currentCity: 'Campo Grande',
    currentState: 'MS',
    currentSector: Sector.ACADEMIA,
    currentJobTitle: 'Professora Adjunta',
    currentCompany: 'UFMS',
    enrichmentStatus: EnrichmentStatus.COMPLETE,
    dissertations: [
      {
        title: 'Impactos da agricultura familiar na segurança alimentar do Mato Grosso do Sul',
        abstract: 'Esta tese investiga os impactos da agricultura familiar na segurança alimentar das comunidades rurais do estado de Mato Grosso do Sul, analisando aspectos socioeconômicos e ambientais.',
        keywords: ['agricultura familiar', 'segurança alimentar', 'desenvolvimento rural'],
        defenseYear: 2020,
        institution: 'UFMS',
        program: 'Programa de Pós-Graduação em Agronomia',
        advisorName: 'Dr. João Carlos Mendes',
      },
    ],
  },
  {
    name: 'Pedro Henrique Oliveira',
    researchField: 'Ciências da Saúde',
    degreeLevel: DegreeLevel.MASTERS,
    graduationYear: 2022,
    institution: 'UFGD - Universidade Federal da Grande Dourados',
    currentCity: 'Dourados',
    currentState: 'MS',
    currentSector: Sector.GOVERNMENT,
    currentJobTitle: 'Coordenador de Vigilância Epidemiológica',
    currentCompany: 'Secretaria de Saúde de Dourados',
    enrichmentStatus: EnrichmentStatus.PARTIAL,
    dissertations: [
      {
        title: 'Análise epidemiológica da dengue na região da Grande Dourados entre 2015 e 2021',
        abstract: 'Estudo epidemiológico descritivo que analisa a incidência de dengue na região da Grande Dourados.',
        keywords: ['epidemiologia', 'dengue', 'saúde pública'],
        defenseYear: 2022,
        institution: 'UFGD',
        program: 'Programa de Pós-Graduação em Ciências da Saúde',
        advisorName: 'Dra. Ana Paula Fernandes',
      },
    ],
  },
  {
    name: 'Carla Beatriz Ferreira',
    researchField: 'Ciências Humanas',
    degreeLevel: DegreeLevel.PHD,
    graduationYear: 2019,
    institution: 'UEMS - Universidade Estadual de Mato Grosso do Sul',
    currentCity: 'Campo Grande',
    currentState: 'MS',
    currentSector: Sector.PRIVATE,
    currentJobTitle: 'Consultora de Políticas Públicas',
    currentCompany: 'Instituto Cerrado',
    enrichmentStatus: EnrichmentStatus.COMPLETE,
    linkedinUrl: 'https://linkedin.com/in/carlabferreira',
    dissertations: [
      {
        title: 'Políticas públicas de educação indígena no Mato Grosso do Sul: desafios e perspectivas',
        abstract: 'Análise crítica das políticas públicas voltadas à educação indígena no estado.',
        keywords: ['educação indígena', 'políticas públicas', 'diversidade cultural'],
        defenseYear: 2019,
        institution: 'UEMS',
        program: 'Programa de Pós-Graduação em Educação',
        advisorName: 'Dr. Roberto Lima Costa',
      },
    ],
  },
  {
    name: 'Lucas Martins Almeida',
    researchField: 'Engenharias',
    degreeLevel: DegreeLevel.MASTERS,
    graduationYear: 2023,
    institution: 'UFMS - Universidade Federal de Mato Grosso do Sul',
    currentCity: 'Três Lagoas',
    currentState: 'MS',
    currentSector: Sector.ACADEMIA,
    currentJobTitle: 'Pesquisador',
    currentCompany: 'UFMS Campus Três Lagoas',
    enrichmentStatus: EnrichmentStatus.PENDING,
    dissertations: [
      {
        title: 'Otimização de sistemas fotovoltaicos para aplicação em propriedades rurais',
        abstract: 'Desenvolvimento de metodologia para dimensionamento otimizado de sistemas fotovoltaicos.',
        keywords: ['energia solar', 'fotovoltaico', 'energia rural'],
        defenseYear: 2023,
        institution: 'UFMS',
        program: 'Programa de Pós-Graduação em Engenharia Elétrica',
        advisorName: 'Dr. Marcos Antônio Ribeiro',
      },
    ],
  },
  {
    name: 'Juliana Costa Rodrigues',
    researchField: 'Ciências Biológicas',
    degreeLevel: DegreeLevel.PHD,
    graduationYear: 2021,
    institution: 'UFGD - Universidade Federal da Grande Dourados',
    currentCity: 'Campo Grande',
    currentState: 'MS',
    currentSector: Sector.NGO,
    currentJobTitle: 'Diretora de Pesquisa',
    currentCompany: 'ONG Pantanal Vivo',
    enrichmentStatus: EnrichmentStatus.COMPLETE,
    linkedinUrl: 'https://linkedin.com/in/julianacrodrigues',
    lattesUrl: 'http://lattes.cnpq.br/1234567890',
    dissertations: [
      {
        title: 'Biodiversidade de peixes do Rio Paraguai: mapeamento e conservação',
        abstract: 'Estudo sobre a biodiversidade de peixes nativos do Rio Paraguai e propostas de conservação.',
        keywords: ['biodiversidade', 'ictiofauna', 'Pantanal', 'conservação'],
        defenseYear: 2021,
        institution: 'UFGD',
        program: 'Programa de Pós-Graduação em Biologia',
        advisorName: 'Dra. Sandra Melo',
      },
    ],
  },
]

async function main() {
  console.log('Seeding database...')

  for (const data of testAcademics) {
    const { dissertations, ...academicData } = data

    const academic = await prisma.academic.create({
      data: {
        ...academicData,
        dissertations: {
          create: dissertations,
        },
      },
    })

    console.log(`Created academic: ${academic.name}`)
  }

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
