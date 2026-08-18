import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), 'prisma')
for (const name of ['dev.db', 'dev.db-journal', 'dev.db-wal', 'dev.db-shm']) {
  const path = join(dir, name)
  if (existsSync(path)) unlinkSync(path)
}

console.log('Cleared the database. Start Paper (pnpm dev) to install first-timer examples.')
