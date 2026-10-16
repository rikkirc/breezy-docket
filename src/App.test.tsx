// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App'
import { demoStudent, jdCurriculum } from './data'

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function tab(name: string) {
  return within(screen.getByRole('navigation', { name: 'Sections' })).getByRole('button', { name })
}

function graduation() {
  return screen.getByText('Expected graduation').parentElement!
}

/** A semester card on Working Subjects. */
function semester(name: string) {
  return screen.getByRole('listitem', { name })
}

/** Passed all of Year 1 and Year 2, 1st sem except a failed 214, on the JD curriculum with the full-load cap. */
function saveFailed214() {
  const subjects = jdCurriculum.subjects.filter((s) => s.standard_year === 1 || (s.standard_year === 2 && s.offered_sem === 1))
  const results = subjects.map((s) => ({
    code: s.code,
    attempts: [{ year: s.standard_year, sem: s.offered_sem, result: s.code === '214' ? 'Failed' : 'Passed' }],
  }))
  const student = { unit_caps: { default: 12, full_load: true }, next_term: { year: 1, sem: 1 }, results }
  localStorage.setItem(
    'curriculum-organizer:v1',
    JSON.stringify({ curriculum: jdCurriculum, student, isDemo: false, setupDone: true }),
  )
}

function section(name: string) {
  return screen.getByRole('region', { name })
}

async function openDemo(user: UserEvent) {
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Or look around with a demo student' }))
}

async function addSubject(user: UserEvent, term: string, code: string, title: string, units: number) {
  await user.click(within(section(term)).getByRole('button', { name: `+ Add a subject to ${term}` }))
  const form = within(section(term))
  await user.type(form.getByLabelText('Code'), code)
  await user.clear(form.getByLabelText('Units'))
  await user.type(form.getByLabelText('Units'), String(units))
  await user.type(form.getByLabelText('Subject title'), title)
  await user.click(form.getByRole('button', { name: 'Add' }))
  await user.click(form.getByRole('button', { name: 'Done' }))
}

