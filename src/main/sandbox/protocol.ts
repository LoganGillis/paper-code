import type { Page, RunLog, RunResult } from '../../shared/api'
import type { FolderRef, SpaceRef } from '../../shared/helpers/csv'

export const RUN_TIMEOUT_MS = 8_000

export type RunContext = {
  page: Page
  pages: Page[]
  spaces?: SpaceRef[]
  folders?: FolderRef[]
  secrets?: Record<string, string>
}

export type RunRequest = {
  language: 'javascript' | 'typescript'
  source: string
  context: RunContext
}

/** Calls the sandbox makes to the host. Only JSON strings cross this line. */
export type BridgeCall =
  | { op: 'main' }
  | { op: 'page'; kind: 'csv' | 'json' | 'module'; spec: string; from: string }
  | { op: 'secret'; name: string }
  | { op: 'log'; log: RunLog }
  | { op: 'timer'; id: number; ms: number }
  | { op: 'clearTimer'; id: number }
  | { op: 'done'; result: Omit<RunResult, 'logs'> }

export type MainInfo = { code: string; pageId: string; secrets: Record<string, string> }

export type LoadedPage = {
  id: string
  title: string
  type: string
  /** Raw content for CSV and JSON, compiled CommonJS for scripts. */
  content: string
}

export type BridgeReply = { value?: unknown; error?: string }

/** The function the host hands to the prelude. It never throws. */
export type Bridge = (call: string) => string
