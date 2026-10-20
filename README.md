# Trip21

One repo for the RudVentur web apps ([rudventur.com](https://rudventur.com)).
The three repos below were merged in **with their full git history**, each in its own folder:

| Folder | Was | What it is |
|---|---|---|
| `rudTrip20/` | `rudventur/rudTrip20` | Feeling Lucky trip roller: globe, itinerary, news + weather bars. See `rudTrip20/SPEC.md`, `rudTrip20/ROADMAP.md`. |
| `map-merger-venti/` | `rudventur/map-merger-venti` | ArtSpace City map game (9 vehicles, weather, lost pets, translator). Has a Firebase backend in `map-merger-venti/functions/`. |
| `cheese-ouiji-empire/` | `rudventur/cheese-ouiji-empire` | Bandit game and the popcorn window (camera, mic, movie maker). |

`index.html` at the root is the start page that links the apps.

## Trip Bandit (casino → trip)

`cheese-ouiji-empire/trip-bandit.html` is a slot machine whose reels pick the trip ticks
(continent · world · transport · days · roll kind; 🧀 = wild, 3+ 🧀 = jackpot 3-day return trip).
"Roll it for real" opens `rudTrip20/globe.html?go=1&cont=…&world=…&mode=…&days=…&dir=…&lucky=…`,
which applies those ticks and rolls a live target straight away (`rudTrip20/js/app.js`).

## Group trips (multiplayer)

`rudTrip20/` can run group trips: start a room, share the join link and see each other's rolls and
(optionally, rounded to about one kilometre) positions on the map and globe. It uses the separate
Firebase project `trip21-25f36` (`firebase-config.js`, `database.rules.json`). See `MULTIPLAYER.md`
for how to publish the rules and test it.

## useRbox: searches and inventory in its left section

The Feeling Lucky page (`rudTrip20/index.html`) loads the shared RUDVENTUR profile box
(`useRbox.js` from RudVentur.com, the R circle top right). In Trip21, `rudTrip20/js/trip21-userbox.js`
moves the trip searches and the inventory into the left section of that box, next to a group trip
shortcut. A bar on the page opens it. If the box cannot load, the page stays as it was.

## Running locally

Static site — serve the repo root over http (not `file://`):

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

## Notes

- The old repos are untouched and still live at their own `rudventur.github.io/<repo>` URLs.
  Cross-links between the apps still point there; switch them to `trip21/<folder>/` once Trip21 is on Pages.
- Firebase (`map-merger-venti/firebase.json`, project `map-merger-venti`) is unchanged; deploy functions from inside `map-merger-venti/`.
- To pull in later changes from an old repo:
  `git subtree pull --prefix=<folder> https://github.com/rudventur/<repo> main`
