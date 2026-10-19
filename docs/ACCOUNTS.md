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
  rules let only that signed-in student read, write or delete it from the app, and only in that shape. Nobody can
  list plans. (The Firebase project's owner can still see the data in the Firebase console, as the Privacy notice
  says.)
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
Firestore Database in the Firebase console) and linked to the student's sign-in. No other student can see them: in
the app, only the student can open their plan. The project's owner can access the data in the Firebase console. The in-app **Privacy notice** (linked from the sign-in screen and Settings → Account) explains this.

Before an account is created (Create account, or Continue with Google), the student ticks "I've read the Privacy
notice and agree…". The date they agreed is saved in their plan document as `consentedAt` (an ISO date-time) and
kept on every later save. Signing in to an existing account with email doesn't ask again. Students can delete
everything with **Delete my account**.

Accounts made before the notice have no `consentedAt`: once signed in, they see "Please review the Privacy notice"
with **I agree** (saves the date) or **Sign out**, and can't use the app until they choose. Settings → Account
shows the date agreed.

**The rules in Firebase must match the app.** When the app starts saving something new (as it did with
`consentedAt`), the published rules have to allow it, or every save is refused with "permission denied". The
rules are published automatically on every merge that changes `firestore.rules` (next section); by hand, it's
Firestore Database → Rules → paste → Publish.

The contact address at the end of the notice is `PRIVACY_CONTACT` in `src/components/PrivacyNotice.tsx`.

## Deploying the rules automatically

The **Firestore rules** workflow (`.github/workflows/firestore-rules.yml`) runs on every merge to `main` that changes
`firestore.rules`, and from the Actions tab (**Run workflow**). It runs the rules tests on the Firebase emulators
first; only if they pass does it publish the file with `scripts/deploy-rules.mjs`, the same as Publish in the
console. It uses only the Firebase Rules API, so its key can change rules and nothing else: it can't read or
change anyone's data.

### One-time setup: a key with the least access (about 5 minutes)

1. Open the Google Cloud console for the Firebase project:
   <https://console.cloud.google.com/iam-admin/serviceaccounts?project=curriculum-organizer-ce412>
   (sign in with the Google account that owns the Firebase project).
2. Click **+ Create service account**. Name: `rules-deployer`. Description: "Publishes Firestore rules from GitHub
   Actions". Click **Create and continue**.
3. Under **Grant this service account access to project**, choose the role **Firebase Rules Admin** (type "Rules"
   in the filter). Add no other role. Click **Continue**, skip the last step, then **Done**.
4. Click the new `rules-deployer` account → **Keys** tab → **Add key** → **Create new key** → **JSON** → **Create**.
   A `.json` file downloads. Treat it like a password.
5. On GitHub: the repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   Name: **`FIREBASE_RULES_DEPLOY_KEY`**. Secret: open the `.json` file in a text editor and paste its whole
   contents. Click **Add secret**.
6. Delete the downloaded `.json` file from your computer.
7. Check it works: **Actions** → **Firestore rules** → **Run workflow** → `main`. Both jobs (test, deploy) should
   go green, and the Firebase console's Firestore Database → Rules tab should show a new publish time.

If the deploy step fails:
- "secret is not set" → step 5 (the name must be exactly `FIREBASE_RULES_DEPLOY_KEY`).
- "(403) … needs the Firebase Rules Admin role" → step 3, on the `curriculum-organizer-ce412` project.
- "(400) … The rules have an error" → nothing was published; fix `firestore.rules` (the tests should have caught it).

To replace the key (e.g. if it may have leaked): in **Keys**, delete the old key, create a new one (step 4) and
update the secret (step 5).

## Tests

- `npm test` covers the sign-in flow in the app with a stand-in for Firebase (`src/Account.test.tsx`).
- `npm run test:firebase` runs the real account code and the security rules against the Firebase emulators
  (needs Java; CI runs it on every push).
