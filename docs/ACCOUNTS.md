# Accounts (sign-in)

The app opens on a sign-in screen: students sign in (or create an account) and then see the plan saved in that
account, on any device; edits on one device show up on the others. They stay signed in on that device until they
tap **Sign out**, which returns to the sign-in screen and clears the device's copy.

Accounts run on **Firebase** (Google's free Spark plan): **Authentication** for sign-in (Google, or email and
password) and **Cloud Firestore** for each student's plan. Until `src/cloud/config.ts` has a project's config,
the app has no sign-in screen and keeps the plan in the browser only.

## One-time setup (about 10 minutes)

1. **Create the project.** Go to <https://console.firebase.google.com> → **Create a project** (e.g.
   `curriculum-organizer`). Google Analytics isn't needed.
2. **Turn on sign-in.** **Build → Authentication → Get started → Sign-in method**:
   - enable **Google** (pick a support email), and
   - enable **Email/Password** (the first switch only; leave "Email link" off).
3. **Allow the website.** **Authentication → Settings → Authorized domains → Add domain**: `rikkirc.github.io`.
4. **Create the database.** **Build → Firestore Database → Create database** → *Standard* edition, location
   **asia-southeast1 (Singapore)** (closest to the Philippines; can't be changed later) → **Start in production
   mode**.
5. **Lock it down.** **Firestore Database → Rules** → replace everything with the contents of
   [`firestore.rules`](../firestore.rules) → **Publish**.
6. **Get the web config.** **Project settings (gear) → General → Your apps → Web (`</>`)** → app nickname
   `web` (no Firebase Hosting) → **Register app**. Copy the `firebaseConfig = { … }` object.
7. **Put it in the app.** Paste it into `src/cloud/config.ts` (or send it to Claude to do), merge, and the next
   deploy has accounts.

The config values (`apiKey`, `projectId`, …) are not secrets; every Firebase web app ships them. What protects
the data is step 5's rules and step 3's authorized domains.

## How it works

- Each student's plan is one Firestore document, `plans/{their user ID}`: curriculum, results and settings. The
  rules let only that signed-in student read, write or delete it, and only in that shape. Nobody can list plans.
- **First sign-in on a device:**
  - account empty, device has a plan → the device's plan is saved to the account;
  - device blank (first visit or the demo) → the account's plan opens;
  - both have different plans → the student chooses which to keep.
- **While signed in:** edits are saved to the account shortly after they're made; changes from other devices
  appear automatically. Offline edits stay on the device and are saved when it's back online.
- **Sign out:** the plan stays in the account; this device's copy is cleared (safe on shared phones).
- **Delete my account:** deletes the stored plan and the account.
- Templates stay on the device (not in the account) for now.

## Privacy

Grades are sensitive personal information under the Data Privacy Act of 2012 (RA 10173). With an account they are
stored in Google Firebase (the region is the one chosen when the Firestore database was created; check it under
Firestore Database in the Firebase console), linked to the student's sign-in and readable only by them through the
app. The in-app **Privacy notice** (linked from the sign-in screen and Settings → Account) explains this.

Before an account is created (Create account, or Continue with Google), the student ticks "I've read the Privacy
notice and agree…". The date they agreed is saved in their plan document as `consentedAt` (an ISO date-time) and
kept on every later save. Signing in to an existing account with email doesn't ask again. Students can delete
everything with **Delete my account**.

Accounts made before the notice have no `consentedAt`: once signed in, they see "Please review the Privacy notice"
with **I agree** (saves the date) or **Sign out**, and can't use the app until they choose. Settings → Account
shows the date agreed.

**When `firestore.rules` changes, publish it again** (Firestore Database → Rules → paste → Publish). The app
version that saves `consentedAt` needs the rules that allow it; with the old rules, saves are refused.

The contact address at the end of the notice is `PRIVACY_CONTACT` in `src/components/PrivacyNotice.tsx`.

## Tests

- `npm test` covers the sign-in flow in the app with a stand-in for Firebase (`src/Account.test.tsx`).
- `npm run test:firebase` runs the real account code and the security rules against the Firebase emulators
  (needs Java; CI runs it on every push).
