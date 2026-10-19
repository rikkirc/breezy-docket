// Publishes firestore.rules to the Firebase project, the same as Firestore Database → Rules → Publish in the
// console. Run by .github/workflows/firestore-rules.yml after the rules tests pass.
//
// Uses only the Firebase Rules API, so the service account needs just the "Firebase Rules Admin" role.
//   FIREBASE_RULES_DEPLOY_KEY  the service account's JSON key (a repository secret)
//   FIREBASE_PROJECT           the project ID, e.g. curriculum-organizer-ce412
// Optional, for testing against a stand-in server: TOKEN_URL, RULES_API.
import { createSign } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const TOKEN_URL = process.env.TOKEN_URL ?? 'https://oauth2.googleapis.com/token'
const RULES_API = process.env.RULES_API ?? 'https://firebaserules.googleapis.com/v1'
const RULES_FILE = 'firestore.rules'
// The release that serves the rules of the project's (default) Firestore database.
const RELEASE = 'cloud.firestore'

function fail(message) {
  console.error(`::error::${message}`)
  process.exit(1)
}

const project = process.env.FIREBASE_PROJECT
if (!project) fail('FIREBASE_PROJECT is not set.')
if (!process.env.FIREBASE_RULES_DEPLOY_KEY) {
  fail('The FIREBASE_RULES_DEPLOY_KEY secret is not set. See docs/ACCOUNTS.md → "Deploying the rules automatically".')
}
let key
try {
  key = JSON.parse(process.env.FIREBASE_RULES_DEPLOY_KEY)
} catch {
  fail('FIREBASE_RULES_DEPLOY_KEY is not valid JSON. Paste the whole key file into the secret.')
}
if (!key.client_email || !key.private_key) fail('FIREBASE_RULES_DEPLOY_KEY is not a service account key.')

/** An OAuth access token for the service account (a signed JWT exchanged at Google's token endpoint). */
async function accessToken() {
  const now = Math.floor(Date.now() / 1000)
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/firebase',
    aud: TOKEN_URL,
    iat: now,
    exp: now + 600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url')
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.access_token) fail(`Couldn't sign in with the service account key (${res.status}): ${JSON.stringify(body)}`)
  return body.access_token
}

async function call(token, method, path, payload) {
  const res = await fetch(`${RULES_API}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const hint =
      res.status === 403
        ? ' The service account needs the "Firebase Rules Admin" role on this project.'
        : res.status === 400
          ? ' The rules have an error; nothing was published.'
          : ''
    fail(`${method} ${path} failed (${res.status}).${hint} ${JSON.stringify(body)}`)
  }
  return body
}

const content = await readFile(RULES_FILE, 'utf8')
const token = await accessToken()
// 1. Upload the rules as a new ruleset (Firebase checks them and refuses rules with errors).
const ruleset = await call(token, 'POST', `projects/${project}/rulesets`, {
  source: { files: [{ name: RULES_FILE, content }] },
})
// 2. Point the Firestore release at it: this is the "Publish".
await call(token, 'PATCH', `projects/${project}/releases/${RELEASE}`, {
  release: { name: `projects/${project}/releases/${RELEASE}`, rulesetName: ruleset.name },
})
console.log(`Published ${RULES_FILE} to ${project} (${ruleset.name}).`)
