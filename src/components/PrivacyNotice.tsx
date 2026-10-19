/** Where questions and data requests go. Shown at the end of the Privacy notice. */
export const PRIVACY_CONTACT = 'rikkicabanlet@gmail.com'

/** What the app keeps, where, who can see it, for how long, and the student's rights. */
export function PrivacyNotice({ onBack }: { onBack: () => void }) {
  return (
    <section className="privacy" aria-labelledby="privacy-heading">
      <button type="button" className="link small-text" onClick={onBack}>
        ← Back
      </button>
      <h2 id="privacy-heading">Privacy notice</h2>
      <div className="card privacy-text">
        <p>
          Breezy Docket keeps your curriculum, your subject results and your unit plan so it can plan your semesters and
          show your graduation date. If you sign in, it also keeps your email address, your name if your Google account
          has one, and the date you agreed to this notice.
        </p>
        <h3>Where it's stored</h3>
        <p>On this device, and in your account on Google Firebase. Google's servers may be outside the Philippines.</p>
        <h3>Who can see it</h3>
        <p>
          No other student can see your data: in the app, only you can open it, through your account. Google stores it
          for the app, and the app's developer can access the Firebase project that holds it. It isn't shared, sold or used for ads, and the app has no analytics or tracking.
        </p>
        <h3>How long</h3>
        <p>
          Until you delete it. Settings → Delete my account removes your plan and your account. Signing out clears your
          plan and results from this device; subject templates you saved stay in this browser until you delete them.
        </p>
        <h3>Your rights</h3>
        <p>
          You can see and export your data (Settings → Export backup), correct it at any time, or delete it. Your grades
          are treated as sensitive personal information under the Data Privacy Act of 2012 (RA 10173).
        </p>
        <h3>Questions or requests</h3>
        <p>
          Email <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>
        </p>
      </div>
    </section>
  )
}
