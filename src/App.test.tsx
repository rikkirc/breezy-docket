// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App'

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

describe('the app', () => {
  test('opens on the demo student: graduation, terms and delay reasons', () => {
    render(<App />)
    expect(screen.getByText(/made-up demo student/)).toBeInTheDocument()
    expect(within(graduation()).getByText('Year 5, 2nd sem')).toBeInTheDocument()
    expect(within(graduation()).getByText(/1 year behind the standard plan/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Year 3, 1st sem' })).toBeInTheDocument()
    expect(
      screen.getByText(/Needs 214 Corporation and Basic Securities Law passed first/),
    ).toBeInTheDocument()
  })

  test('raising a term cap re-plans', async () => {
    const user = userEvent.setup()
    render(<App />)
    const cap = screen.getByRole('group', { name: 'Unit cap for Year 3, 1st sem' })
    expect(within(cap).getByText('12 / 12 units')).toBeInTheDocument()
    await user.click(within(cap).getByRole('button', { name: 'Raise the cap' }))
    expect(
      within(screen.getByRole('group', { name: 'Unit cap for Year 3, 1st sem' })).getByText(/\/ 13 units/),
    ).toBeInTheDocument()
  })

  test('recording results from scratch and planning from the next term', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)

    await user.click(tab('Settings'))
    await user.click(screen.getByRole('button', { name: 'Start fresh' }))
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

  test('remembers the data after a reload', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)
    await user.click(tab('Settings'))
    await user.click(screen.getByRole('button', { name: 'Start fresh' }))
    cleanup()

    render(<App />)
    expect(screen.queryByText(/made-up demo student/)).not.toBeInTheDocument()
  })

  test('a fresh student with cap 21 is on schedule', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)
    await user.click(tab('Settings'))
    await user.click(screen.getByRole('button', { name: 'Start fresh' }))
    await user.click(tab('Settings'))
    const cap = screen.getByRole('spinbutton', { name: /Unit cap per semester/ })
    await user.clear(cap)
    await user.type(cap, '21')
    await user.click(tab('Plan'))
    expect(within(graduation()).getByText('Year 4, 2nd sem')).toBeInTheDocument()
    expect(within(graduation()).getByText('On schedule with the standard plan.')).toBeInTheDocument()
  })

  test('what-if: failing 214 again shows a later date without saving it', async () => {
    const user = userEvent.setup()
    render(<App />)
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
    render(<App />)
    await user.click(screen.getByText('What if…'))
    await user.selectOptions(screen.getByRole('combobox', { name: /units every sem/ }), '9')
    expect(within(whatIfGraduation()).getByText('Year 6, 2nd sem')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 year later than your plan')
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
    render(<App />)

    await user.click(tab('Settings'))
    await user.click(screen.getByRole('button', { name: 'Export backup' }))
    expect(click).toHaveBeenCalled()
    const text = await exported!.text()
    expect(JSON.parse(text).student.results.find((r: { code: string }) => r.code === '214')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Start fresh' }))
    await user.click(tab('Settings'))
    await user.upload(screen.getByLabelText('Backup file'), new File([text], 'backup.json', { type: 'application/json' }))
    expect(within(graduation()).getByText('Year 5, 2nd sem')).toBeInTheDocument()
    expect(screen.queryByText(/made-up demo student/)).not.toBeInTheDocument()
  })

  test('a bad backup file is refused with a message', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(tab('Settings'))
    await user.upload(screen.getByLabelText('Backup file'), new File(['nope'], 'notes.txt', { type: 'application/json' }))
    expect(screen.getByRole('alert')).toHaveTextContent("isn't valid JSON")
  })
})

