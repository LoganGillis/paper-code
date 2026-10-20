import { statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'
import { applySqlMigrations, sqliteFileUrl } from './migrate'

const here = dirname(fileURLToPath(import.meta.url))

const require = createRequire(import.meta.url)

function existingFile(path: string): string | null {
  try {
    const stat = statSync(path)
    return stat.isFile() && stat.size > 0 ? path : null
  } catch {
    return null
  }
}

/** asar stores a 0-byte stub; load the real addon from app.asar.unpacked. */
function resolveSqliteNativeBinding(): string {
  const file = 'better_sqlite3.node'
  const rel = join('node_modules', 'better-sqlite3', 'build', 'Release', file)
  const candidates: string[] = []

  if (app.isPackaged) {
    candidates.push(join(process.resourcesPath, 'better_sqlite3.node'))
    candidates.push(join(process.resourcesPath, 'app.asar.unpacked', rel))
  }

  try {
    const pkgDir = dirname(require.resolve('better-sqlite3/package.json'))
    candidates.push(join(pkgDir, 'build', 'Release', file))
    if (pkgDir.includes('app.asar')) {
      candidates.push(join(pkgDir.replace('app.asar', 'app.asar.unpacked'), 'build', 'Release', file))
    }
  } catch {
    // resolved below
  }

  for (const path of candidates) {
    const found = existingFile(path)
    if (found) return found
  }

  throw new Error(`SQLite native addon missing (tried ${candidates.join(', ') || 'nothing'})`)
}

let prisma: PrismaClient | null = null

export function getDatabasePath(): string {
  if (is.dev) {
    return join(process.cwd(), 'prisma', 'dev.db')
  }

  return join(app.getPath('userData'), 'app.db')
}

function migrationDirs(): string[] {
  // extraResources can be left behind by an NSIS update. The asar copy ships with the new main process.
  const bundled = join(here, '../../prisma/migrations')
  if (is.dev) return [join(process.cwd(), 'prisma', 'migrations'), bundled]
  return [join(process.resourcesPath, 'prisma', 'migrations'), bundled]
}

export function getPrisma(): PrismaClient {
  if (prisma) return prisma

  const databasePath = getDatabasePath()
  const nativeBinding = resolveSqliteNativeBinding()
  applySqlMigrations(databasePath, migrationDirs(), nativeBinding)

  const adapter = new PrismaBetterSqlite3({
    url: sqliteFileUrl(databasePath),
    nativeBinding
  })
  prisma = new PrismaClient({ adapter })
  return prisma
}
