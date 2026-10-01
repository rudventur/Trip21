# Trip21

One repo for the RudVentur web apps ([rudventur.com](https://rudventur.com)).
The three repos below were merged in **with their full git history**, each in its own folder:

| Folder | Was | What it is |
|---|---|---|
| `rudTrip20/` | `rudventur/rudTrip20` | Feeling Lucky trip roller: globe, itinerary, news + weather bars. See `rudTrip20/SPEC.md`, `rudTrip20/ROADMAP.md`. |
| `map-merger-venti/` | `rudventur/map-merger-venti` | ArtSpace City map game (9 vehicles, weather, lost pets, translator). Has a Firebase backend in `map-merger-venti/functions/`. |
| `cheese-ouiji-empire/` | `rudventur/cheese-ouiji-empire` | Bandit game and the popcorn window (camera, mic, movie maker). |

`index.html` at the root is the start page that links the three apps.

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
