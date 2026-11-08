# Group trips (multiplayer) for rudTrip20

This branch lets people travel together in rudTrip20. You start a group trip, send the join link to friends, and everyone in the room can see each other's rolls and, if they choose to share it, where they are on the map and the globe.

It works on both pages: `rudTrip20/index.html` (the Feeling Lucky page with the street map) and `rudTrip20/globe.html` (the globe page). If nobody starts or joins a room, both pages behave exactly as before.

## What was added

| File | What it is |
|---|---|
| `firebase-config.js` | The web settings of the Firebase project `trip21-25f36` (shared by all apps in this repository). These values are public by design. |
| `rudTrip20/js/multiplayer.js` | All of the group trip logic and its small "Group trip" panel (bottom left of the screen). |
| `database.rules.json` | The security rules for the live database. **You must paste these into the Firebase console once (steps below).** |
| `firebase.json` and `.firebaserc` | Tell the Firebase command line tool which project and which rules file to use (only needed if you ever use the command line tool). |
| `tests/database-rules.test.mjs` | An automatic check of the rules (optional, for developers). |

## The one thing you must do: publish the rules

Until the rules are published, the database either refuses everything or, in test mode, accepts everything. Publish the rules like this:

1. Open the Firebase console at https://console.firebase.google.com and choose the project **trip21**.
2. In the left menu choose **Build**, then **Realtime Database**.
3. Click the **Rules** tab.
4. Delete everything in the box and paste in the whole contents of `database.rules.json` from this repository.
5. Click **Publish**.

You should see "Rules published". If the Rules tab shows a red error, check that you pasted the complete file.

## The second thing to check: anonymous sign-in

1. In the Firebase console choose **Build**, then **Authentication**, then the **Sign-in method** tab.
2. Make sure **Anonymous** is switched on (Enabled).
3. Still in Authentication, open **Settings**, then **Authorised domains**, and make sure `rudventur.github.io` is in the list (and `localhost` if you want to test on your own computer). If you use your own domain such as rudventur.com, add that too.

If anonymous sign-in is off, the panel shows: "Anonymous sign-in is not switched on in the Firebase project yet."

## Test it with two browser tabs

