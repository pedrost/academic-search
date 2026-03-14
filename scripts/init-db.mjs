import { createClient } from '@libsql/client'

const url = process.env.DATABASE_URL ?? 'file:/data/hunter.db'
const client = createClient({ url })

const statements = [
  `CREATE TABLE IF NOT EXISTS academics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    research_field TEXT,
    degree_level TEXT,
    graduation_year INTEGER,
    institution TEXT,
    current_city TEXT,
    current_state TEXT,
    current_sector TEXT NOT NULL DEFAULT 'UNKNOWN',
    current_job_title TEXT,
    current_company TEXT,
    linkedin_url TEXT,
    lattes_url TEXT,
    enrichment_status TEXT NOT NULL DEFAULT 'PENDING',
    last_enriched_at DATETIME,
    grok_metadata TEXT,
    grok_enriched_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS academics_name_institution_graduation_year ON academics (name, institution, graduation_year)`,
  `CREATE INDEX IF NOT EXISTS academics_enrichment_status_linkedin_url ON academics (enrichment_status, linkedin_url)`,
  `CREATE INDEX IF NOT EXISTS academics_current_state ON academics (current_state)`,
  `CREATE INDEX IF NOT EXISTS academics_current_city ON academics (current_city)`,
  `CREATE INDEX IF NOT EXISTS academics_research_field ON academics (research_field)`,
  `CREATE INDEX IF NOT EXISTS academics_degree_level ON academics (degree_level)`,
  `CREATE INDEX IF NOT EXISTS academics_current_sector ON academics (current_sector)`,

  `CREATE TABLE IF NOT EXISTS dissertations (
    id TEXT PRIMARY KEY,
    academic_id TEXT NOT NULL,
    title TEXT NOT NULL,
    abstract TEXT,
    keywords TEXT NOT NULL DEFAULT '[]',
    defense_year INTEGER NOT NULL,
    institution TEXT NOT NULL,
    program TEXT,
    advisor_name TEXT,
    source_url TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_id) REFERENCES academics(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS dissertations_academic_id ON dissertations (academic_id)`,
  `CREATE INDEX IF NOT EXISTS dissertations_academic_id_title_defense_year ON dissertations (academic_id, title, defense_year)`,

  `CREATE TABLE IF NOT EXISTS enrichment_tasks (
    id TEXT PRIMARY KEY,
    academic_id TEXT,
    task_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    payload TEXT,
    assigned_to TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (academic_id) REFERENCES academics(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS enrichment_tasks_status_priority ON enrichment_tasks (status, priority)`,

  `CREATE TABLE IF NOT EXISTS scraper_sessions (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'RUNNING',
    profiles_scraped INTEGER NOT NULL DEFAULT 0,
    tasks_created INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
]

for (const sql of statements) {
  await client.execute(sql)
}

console.log('Database schema initialized successfully')
await client.close()
