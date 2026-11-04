import { describe, expect, it } from 'vitest'
import { makePage } from '../test-fixtures'
import { AmbiguousPageError, requirePage, resolvePage, splitImportSpec } from './csv'

const spaces = [
  { id: 'ws', name: 'Workshop' },
  { id: 'ar', name: 'Archive' }
]
const folders = [
  { id: 'reports', name: 'Reports', parentId: null, spaceId: 'ws' },
  { id: 'q1', name: 'Q1', parentId: 'reports', spaceId: 'ws' }
]
const here = makePage({ id: 'script', title: 'script', spaceId: 'ws', type: 'javascript' })

describe('splitImportSpec', () => {
  it('keeps one slash as Space/Title and reads folders only from two or more', () => {
    expect(splitImportSpec('Data')).toEqual({ spaceName: null, folderPath: null, title: 'Data' })
    expect(splitImportSpec('Workshop/Data')).toEqual({
      spaceName: 'Workshop',
      folderPath: null,
      title: 'Data'
    })
    expect(splitImportSpec('Workshop/Reports/Data')).toEqual({
      spaceName: 'Workshop',
      folderPath: ['Reports'],
      title: 'Data'
    })
    expect(splitImportSpec('Workshop/Reports/Q1/Data').folderPath).toEqual(['Reports', 'Q1'])
    expect(splitImportSpec('Workshop//Data').folderPath).toEqual([])
  })
})

describe('resolvePage', () => {
  const rootJson = makePage({ id: 'root', title: 'Data', spaceId: 'ws', type: 'json' })
  const reportJson = makePage({
    id: 'report',
    title: 'Data',
    spaceId: 'ws',
    type: 'json',
    folderId: 'reports'
  })
  const csv = makePage({ id: 'csv', title: 'Data', spaceId: 'ws', type: 'csv' })
  const pages = [here, rootJson, reportJson, csv]

  it('still resolves a bare title when it is unique', () => {
    expect(resolvePage('Data', here, [here, csv], spaces, { types: ['csv'] })?.id).toBe('csv')
  })

  it('filters by page type before checking for ambiguity', () => {
    expect(resolvePage('Data', here, pages, spaces, { types: ['csv'], folders })?.id).toBe('csv')
  })

  it("resolves a bare title to the single match in the script's own folder", () => {
    expect(resolvePage('Data', here, pages, spaces, { types: ['json'], folders })?.id).toBe('root')
    const inReports = { ...here, folderId: 'reports' }
    expect(resolvePage('Data', inReports, pages, spaces, { types: ['json'], folders })?.id).toBe(
      'report'
    )
  })

  it('throws an ambiguity error that lists the full path of each match', () => {
    const elsewhere = { ...here, folderId: 'q1' }
    let caught: unknown
    try {
      resolvePage('Data', elsewhere, pages, spaces, { types: ['json'], folders, label: 'JSON' })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(AmbiguousPageError)
    const error = caught as AmbiguousPageError
    expect(error.matches).toEqual(['Workshop//Data', 'Workshop/Reports/Data'])
    expect(error.message).toBe(
      '"Data" matches 2 JSON pages. Use the full path: "Workshop//Data", "Workshop/Reports/Data"'
    )
  })

  it('accepts each suggested path and resolves it to exactly one page', () => {
    const options = { types: ['json'] as const, folders }
    expect(resolvePage('Workshop/Reports/Data', here, pages, spaces, options)?.id).toBe('report')
    expect(resolvePage('Workshop//Data', here, pages, spaces, options)?.id).toBe('root')
  })

  it('treats a two-part spec as Space/Title, searching the whole space', () => {
    const other = makePage({ id: 'other', title: 'Data', spaceId: 'ar', type: 'json' })
    expect(resolvePage('Archive/Data', here, [...pages, other], spaces, { folders })?.id).toBe(
      'other'
    )
    expect(() =>
      resolvePage('Workshop/Data', here, pages, spaces, { types: ['json'], folders })
    ).toThrow(AmbiguousPageError)
    const twin = makePage({ id: 'twin', title: 'Data', spaceId: 'ws', type: 'json' })
    expect(() =>
      resolvePage('Data', here, [...pages, twin], spaces, { types: ['json'], folders })
    ).toThrow(AmbiguousPageError)
  })

  it('suggests unique paths with extensions when types differ, and each one resolves', () => {
    let caught: unknown
    try {
      resolvePage('Data', here, pages, spaces, { folders, label: 'importable' })
    } catch (error) {
      caught = error
    }
    const { matches } = caught as AmbiguousPageError
    expect(matches).toEqual([
      'Workshop//Data.json',
      'Workshop/Reports/Data.json',
      'Workshop//Data.csv'
    ])
    expect(matches.map((spec) => resolvePage(spec, here, pages, spaces, { folders })?.id)).toEqual([
      'root',
      'report',
      'csv'
    ])
  })

  it('walks nested folders for a deeper path', () => {
    const deep = makePage({
      id: 'deep',
      title: 'Data',
      spaceId: 'ws',
      type: 'json',
      folderId: 'q1'
    })
    expect(
      resolvePage('Workshop/Reports/Q1/Data', here, [...pages, deep], spaces, { folders })?.id
    ).toBe('deep')
  })

  it('names the other type when only a different kind of page matches', () => {
    expect(() =>
      requirePage('Data', here, [here, csv], spaces, {
        types: ['json'],
        label: 'JSON',
        missing: 'Cannot find JSON "Data"'
      })
    ).toThrow('"Data" is a CSV page, not JSON')
    expect(() =>
      requirePage('Nope', here, [here, csv], spaces, {
        types: ['json'],
        label: 'JSON',
        missing: 'Cannot find JSON "Nope"'
      })
    ).toThrow('Cannot find JSON "Nope"')
  })

  it('prefers the Guide sample tables when running from the Guide', () => {
    const guide = makePage({ id: 'paper:guide', title: 'Guide', spaceId: 'ws', type: 'markdown' })
    const sample = makePage({ id: 'paper:guide:orders', title: 'orders', spaceId: 'ws' })
    const mine = makePage({ id: 'mine', title: 'orders', spaceId: 'ws' })
    expect(resolvePage('orders', guide, [sample, mine], spaces)?.id).toBe('paper:guide:orders')
  })
})