describe('setup: building the curriculum', () => {
  test('a first visit starts on step 1, with no tabs yet', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Your subjects' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next: Prerequisites' })).toBeDisabled()
  })

  test('subjects, then prerequisites, then the default plan, then results', async () => {
    const user = userEvent.setup()
    render(<App />)

    await addSubject(user, 'Year 1, 1st sem', 'LAW1', 'Contracts', 3)
    await addSubject(user, 'Year 1, 2nd sem', 'LAW2', 'Advanced Contracts', 1)
    // The subject and the semester total
    expect(within(section('Year 1, 1st sem')).getAllByText('3 units')).toHaveLength(2)
    expect(within(section('Year 1, 2nd sem')).getAllByText('1 unit')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Next: Prerequisites' }))
    expect(within(section('Year 1, 1st sem')).getByText('First semester: no prerequisites.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /LAW2 Advanced Contracts/ }))
    await user.click(screen.getByRole('checkbox', { name: /LAW1 Contracts/ }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByRole('list', { name: 'Prerequisites of LAW2' })).toHaveTextContent('LAW1 Contracts')

    // Each prerequisite is a box with an × to remove it
    await user.click(screen.getByRole('button', { name: 'Remove LAW1 as a prerequisite of LAW2' }))
    expect(screen.queryByRole('list', { name: 'Prerequisites of LAW2' })).not.toBeInTheDocument()
    expect(within(section('Year 1, 2nd sem')).getByText('No prerequisites. Tap to add.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /LAW2 Advanced Contracts/ }))
    await user.click(screen.getByRole('checkbox', { name: /LAW1 Contracts/ }))
    await user.click(screen.getByRole('button', { name: 'Done' }))

    await user.click(screen.getByRole('button', { name: 'Next: Review' }))
    expect(screen.getByText('Your default plan').parentElement).toHaveTextContent('Year 1, 2nd sem')
    // The review shows each prerequisite's full title, not just its code
    expect(screen.getByRole('list', { name: 'Prerequisites of LAW2' })).toHaveTextContent('LAW1 Contracts')
    expect(screen.getByText(/2 subjects, 4 units/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Done: go to Working Subjects' }))
    expect(screen.getByRole('heading', { name: 'Working Subjects' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Plan' })).not.toBeInTheDocument()
    expect(within(graduation()).getByText('Year 1, 2nd sem')).toBeInTheDocument()
    expect(within(graduation()).getByText(/On schedule with the standard plan/)).toBeInTheDocument()
  })

  test('a subject code must be unique', async () => {
    const user = userEvent.setup()
    render(<App />)
    await addSubject(user, 'Year 1, 1st sem', 'LAW1', 'Contracts', 3)
    await user.click(within(section('Year 1, 2nd sem')).getByRole('button', { name: /Add a subject/ }))
    const form = within(section('Year 1, 2nd sem'))
    await user.type(form.getByLabelText('Code'), 'LAW1')
    await user.type(form.getByLabelText('Subject title'), 'Duplicate')
    await user.click(form.getByRole('button', { name: 'Add' }))
    expect(form.getByRole('alert')).toHaveTextContent('There is already a subject with code LAW1.')
  })

  test('starting from the sample JD curriculum, cap 21: on schedule', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Use the sample JD curriculum' }))
    expect(within(section('Year 4, 2nd sem')).getByText('18 units')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next: Prerequisites' }))
    await user.click(screen.getByRole('button', { name: 'Next: Review' }))
    expect(screen.getByText(/53 subjects, 142 units/)).toBeInTheDocument()
    const cap = screen.getByRole('spinbutton', { name: 'Units per semester' })
    await user.clear(cap)
    await user.type(cap, '21')
    await user.click(screen.getByRole('button', { name: 'Done: go to Working Subjects' }))
    expect(within(graduation()).getByText('Year 4, 2nd sem')).toBeInTheDocument()
    // The subjects are the curriculum's, with no notes from the sample's source
    expect(screen.queryByText(/To confirm/)).not.toBeInTheDocument()
  })

  test('the Default cap follows each semester\'s full load', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Use the sample JD curriculum' }))
    await user.click(screen.getByRole('button', { name: 'Next: Prerequisites' }))
    await user.click(screen.getByRole('button', { name: 'Next: Review' }))
    await user.click(screen.getByRole('radio', { name: /Default/ }))
    expect(screen.queryByRole('spinbutton', { name: 'Units per semester' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Done: go to Working Subjects' }))
    expect(within(graduation()).getByText('Year 4, 2nd sem')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Unit cap for Year 1, 1st sem' })).getByText('18 / 18 units')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Unit cap for Year 1, 2nd sem' })).getByText('16 / 16 units')).toBeInTheDocument()
  })
})

describe('working subjects', () => {
  test('the demo: past semesters with results, the current one, and what moved', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    expect(screen.getByText(/made-up demo student/)).toBeInTheDocument()
    expect(within(graduation()).getByText('Year 5, 2nd sem')).toBeInTheDocument()
    expect(within(graduation()).getByText(/1 year behind the standard plan \(Year 4, 2nd sem\)/)).toBeInTheDocument()
    expect(within(semester('Year 2, 1st sem')).getByRole('button', { name: /214 Corporation and Basic Securities Law: Failed/ })).toBeInTheDocument()
    expect(within(semester('Year 3, 1st sem')).getByText('Now')).toBeInTheDocument()
    expect(within(semester('Year 3, 1st sem')).getByText('Moved from Year 2, 1st sem')).toBeInTheDocument()
    expect(within(semester('Year 4, 1st sem')).getByText(/Needs 214 Corporation and Basic Securities Law passed first/)).toBeInTheDocument()
  })

  test('failing a subject moves it to its next offering, and what needs it moves too', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    await user.click(within(screen.getByRole('group', { name: 'Result for 214' })).getByRole('button', { name: 'Failed' }))
    expect(within(graduation()).getByText('Year 6, 2nd sem')).toBeInTheDocument()
    expect(within(semester('Year 3, 1st sem')).getByRole('button', { name: /214 .*: Failed/ })).toBeInTheDocument()
    expect(within(semester('Year 4, 1st sem')).getByText('Corporation and Basic Securities Law')).toBeInTheDocument()
    expect(within(semester('Year 5, 1st sem')).getByText('Commercial Laws I')).toBeInTheDocument()
  })

  test('marking the semester passed moves on to the next one; a result can be changed', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    await user.click(within(semester('Year 3, 1st sem')).getByRole('button', { name: 'Mark all passed' }))
    expect(within(semester('Year 3, 2nd sem')).getByText('Now')).toBeInTheDocument()
    expect(within(graduation()).getByText('Year 5, 2nd sem')).toBeInTheDocument()

    await user.click(within(semester('Year 3, 1st sem')).getByRole('button', { name: /214 .*: Passed/ }))
    await user.click(within(semester('Year 3, 1st sem')).getByRole('button', { name: 'Failed' }))
    expect(within(semester('Year 3, 1st sem')).getByRole('button', { name: /214 .*: Failed/ })).toBeInTheDocument()
  })

  test('raising a semester cap re-plans', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    const cap = screen.getByRole('group', { name: 'Unit cap for Year 3, 1st sem' })
    expect(within(cap).getByText('12 / 12 units')).toBeInTheDocument()
    await user.click(within(cap).getByRole('button', { name: 'Raise the cap' }))
    expect(within(screen.getByRole('group', { name: 'Unit cap for Year 3, 1st sem' })).getByText('13 / 13 units')).toBeInTheDocument()
  })

  test('on full load, a semester pushed over it asks how many units to take', async () => {
    saveFailed214()
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('alert')).toHaveTextContent('Year 4, 1st sem now has 20 units of subjects, more than its full load of 17.')
    await user.click(screen.getByRole('button', { name: 'Year 4, 1st sem only' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Unit cap for Year 4, 1st sem' })).getByText('20 / 20 units')).toBeInTheDocument()
  })

  test('the prompt can set a cap for every semester from now on', async () => {
    saveFailed214()
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByRole('spinbutton', { name: 'Units to take' })
    await user.clear(input)
    await user.type(input, '15')
    await user.click(screen.getByRole('button', { name: 'Every semester from now on' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Unit cap for Year 3, 1st sem' })).getByText(/\/ 15 units/)).toBeInTheDocument()
    await user.click(tab('Settings'))
    expect(screen.getByRole('radio', { name: /Custom/ })).toBeChecked()
  })

  test('renaming a subject on the Curriculum tab keeps its results', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    await user.click(tab('Curriculum'))
    await user.click(screen.getByRole('button', { name: 'Edit 101 Persons and Family Law' }))
    const code = within(section('Year 1, 1st sem')).getByLabelText('Code')
    await user.clear(code)
    await user.type(code, 'CIV101')
    await user.click(within(section('Year 1, 1st sem')).getByRole('button', { name: 'Save' }))
    await user.click(tab('Working Subjects'))
    expect(within(semester('Year 1, 1st sem')).getByRole('button', { name: /CIV101 Persons and Family Law: Passed/ })).toBeInTheDocument()
  })
})

describe('results and data', () => {
  test('switching Settings to the Default cap re-plans the demo', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    await user.click(tab('Settings'))
    await user.click(screen.getByRole('radio', { name: /Default/ }))
    await user.click(tab('Working Subjects'))
    expect(within(screen.getByRole('group', { name: 'Unit cap for Year 3, 1st sem' })).getByText(/\/ 16 units/)).toBeInTheDocument()
  })

  test('clearing results keeps the curriculum; record results from scratch', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    await openDemo(user)
    await user.click(tab('Settings'))
    await user.click(screen.getByRole('button', { name: 'Clear my results' }))
    expect(screen.queryByText(/made-up demo student/)).not.toBeInTheDocument()

    await user.click(within(semester('Year 1, 1st sem')).getByRole('button', { name: 'Mark all passed' }))
    expect(within(semester('Year 1, 2nd sem')).getByText('Now')).toBeInTheDocument()
    await user.click(within(screen.getByRole('group', { name: 'Result for 111' })).getByRole('button', { name: 'Failed' }))
    expect(within(semester('Year 2, 2nd sem')).getByText('Obligations and Contracts')).toBeInTheDocument()
    expect(within(semester('Year 2, 2nd sem')).getByText(/Failed in Year 1, 2nd sem/)).toBeInTheDocument()
  })

  test('start over goes back to setup with an empty curriculum', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    await openDemo(user)
    await user.click(tab('Settings'))
    await user.click(screen.getByRole('button', { name: 'Start over' }))
    expect(screen.getByRole('heading', { name: 'Your subjects' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use the sample JD curriculum' })).toBeInTheDocument()
  })

  test('remembers the curriculum and data after a reload', async () => {
    const user = userEvent.setup()
    render(<App />)
    await addSubject(user, 'Year 1, 1st sem', 'LAW1', 'Contracts', 3)
    cleanup()

    render(<App />)
    expect(screen.getByRole('button', { name: 'Edit LAW1 Contracts' })).toBeInTheDocument()
  })

  test('data saved before the curriculum was editable opens on the JD curriculum', () => {
    localStorage.setItem('curriculum-organizer:v1', JSON.stringify({ student: demoStudent, isDemo: false }))
    render(<App />)
    expect(within(graduation()).getByText('Year 5, 2nd sem')).toBeInTheDocument()
  })

  test('export a backup and import it back', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let exported: Blob | undefined
    URL.createObjectURL = vi.fn((blob: Blob) => {
      exported = blob
      return 'blob:backup'
    })
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const user = userEvent.setup()
    await openDemo(user)

    await user.click(tab('Settings'))
    await user.click(screen.getByRole('button', { name: 'Export backup' }))
    expect(click).toHaveBeenCalled()
    const text = await exported!.text()
    expect(JSON.parse(text).curriculum.subjects).toHaveLength(53)

    await user.click(screen.getByRole('button', { name: 'Clear my results' }))
    await user.click(tab('Settings'))
    await user.upload(screen.getByLabelText('Backup file'), new File([text], 'backup.json', { type: 'application/json' }))
    expect(within(graduation()).getByText('Year 5, 2nd sem')).toBeInTheDocument()
    expect(screen.queryByText(/made-up demo student/)).not.toBeInTheDocument()
  })

  test('a bad backup file is refused with a message', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    await user.click(tab('Settings'))
    await user.upload(screen.getByLabelText('Backup file'), new File(['nope'], 'notes.txt', { type: 'application/json' }))
    expect(screen.getByRole('alert')).toHaveTextContent("isn't valid JSON")
  })
})
