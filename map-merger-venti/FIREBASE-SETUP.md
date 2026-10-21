# Snout First: switching on the shared map

Snout First works in two ways:

- **This device only** (how it ships today). Pets, walks, notes and spots are
  saved in your browser and nothing is sent anywhere. A small note at the
  bottom of the map says "📱 This device only". Tap it to see why.
- **Shared map.** Pets that people pin are seen by everyone who opens
  Snout First. The note at the bottom says "🌐 Shared map on".

The shared map switches on by itself once the three steps below are done.
It stays on the free Firebase plan. The paid plan (called Blaze) is **not**
needed.

---

## What you need to do in Firebase (about 10 minutes)

Open the Firebase console at https://console.firebase.google.com and choose
the project **map-merger-venti**.

### Step 1: Turn on anonymous sign-in

Each visitor is signed in quietly, without an account or password. This
gives every visitor a private sign-in number, so the database knows who owns
which pet and only lets owners change their own pets.

1. In the menu on the left, open **Build**, then **Authentication**.
   If you see a **Get started** button, press it.
2. Open the **Sign-in method** tab.
3. Choose **Anonymous**, switch it to **Enable**, and press **Save**.

### Step 2: Copy the web app settings into the code

1. Press the gear icon next to **Project Overview** (top left), then
   **Project settings**.
2. Scroll down to **Your apps**.
   - If there is no web app yet, press the **web icon** (it looks like
     `</>`), give it a nickname such as "Snout First", leave the hosting box
     unticked, and press **Register app**.
   - If there already is a web app, click on it.
3. You will see a block of code that starts with `const firebaseConfig = {`.
4. Open `js/firebase-config.js` in this repository. Near the top is the same
   block with empty values marked `← PASTE`. Copy each value across:
   `apiKey`, `authDomain`, `projectId`, `storageBucket`,
   `messagingSenderId` and `appId`.
   Keep the `databaseURL` line as it is, unless the value Firebase shows you
   is different; in that case use Firebase's value.
5. Save and publish the change (commit it to the main branch).

These values are not secret. Every website that uses Firebase shows them to
its visitors. What protects the data is the set of rules in step 3.

### Step 3: Publish the database rules

1. In the menu on the left, open **Build**, then **Realtime Database**.
   (If it asks you to create a database, choose the location **Belgium
   (europe-west1)** and **Start in locked mode**.)
2. Open the **Rules** tab.
3. Delete everything in the box and paste in the whole contents of
   `database.rules.json` from this repository.
4. Press **Publish**.

People who use the Firebase command line tool can do the same thing with
`firebase deploy --only database` from the repository folder.

### Check that it works

Open https://rudventur.github.io/map-merger-venti/snout-first.html. After a
second or two the note at the bottom should change from "⏳ Connecting…" to
"🌐 Shared map on". Pin a pet, then open the page in a private window or on
your phone: the pet should appear there too.

If it says "📱 This device only" instead, tap the note to see the reason:

- *"Sharing is not set up yet"*: a value in `js/firebase-config.js` is still
  empty (step 2).
- *"Could not sign in to the shared map"*: anonymous sign-in is not turned
  on (step 1).

---

## What is shared, and what stays on the device

| Thing | Shared with others? |
|---|---|
| Pet name, kind, breed, short description, personality tags, mood | Yes, when you pin it |
| Pet's home spot on the map | Yes, but rounded to about 100 metres |
| Pet photo | **No.** Photos stay on your device (see below) |
| Walk route while walking | **No.** It stays on your device |
| A finished walk | Only if you say yes when asked. Then the distance, the time and a rough route (rounded to about 100 metres, at most 200 points) are shared |
| Your own position (SHOW ME) | Shared once when you press SHOW ME, rounded to about 100 metres. It is not updated in the background, and it is removed when you press SHOW ME again or close the page |
| Lost pet alert | Yes, for your own pets only, with the last-seen spot rounded to about 100 metres. It is taken down when you mark the pet as found |
| Feeding log | Yes. Anyone signed in can log that they fed a pet. The owner gets a note |
| Notebook, vets, food banks, saved spots | No, they stay on your device |

### Why photos stay on the device

Photos are big. Storing them in the shared database would use up the free
allowance quickly, and a photo can show where someone lives. So a pet photo
is shrunk and kept in your browser only. Other people see the pet's emoji
instead. Sharing photos could be added later with Firebase Storage, which has
its own free allowance.

### Who can do what

- Only the owner of a pet (the visitor who pinned it) can change it, take it
  out for a walk, bring it home, report it lost or delete it. The database
  rules enforce this, not just the page.
- The old "wandering pets" game, where pets walked around by themselves and
  anyone could pick them up, has been removed. It moved pets on the map that
  nobody was really walking, which does not fit the "real live data only"
  rule.
- The six made-up example pets (Sir Barkington and friends) have been
  removed, including from browsers that had saved them. An empty map now says
  "No pets on the map yet".
- Anonymous sign-in is tied to the browser. If someone clears their browser
  data or changes phone, they get a new sign-in and can no longer edit pets
  they pinned before. (Linking an email or Google account later would fix
  this.)

---

## Why the Tractive connection is switched off

The Tractive form used to ask for your Tractive email and password. It is now
replaced by a short note on why, and asks for nothing. "+ link device" on the GPS tab makes the phone itself the tracker instead. Reasons:

1. The helper that talked to Tractive (in the `functions` folder) is a
   Firebase Cloud Function. Cloud Functions only run on the paid Blaze plan,
   and the helper is not running today (its web address gives a "not found"
   error).
2. Tractive has no official public way for other apps to connect. Their only
   official smart-home link is Homey; the Home Assistant link is made by
   volunteers. The helper used an unofficial connection that Tractive can
   change or block at any time.
3. Sending people's Tractive passwords to our own server means we would be
   holding their passwords. If anything went wrong, their tracker accounts
   (which show where their pet, and often they, are) would be at risk.

If Tractive ever offers an official connection, this can come back.

---

## Limits to keep an eye on

The free plan allows about 100 people connected at the same moment, 1
gigabyte of stored data and 10 gigabytes of downloads a month. The rules cap
the size of every entry (names up to 40 letters, descriptions up to 200, at
most 8 tags, routes up to 200 points), but a determined person could still
add a lot of pets. Check **Realtime Database → Usage** now and then. If it
is ever abused, you can switch the shared map off at once by publishing
rules that say `".read": false, ".write": false` for everything, and Snout
First will go back to "This device only".

---

## For developers: testing the rules

`tests/database.rules.test.mjs` checks the rules against Firebase's local
practice database on your own computer (it never touches the real project).
It needs Node and Java installed:

```
npm install --save-dev firebase-tools @firebase/rules-unit-testing firebase
npx firebase emulators:exec --only database --project demo-snoutfirst "node tests/database.rules.test.mjs"
```
