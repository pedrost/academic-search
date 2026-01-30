import { prisma } from '../src/lib/db'

async function main() {
  const academic = await prisma.academic.findFirst({
    where: { linkedinUrl: { not: null } },
    select: { id: true, name: true, linkedinUrl: true, lattesUrl: true }
  })
  console.log(JSON.stringify(academic, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
