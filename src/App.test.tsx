// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App'
import { demoStudent } from './data'

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function tab(name: string) {
  return within(screen.getByRole('navigation', { name: 'Sections' })).getByRole('button', { name })
}

function whatIfGraduation() {
  return screen.getByText('What-if graduation').parentElement!
}

function graduation() {
  return screen.getByText('Earliest graduation').parentElement!
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
    expect(screen.getByText(/2 subjects, 4 units/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Done: go to Working Subjects' }))
    expect(screen.getByRole('heading', { name: 'Working Subjects' })).toBeInTheDocument()
    await user.click(tab('Plan'))
    expect(within(graduation()).getByText('Year 1, 2nd sem')).toBeInTheDocument()
    expect(within(graduation()).getByText('On schedule with the standard plan.')).toBeInTheDocument()
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
    await user.click(tab('Plan'))
    expect(within(graduation()).getByText('Year 4, 2nd sem')).toBeInTheDocument()
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
    await user.click(tab('Plan'))
    expect(within(graduation()).getByText('Year 4, 2nd sem')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Unit cap for Year 1, 1st sem' })).getByText('18 / 18 units')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Unit cap for Year 1, 2nd sem' })).getByText('16 / 16 units')).toBeInTheDocument()
  })
})

describe('the demo student', () => {
  test('graduation, terms and delay reasons', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    expect(screen.getByText(/made-up demo student/)).toBeInTheDocument()
    expect(within(graduation()).getByText('Year 5, 2nd sem')).toBeInTheDocument()
    expect(within(graduation()).getByText(/1 year behind the standard plan \(Year 4, 2nd sem\)/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Year 3, 1st sem' })).toBeInTheDocument()
    expect(screen.getByText(/Needs 214 Corporation and Basic Securities Law passed first/)).toBeInTheDocument()
    expect(screen.queryByText(/\d u$/)).not.toBeInTheDocument()
  })

  test('raising a term cap re-plans', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    const cap = screen.getByRole('group', { name: 'Unit cap for Year 3, 1st sem' })
    expect(within(cap).getByText('12 / 12 units')).toBeInTheDocument()
    await user.click(within(cap).getByRole('button', { name: 'Raise the cap' }))
    expect(
      within(screen.getByRole('group', { name: 'Unit cap for Year 3, 1st sem' })).getByText(/\/ 13 units/),
    ).toBeInTheDocument()
  })

  test("taking a semester's subjects, then marking a result", async () => {
    const user = userEvent.setup()
    await openDemo(user)
    await user.click(screen.getByRole('button', { name: "I'm taking these now" }))
    expect(screen.getByRole('heading', { name: 'Taking now · Year 3, 1st sem' })).toBeInTheDocument()
    expect(within(graduation()).getByText('Year 5, 2nd sem')).toBeInTheDocument()

    await user.click(within(screen.getByRole('group', { name: 'Result for 214' })).getByRole('button', { name: 'Failed' }))
    expect(within(graduation()).getByText('Year 6, 2nd sem')).toBeInTheDocument()
    await user.click(tab('Working Subjects'))
    expect(screen.getByRole('button', { name: /Corporation and Basic Securities Law/ })).toHaveTextContent('Failed')
  })

  test('what-if: failing 214 again shows a later date without saving it', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    await user.click(screen.getByText('What if…'))
    await user.selectOptions(screen.getByRole('combobox', { name: /I fail this sem/ }), '214')
    expect(within(whatIfGraduation()).getByText('Year 6, 2nd sem')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 year later than your plan (Year 5, 2nd sem)')
    expect(screen.queryByRole('button', { name: 'Raise the cap' })).not.toBeInTheDocument()
    expect(localStorage.getItem('curriculum-organizer:v1')).not.toContain('"year":3,"sem":1,"result":"Failed"')

    await user.click(screen.getByRole('button', { name: 'Back to my plan' }))
    expect(within(graduation()).getByText('Year 5, 2nd sem')).toBeInTheDocument()
  })

  test('what-if: a different unit load', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    await user.click(screen.getByText('What if…'))
    await user.selectOptions(screen.getByRole('combobox', { name: /units every sem/ }), '9')
    expect(within(whatIfGraduation()).getByText('Year 6, 2nd sem')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 year later than your plan')
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
    expect(screen.getByRole('button', { name: /CIV101 Persons and Family Law/ })).toHaveTextContent('Passed')
  })
})

describe('results and data', () => {
  test('switching Settings to the Default cap re-plans the demo', async () => {
    const user = userEvent.setup()
    await openDemo(user)
    await user.click(tab('Settings'))
    await user.click(screen.getByRole('radio', { name: /Default/ }))
    await user.click(tab('Plan'))
    // Year 3, 1st sem's full load is 16 units; with 214 still owed, the plan can use them all
    expect(within(screen.getByRole('group', { name: 'Unit cap for Year 3, 1st sem' })).getByText(/\/ 16 units/)).toBeInTheDocument()
  })

  test('clearing results keeps the curriculum; record results from scratch', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    await openDemo(user)

    await user.click(tab('Settings'))
    await user.click(screen.getByRole('button', { name: 'Clear my results' }))
    expect(screen.queryByText(/made-up demo student/)).not.toBeInTheDocument()

    // Lands on Results: pass all of Year 1, 1st sem in one tap, and fail Criminal Law II.
    const firstSem = screen.getByRole('heading', { name: 'Year 1, 1st sem' }).closest('.group') as HTMLElement
    await user.click(within(firstSem).getByRole('button', { name: 'Mark the rest passed' }))
    await user.click(screen.getByRole('button', { name: /Criminal Law II/ }))
    await user.click(screen.getByRole('button', { name: 'Failed' }))
    expect(screen.getByRole('button', { name: /Criminal Law II/ })).toHaveTextContent('Failed')

    await user.click(tab('Plan'))
    expect(screen.getByText(/the plan starts at Year 1, 1st sem/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Plan from Year 2, 1st sem' }))
    expect(screen.queryByText(/the plan starts at/)).not.toBeInTheDocument()
    expect(screen.getByText(/Failed in Year 1, 2nd sem/)).toBeInTheDocument()
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