1. Open the globe page (or the Feeling Lucky page) in one tab. Run `python3 -m http.server 8000` in the repository folder and open `http://localhost:8000/rudTrip20/globe.html` (for this to sign in, `localhost` must be in the authorised domains, see above). Once the branch is merged and the site is published, use the published address of the same page instead.
2. Click **Group trip** at the bottom left, type a name, and click **Start group trip**. A five letter room code appears.
3. Click **Copy join link**, then open that link in a second tab. For a more honest test use a private window, because it counts as a different person. You can also use your phone.
4. The panel in both tabs should say "2 online" and list both names.
5. In one tab click **Share my location (rough)** and allow the location question from the browser. In the other tab a coloured dot with that name appears on the map and the globe. A rough position is rounded to about one kilometre. Tick **Exact instead of rough** to see the difference.
6. Click **Stop sharing**. The dot disappears in the other tab straight away, because your position is deleted from the database.
7. Roll something in one tab (Lucky Place, Lucky Event or Good Trip, or I'm Feeling Lucky). The other tab shows the same target and the roll appears in the **Rolls** list.
8. Close one tab without clicking anything. After a moment the other tab shows that person as offline and their dot is gone.

## How it behaves

- **Who you are:** Firebase anonymous sign-in. No account, no email. The name shown is the one you type in the panel (it is remembered in your browser).
- **Joining:** anyone who has the room code or link can join, unless the host locks the room. The host can lock the room and can end it for everyone. Keep the link to people you trust.
- **Location is off until you switch it on.** The default when you do is rough (about one kilometre). Exact is a separate tick box. One click on **Stop sharing** deletes your position.
- **How often positions are sent:** at most once every 5 seconds, and only after you have moved about 25 metres. While you stand still, one refresh a minute. Nothing is sent while the browser tab is hidden.
- **Greyed out:** a position older than 10 minutes is shown in grey with "away".
- **Going offline:** when your connection drops or you close the tab, Firebase marks you offline and removes your position by itself.
- **What is stored:** room settings, member names, online status, your current position (only while sharing), and the rolls. There is no location history. Rooms are not deleted automatically, except when the host leaves as the last person or ends the room. Old empty rooms can be deleted by hand in the console (Realtime Database, Data tab).

## What the rules enforce (database.rules.json)

- Only signed-in people can do anything. Nothing outside `rooms` can be read or written.
- Only members of a room can read it.
- You can only write your own member entry, your own online status and your own position. Nobody can move someone else's dot.
- Coordinates must be real (latitude -90 to 90, longitude -180 to 180), and a position cannot be dated in the future.
- Only the host can change the room settings (locking) or delete the whole room.
- A roll must be posted under your own identity, cannot be edited afterwards, and has size limits on its text.
- A room cannot be taken over: creating a room with a code that already exists is refused.

## Billing

Everything used here (live database, anonymous sign-in) works on the free Spark plan for small groups. No Cloud Functions are used.

## Known limits

- A room code has five characters, so a determined person could guess codes. Locking the room once everyone is in closes that gap. A later version could add a password.
- On the Feeling Lucky page the players appear on the result map (after a roll, a real street map) and on the small start map (a grid globe). On the globe page they appear on the globe.
- This does not use the older map-merger-venti Firebase project at all; that project is untouched.

# Restaurant tables

Guests talk to each other at restaurant tables. A restaurant owner sets up the tables, and every table has a code. The code works while the owner has Trip21 open, and for 4 hours after the owner leaves. The code lives in the same Firebase project (trip21-25f36). The code for this is in `rudTrip20/js/restaurant-tables.js`.

## For guests

- Open the useRbox (the R circle, top right). In the left section, **🍽️ RESTAURANTS** lists the restaurants that are open and their tables.
- Type the code you see on your table and click **Join table**, or scan the code printed on the table. It opens Trip21 with `?table=CODE` and sits you down straight away.
- At the table, a small panel shows who is there (● online, ○ away) and a chat.
- When the code runs out, or the owner closes the restaurant, or the owner makes a new code for the table, you leave the table automatically.

## For owners

1. In the useRbox settings (right section) open **🍽️ MY RESTAURANT (TRIP21)** and click **Sign in with Google**.
2. Find your place on openstreetmap.org, click it, copy the link (for example `https://www.openstreetmap.org/node/123456`) and paste it into the claim box. Check the name and click **Claim**.
3. Wait until Mateusz approves it. Then you can open or close the restaurant, add, rename and remove tables, see each table code and how long it has left, make a new code (this removes the people at that table), and print a sheet with a scannable code for every table.
4. While you keep Trip21 open, every code is refreshed every 5 minutes so it stays valid for the next 4 hours. When you sign out or close Trip21, the codes run out 4 hours later. When you come back, the same codes start working again, so a printed sheet stays useful.

## For Mateusz (the approver)

- Your own approver flag is stored in the database at `admins/<your user id>` with the value `true`. Nobody can write it from the web page; you add it once by hand in the Firebase console.
- Once you are an approver, **🛡️ CLAIMS WAITING** appears under My restaurant with **Approve** and **Refuse** buttons.

## What the rules enforce for tables

- Only people signed in with Google can claim a restaurant, and a claim always starts as not approved and closed. Only an approver can approve. Nobody can take over somebody else's claim.
- Only the approved owner can open the restaurant, change its tables and make codes.
- A code can be valid for at most 4 hours (plus 5 minutes of slack) from the database clock. Expired codes cannot be read, and the full list of codes cannot be read at all.
- You can only sit at a table with a code that is still valid, belongs to that exact table, and while the restaurant is open and approved.
- Reading the table, being online there and chatting all need a still valid code, so once the code runs out the guests lose the table at once, even if their page is still open.
- Chat messages are posted under your own identity, cannot be edited, and have up to 300 characters.
- The owner can read and chat at their own tables and clear a table.

## Testing on this computer

`tests/database-rules.test.mjs` now also checks the restaurant rules (100 checks in total). For a test in the browser, start the emulators (`npx firebase emulators:start --only database,auth --project trip21-25f36`), serve the repository folder, and open `http://localhost:<port>/rudTrip20/index.html?emulator=1&table=CODE`. The `emulator=1` switch only works on localhost.
