import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { makePage } from '../shared/test-fixtures'

class FakeProcess extends EventEmitter {
  postMessage = vi.fn()
  kill = vi.fn(() => true)
}

let next: () => FakeProcess
const fork = vi.fn<(...args: unknown[]) => FakeProcess>(() => next())
vi.mock('electron', () => ({ utilityProcess: { fork: (...args: unknown[]) => fork(...args) } }))

const { executeSnippetAsync } = await import('./run-pool')
const page = makePage({ id: 'p', title: 'p', spaceId: 's', type: 'javascript' })

describe('executeSnippetAsync', () => {
  it('reports a run error when the script process cannot start', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    next = () => {
      throw new Error('no fork')
    }
    const result = await executeSnippetAsync('javascript', '1', { page, pages: [] })
    expect(result.error).toMatch(/could not start \(no fork\)/)
  })

  it('reports a crash or early exit as a run error and kills the process', async () => {
    const child = new FakeProcess()
    next = () => child
    const pending = executeSnippetAsync('javascript', '1', { page, pages: [] })
    child.emit('spawn')
    expect(child.postMessage).toHaveBeenCalledOnce()
    child.emit('exit', 9)
    const result = await pending
    expect(result.error).toMatch(/stopped unexpectedly \(exit code 9\)/)
    expect(child.kill).toHaveBeenCalled()
  })

  it('returns the reply from the script process', async () => {
    const child = new FakeProcess()
    next = () => child
    const pending = executeSnippetAsync('javascript', '1', { page, pages: [] })
    child.emit('spawn')
    child.emit('message', { ok: true, result: { logs: [], result: '1', resultKind: 'text' } })
    expect((await pending).result).toBe('1')
  })
})
