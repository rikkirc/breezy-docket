// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest'
import { jdCurriculum } from '../data'
import { deleteTemplate, loadTemplates, saveTemplate } from './templates'

beforeEach(() => localStorage.clear())

describe('templates', () => {
  test('save, replace by name, list and delete', () => {
    saveTemplate('  JD evening ', jdCurriculum)
    expect(loadTemplates().map((t) => t.name)).toEqual(['JD evening'])
    expect(loadTemplates()[0].curriculum.subjects).toHaveLength(53)

    saveTemplate('JD evening', { ...jdCurriculum, subjects: jdCurriculum.subjects.slice(0, 2) })
    expect(loadTemplates()).toHaveLength(1)
    expect(loadTemplates()[0].curriculum.subjects).toHaveLength(2)

    expect(deleteTemplate('JD evening')).toEqual([])
  })

  test('unreadable stored templates are ignored', () => {
    localStorage.setItem('curriculum-organizer:templates', JSON.stringify([{ name: 'bad', curriculum: { subjects: 'x' } }]))
    expect(loadTemplates()).toEqual([])
    localStorage.setItem('curriculum-organizer:templates', 'not json')
    expect(loadTemplates()).toEqual([])
  })
})
