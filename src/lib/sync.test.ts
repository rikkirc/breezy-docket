import { describe, expect, test } from 'vitest'
import { demoStudent, jdCurriculum } from '../data'
import { demoSaved, initialSaved, type Saved } from './storage'
import { decideOnSignIn, fromCloudPlan, isBlank, readCloudPlan, readConsent, toCloudPlan } from './sync'

const mine: Saved = { curriculum: jdCurriculum, student: demoStudent, isDemo: false, setupDone: true }

describe('signing in', () => {
  test('a blank device takes the account\'s plan; a device with a plan uploads it to an empty account', () => {
    const cloud = toCloudPlan(mine)
    expect(decideOnSignIn(initialSaved(), cloud)).toBe('use-cloud')
    expect(decideOnSignIn(demoSaved(), cloud)).toBe('use-cloud')
    expect(decideOnSignIn(mine, null)).toBe('upload-local')
    expect(decideOnSignIn(initialSaved(), null)).toBe('none')
    expect(decideOnSignIn(demoSaved(), null)).toBe('none')
  })

  test('the same plan on both sides needs no question; different plans ask which to keep', () => {
    expect(decideOnSignIn(mine, toCloudPlan(mine))).toBe('use-cloud')
    const other = toCloudPlan({ ...mine, student: { ...mine.student, unit_caps: { default: 15 } } })
    expect(decideOnSignIn(mine, other)).toBe('ask')
  })

  test('blank means the demo or an untouched first visit', () => {
    expect(isBlank(initialSaved())).toBe(true)
    expect(isBlank(demoSaved())).toBe(true)
    expect(isBlank(mine)).toBe(false)
  })
})

describe('the stored plan', () => {
  test('round-trips, and is never marked as the demo', () => {
    const back = fromCloudPlan(readCloudPlan(JSON.parse(JSON.stringify(toCloudPlan({ ...mine, isDemo: true }))))!)
    expect(back).toEqual({ ...mine, isDemo: false })
  })

  test('anything unusable from the server is ignored, not loaded', () => {
    expect(readCloudPlan(null)).toBeNull()
    expect(readCloudPlan({ version: 2, curriculum: jdCurriculum, student: demoStudent, setupDone: true })).toBeNull()
    expect(readCloudPlan({ ...toCloudPlan(mine), student: { results: 'x' } })).toBeNull()
    expect(readCloudPlan({ ...toCloudPlan(mine), curriculum: { program: {}, subjects: [] } })).toBeNull()
  })
})

describe('the Privacy notice agreement', () => {
  test('is read from the stored plan when present, and never treated as part of the plan', () => {
    const stored = { ...toCloudPlan(mine), consentedAt: '2026-10-16T09:30:00.000Z' }
    expect(readConsent(stored)).toBe('2026-10-16T09:30:00.000Z')
    expect(readCloudPlan(stored)).toEqual(toCloudPlan(mine))
    // A plan agreed on in the account still matches the same plan on this device
    expect(decideOnSignIn(mine, readCloudPlan(stored))).toBe('use-cloud')
  })

  test('is missing for plans saved before it existed, or when the value is not a date string', () => {
    expect(readConsent(toCloudPlan(mine))).toBeNull()
    expect(readConsent({ ...toCloudPlan(mine), consentedAt: 5 })).toBeNull()
    expect(readConsent({ ...toCloudPlan(mine), consentedAt: '' })).toBeNull()
    expect(readConsent(null)).toBeNull()
  })
})
