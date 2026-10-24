    import { describe, expect, it } from 'vitest'
import { cell, fileSlug, naira } from './csv'

describe('cell', () => {
  it('leaves plain text unchanged', () => {
    expect(cell('Ada Okafor')).toBe('Ada Okafor')
  })

  it('quotes values that contain commas', () => {
    expect(cell('Lagos, Nigeria')).toBe('"Lagos, Nigeria"')
  })

  it('doubles quote marks inside quoted values', () => {
    expect(cell('say "hi", now')).toBe('"say ""hi"", now"')
  })

  it('stops spreadsheet formulas from running', () => {
    expect(cell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)")
    expect(cell('-SUM(A1)')).toBe("'-SUM(A1)")
  })

  it('keeps phone numbers that start with a plus sign as text', () => {
    expect(cell('+2348012345678')).toBe('+2348012345678')
  })

  it('turns empty values into blanks', () => {
    expect(cell(null)).toBe('')
    expect(cell(undefined)).toBe('')
  })
})

describe('naira', () => {
  it('converts kobo to naira with two decimals', () => {
    expect(naira(150000)).toBe('1500.00')
    expect(naira(0)).toBe('0.00')
  })
})

describe('fileSlug', () => {
  it('makes a safe file name', () => {
    expect(fileSlug('Machine Learning: Week 1!')).toBe('machine-learning-week-1')
  })

  it('falls back to a default when nothing usable remains', () => {
    expect(fileSlug('!!!')).toBe('export')
  })
})