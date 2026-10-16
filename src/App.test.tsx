// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App'

// These tests cover the app without accounts; src/Account.test.tsx covers sign-in.
vi.mock('./cloud/config', () => ({ firebaseConfig: null }))
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

/** A semester's units, e.g. "12 of 16 units". */
function units(name: string) {
  return within(semester(name)).getByLabelText(`Units for ${name}`)
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

  test('starting from the Xavier University - School of Law curriculum, cap 21: on schedule', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Xavier University - School of Law Curriculum/ }))
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
    await user.click(screen.getByRole('button', { name: /Xavier University - School of Law Curriculum/ }))
    await user.click(screen.getByRole('button', { name: 'Next: Prerequisites' }))
    await user.click(screen.getByRole('button', { name: 'Next: Review' }))
    await user.click(screen.getByRole('radio', { name: /Default/ }))
    expect(screen.queryByRole('spinbutton', { name: 'Units per semester' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Done: go to Working Subjects' }))
    expect(within(graduation()).getByText('Year 4, 2nd sem')).toBeInTheDocument()
    expect(units('Year 1, 1st sem')).toHaveTextContent('18 of 18 units')
    expect(units('Year 1, 2nd sem')).toHaveTextContent('16 of 16 units')
  })
})

describe('working subjects', () => {
  test('the demo: past semesters with results, the current one, and what moved', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    const tabs = within(screen.getByRole('navigation', { name: 'Sections' })).getAllByRole('button')
    expect(tabs.map((t) => t.textContent)).toEqual(['Settings', 'Curriculum', 'Working Subjects'])
    expect(tabs[2]).toHaveAttribute('aria-current', 'page')
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

  test("each semester shows the units taken against the curriculum's load, which can't be changed there", async () => {
    const user = userEvent.setup()
    await openDemo(user)
    // The demo's 12-unit cap against Year 3, 1st sem's 16 units in the curriculum
    // Year 3, 1st sem's 16 units plus the retaken 214 (3) minus 305, which waits for 214 (3)
    expect(units('Year 3, 1st sem')).toHaveTextContent('16 of 16 units')
    expect(within(semester('Year 3, 1st sem')).queryByRole('button', { name: /cap/i })).not.toBeInTheDocument()
    // Past the standard plan there's no curriculum load to compare with
    expect(units('Year 5, 2nd sem')).toHaveTextContent(/^\d+ units?$/)
  })

  test('"Not this sem" moves a subject to its next offering, and what needs it follows; undo restores it', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    await user.click(screen.getByRole('button', { name: 'Not this sem: move 304 to Year 4, 1st sem' }))
    expect(within(semester('Year 3, 1st sem')).queryByText('Basic Succession Law')).not.toBeInTheDocument()
    expect(within(semester('Year 4, 1st sem')).getByText('Basic Succession Law')).toBeInTheDocument()
    expect(within(semester('Year 4, 1st sem')).getByText('You chose not to take it in Year 3, 1st sem.')).toBeInTheDocument()
    // 314 Special Rules and Proceedings needs 304, so it moves from Year 3, 2nd sem to Year 4, 2nd sem
    expect(within(semester('Year 3, 2nd sem')).queryByText('Special Rules and Proceedings')).not.toBeInTheDocument()
    expect(within(semester('Year 4, 2nd sem')).getByText('Special Rules and Proceedings')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo the move of 304' }))
    expect(within(semester('Year 3, 1st sem')).getByText('Basic Succession Law')).toBeInTheDocument()
  })

  test('a semester over the cap turns red and asks what to do, instead of moving subjects on its own', async () => {
    saveFailed214()
    const user = userEvent.setup()
    render(<App />)
    // Full load of Year 4, 1st sem is 17; 305 (needing 214) moved in from Year 3 makes 20
    expect(units('Year 4, 1st sem')).toHaveTextContent('20 of 17 units')
    expect(units('Year 4, 1st sem')).toHaveClass('over')
    const alert = screen.getByRole('alert', { name: 'Year 4, 1st sem is over the cap' })
    expect(alert).toHaveTextContent('20 units planned, more than your cap of 17.')
    expect(within(semester('Year 4, 1st sem')).queryByText(/No room under the unit cap/)).not.toBeInTheDocument()

    await user.click(within(alert).getByRole('button', { name: 'Allow 20 units this sem' }))
    expect(screen.queryByRole('alert', { name: 'Year 4, 1st sem is over the cap' })).not.toBeInTheDocument()
  })

  test('"Fit" lets the app choose what moves out of an over-cap semester', async () => {
    saveFailed214()
    const user = userEvent.setup()
    render(<App />)
    const alert = screen.getByRole('alert', { name: 'Year 4, 1st sem is over the cap' })
    await user.click(within(alert).getByRole('button', { name: 'Fit to 17 units' }))
    expect(units('Year 4, 1st sem')).toHaveTextContent(/^1[0-7] of 17 units$/)
    expect(screen.queryByRole('alert', { name: 'Year 4, 1st sem is over the cap' })).not.toBeInTheDocument()
    // What moved went on to Year 5, 1st sem, marked as moved
    expect(within(semester('Year 4, 1st sem')).queryAllByText(/You moved it here/)).toHaveLength(0)
    expect(within(semester('Year 5, 1st sem')).getAllByText(/You moved it here/).length).toBeGreaterThan(0)
  })

  test('moving a subject warns when that blocks a subject planned soon after it', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    // 305 Commercial Laws I (Year 4, 1st sem) is needed by 312 Private International Law in Year 4, 2nd sem
    const year4 = semester('Year 4, 1st sem')
    expect(within(year4).getByText(/If you move this subject, you won't be able to take .*312 Private International Law in Year 4, 2nd sem/)).toBeInTheDocument()
    // In the Now semester too, next to Not this sem
    expect(within(semester('Year 3, 1st sem')).getByText(/If you move this subject, you won't be able to take .*315 Commercial Laws II in Year 3, 2nd sem/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Move 305 to another semester' }))
    expect(screen.getByRole('group', { name: 'Move 305 to' })).toBeInTheDocument()
  })

  test('the semester with subjects marked Taking is the Now semester', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    for (const code of ['214', '301', '302', '304', '306', '307']) {
      const group = screen.queryByRole('group', { name: `Result for ${code}` })
      if (group) await user.click(within(group).getByRole('button', { name: 'Taking' }))
    }
    // Everything in Year 3, 1st sem is Taking: it stays Now instead of jumping to Year 3, 2nd sem
    expect(within(semester('Year 3, 1st sem')).getByText('Now')).toBeInTheDocument()
    expect(within(semester('Year 3, 2nd sem')).queryByText('Now')).not.toBeInTheDocument()
    expect(within(semester('Year 3, 1st sem')).getByRole('button', { name: /214 .*: Taking/ })).toBeInTheDocument()
  })

  test('a subject marked Taking says what passing it unlocks and what failing it would cost', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    await user.click(within(screen.getByRole('group', { name: 'Result for 214' })).getByRole('button', { name: 'Taking' }))
    const now = semester('Year 3, 1st sem')
    expect(within(now).getByText(/^You need to pass this to take 315 Commercial Laws II \(Year 3, 2nd sem\), 305 Commercial Laws I \(Year 4, 1st sem\)/)).toHaveTextContent(
      'Failing it would move your graduation to Year 6, 2nd sem.',
    )
    // Subjects with nothing riding on them say so, so the student knows where to focus
    for (const code of ['301', '302', '304', '306', '307']) {
      const group = screen.queryByRole('group', { name: `Result for ${code}` })
      if (group) await user.click(within(group).getByRole('button', { name: 'Taking' }))
    }
    expect(within(now).getByText(/^You need to pass this to take 411 Legal and Judicial Ethics/)).toHaveTextContent(
      'Failing it would move that subject but not your graduation.',
    )
    expect(within(now).getAllByText('No later subject needs this one.')).toHaveLength(2)
  })

  test('a later semester\'s subject can be moved to another semester, following prerequisites; undo restores it', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    // 404 Labor Law Review is in Year 4, 2nd sem: it can only move later, to a 2nd sem
    await user.click(screen.getByRole('button', { name: 'Move 404 to another semester' }))
    const targets = screen.getByRole('group', { name: 'Move 404 to' })
    expect(within(targets).queryByRole('button', { name: 'Year 3, 2nd sem' })).not.toBeInTheDocument()
    expect(within(targets).queryByRole('button', { name: 'Year 4, 1st sem' })).not.toBeInTheDocument()
    await user.click(within(targets).getByRole('button', { name: 'Year 5, 2nd sem' }))
    expect(within(semester('Year 4, 2nd sem')).queryByText('Labor Law Review and Integration')).not.toBeInTheDocument()
    expect(within(semester('Year 5, 2nd sem')).getByText('Labor Law Review and Integration')).toBeInTheDocument()
    expect(within(semester('Year 5, 2nd sem')).getByText(/You moved it here/)).toBeInTheDocument()

    // 312 needs 305 (planned Year 4, 1st sem): Year 4, 2nd sem or later only
    await user.click(screen.getByRole('button', { name: 'Move 312 to another semester' }))
    expect(within(screen.getByRole('group', { name: 'Move 312 to' })).queryByRole('button', { name: 'Year 3, 2nd sem' })).not.toBeInTheDocument()
    await user.click(within(screen.getByRole('group', { name: 'Move 312 to' })).getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: 'Undo the move of 404' }))
    expect(within(semester('Year 4, 2nd sem')).getByText('Labor Law Review and Integration')).toBeInTheDocument()
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
    expect(units('Year 3, 1st sem')).toHaveTextContent('16 of 16 units')
  })

  test('Custom cap: a different number of units for one semester', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    await user.click(tab('Settings'))
    await user.click(screen.getByText(/Choose the units for each semester/))
    const y31 = screen.getByRole('spinbutton', { name: 'Year 3, 1st sem' })
    expect(y31).toHaveAttribute('placeholder', '12')
    await user.type(y31, '19')
    await user.click(tab('Working Subjects'))
    expect(screen.queryByRole('alert', { name: 'Year 3, 1st sem is over the cap' })).not.toBeInTheDocument()
    expect(screen.getByRole('alert', { name: 'Year 3, 2nd sem is over the cap' })).toHaveTextContent('your cap of 12')
  })

  test('clearing results keeps the curriculum; record results from scratch', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    await openDemo(user)
    await user.click(tab('Settings'))
    await user.click(screen.getByRole('button', { name: /Clear my results/ }))
    expect(screen.queryByText(/made-up demo student/)).not.toBeInTheDocument()

    await user.click(within(semester('Year 1, 1st sem')).getByRole('button', { name: 'Mark all passed' }))
    expect(within(semester('Year 1, 2nd sem')).getByText('Now')).toBeInTheDocument()
    await user.click(within(screen.getByRole('group', { name: 'Result for 111' })).getByRole('button', { name: 'Failed' }))
    expect(within(semester('Year 2, 2nd sem')).getByText('Obligations and Contracts')).toBeInTheDocument()
    expect(within(semester('Year 2, 2nd sem')).getByText(/Failed in Year 1, 2nd sem/)).toBeInTheDocument()
  })

  test('subjects can be saved as a named template and loaded again at the start', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)
    await addSubject(user, 'Year 1, 1st sem', 'LAW1', 'Contracts', 3)
    await user.type(screen.getByRole('textbox', { name: 'Template name' }), 'Evening JD')
    await user.click(screen.getByRole('button', { name: 'Save template' }))
    expect(screen.getByRole('status')).toHaveTextContent('Saved "Evening JD".')

    // Start over: the template is still there and loads the subjects back
    localStorage.removeItem('curriculum-organizer:v1')
    cleanup()
    render(<App />)
    expect(screen.queryByRole('button', { name: 'Edit LAW1 Contracts' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Evening JD/ }))
    expect(screen.getByRole('button', { name: 'Edit LAW1 Contracts' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete the template Evening JD' }))
    expect(screen.queryByRole('button', { name: /^Evening JD/ })).not.toBeInTheDocument()
  })

  test('start over goes back to setup with an empty curriculum', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    await openDemo(user)
    await user.click(tab('Settings'))
    await user.click(screen.getByRole('button', { name: 'Start over' }))
    expect(screen.getByRole('heading', { name: 'Your subjects' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Xavier University - School of Law Curriculum/ })).toBeInTheDocument()
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

    await user.click(screen.getByRole('button', { name: /Clear my results/ }))
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
