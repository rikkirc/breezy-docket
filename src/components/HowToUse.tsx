/** What the app is for, in two sentences. Shown on the welcome page. */
export function AppIntro() {
  return (
    <p className="intro-text">
      Breezy Docket plans the rest of your subjects semester by semester, under the units you can carry, and shows
      when you'll graduate. It's for college, graduate and professional students alike, whether you study full time
      or work while you study. When you fail or skip a subject, it moves that subject and everything that needs it, so
      you can see what to focus on and avoid being extended.
    </p>
  )
}

/** The steps, in the order a student goes through them. Shown on the welcome page and from Settings. */
export function HowToUseSteps() {
  return (
    <ol className="how-to">
      <li>
        <strong>Sign in or create an account.</strong> Your plan is kept in your account, so it opens on your phone
        and your laptop.
      </li>
      <li>
        <strong>Set up your curriculum.</strong> Enter your program's subjects, units and prerequisites, or start from a
        template such as the Xavier University - School of Law Curriculum. If your school offers summer classes, turn them on.
      </li>
      <li>
        <strong>Record your past semesters first, in order, as they actually happened.</strong> Start with Year 1, 1st
        sem: mark each subject <em>Passed</em> or <em>Failed</em>, then go on to the next semester, up to now.
        <p className="how-to-example">
          Example (law): you took 214 Corporation and Basic Securities Law in Year 2, 1st sem and failed it. Mark it{' '}
          <em>Failed</em> in Year 2, 1st sem, not <em>Taking</em>. The app moves it to its next offering, and that's
          where you record the retake.
        </p>
      </li>
      <li>
        <strong>Mark Taking only for subjects you're enrolled in this semester.</strong> Each one tells you which later
        subjects need it passed and what failing it would do to your graduation.
      </li>
      <li>
        <strong>Come back each semester.</strong> Mark your results, and your plan and expected graduation update on
        their own. Use <em>Not this sem</em> or <em>Move…</em> for subjects you'll take later; a semester in red is over
        your unit cap.
      </li>
    </ol>
  )
}

/** The welcome page, before signing in. */
export function Welcome({ onStart, onPrivacy }: { onStart: () => void; onPrivacy: () => void }) {
  return (
    <section className="welcome" aria-labelledby="welcome-heading">
      <div className="brand">
        <p className="tagline">Breeze your way through every sem, all the way to graduation.</p>
        <p className="byline">by: RCbreezy©</p>
      </div>
      <h2 id="welcome-heading">What it does</h2>
      <AppIntro />
      <h2>How to use it</h2>
      <HowToUseSteps />
      <div className="row welcome-actions">
        <button type="button" className="primary" onClick={onStart}>
          Get started
        </button>
        <button type="button" className="link small-text" onClick={onPrivacy}>
          Privacy notice
        </button>
      </div>
    </section>
  )
}

/** "How to use" from Settings. */
export function HowToUsePage({ onBack }: { onBack: () => void }) {
  return (
    <section className="how-to-page" aria-labelledby="how-to-heading">
      <button type="button" className="link small-text" onClick={onBack}>
        ← Back
      </button>
      <h2 id="how-to-heading">How to use Breezy Docket</h2>
      <div className="card">
        <AppIntro />
        <HowToUseSteps />
      </div>
    </section>
  )
}
