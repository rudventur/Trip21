# ArtSpace City

An interactive map-based exploration game where you navigate the world in 9 different vehicles, discover artist communities, and visualize creative networks — all rendered on HTML5 Canvas with a retro-futuristic terminal aesthetic.

Built by [RudVentur](https://rudventur.com) — part of the RudVentur creative web universe.

---

## What Is This?

ArtSpace City merges an explorable global map with multiple transportation modes, real-world weather data, and an art community network. Pin art spaces, connect offers and seeks with "conspiracy strings", and cruise from London to Tokyo in a train, boat, plane, or UFO.

---

## Features

### 9 Vehicle Modes
- **Walk** — 5 km/h, basic movement
- **Bike** — 4 variants (Road, Mountain, Trike, E-Bike), 15–28 km/h
- **Scooter** — 35 km/h
- **Car** — 8 variants (Hatchback to Supercar), fuel system, road snapping, petrol stations
- **Bus** — 45 km/h with route stops
- **Train** — 6 variants (Regional to Maglev, up to 600 km/h), track snapping with gap-jumping
- **Boat** — 4 variants (Dinghy to Speedboat), water boundary enforcement
- **Plane** — 13 aircraft (Cessna to SR-71), altitude control, 50+ hardcoded airports, approach mode
- **UFO** — ∞ km/h, conspiracy mode with art network visualization

### Map & Layers
- 5 base tile layers (CartoDB Dark, OpenStreetMap, OpenTopoMap, Watercolor, ArcGIS Satellite)
- Smooth fractional zoom (levels 2–19)
- Coordinate grid, compass, overlays toggle
- OpenRailwayMap overlay for train mode

### Real-World Data
- **Weather** — Open-Meteo (clouds, rain, snow, fog, wind, temperature)
- **Lightning** — Blitzortung WebSocket with distance-based thunder synthesis
- **Rain Radar** — RainViewer precipitation overlay
- **Search** — Nominatim (OSM) city/place lookup
- **Infrastructure** — Overpass API for railways, roads, water bodies, bus stops, petrol stations

### Art Network
- Pin art spaces with offer/seek types (Print, Ceramics, Darkroom, Wood, Textile, etc.)
- Exchange types: Free, Swap, Donation, Skills
- Red "conspiracy strings" connecting compatible offers and seeks
- User comments dropped as map notes
- UFO mode: draw custom strings, auto-matching connections panel

---

## Controls

| Action | Keyboard | Mobile |
|--------|----------|--------|
| Move | Arrow keys / WASD | D-Pad buttons |
| Zoom In | `+` / `=` | Zoom slider / Pinch |
| Zoom Out | `-` | Zoom slider / Pinch |
| Search | Enter (in search input) | GO button |
| Close modals | Escape | — |

Vehicle switching, layers, pins, and other features are accessed via the HUD buttons.

---

## Tech Stack

- **Rendering**: HTML5 Canvas, vanilla JavaScript (~230 KB JS total)
- **Map Tiles**: Web Mercator projection with custom tile loading/caching (LRU, 600 tiles max)
- **Styling**: CSS3 with retro terminal aesthetic (VT323 + Press Start 2P fonts)
- **Audio**: Web Audio API (thunder synthesis)
- **No frameworks, no build step** — runs directly from static files

### External APIs

| Service | Purpose | Auth Required |
|---------|---------|---------------|
| Nominatim (OSM) | City/place search | No (User-Agent header) |
| Overpass API | Railways, roads, water, amenities | No (rate-limited) |
| Open-Meteo | Real-time weather | No |
| Blitzortung | Live lightning strikes | No |
| RainViewer | Rain radar tiles | No |
| CartoDB / OSM / TopoMap / ArcGIS | Base map tiles | No |

---

## File Structure

| File | Purpose |
|------|---------|
| `index.html` | UI layout — HUD, buttons, modals, vehicle bar, panels |
| `game.js` | Main loop, canvas setup, controls, movement physics |
| `config.js` | Vehicle definitions, aircraft fleet, countries, demo art spaces, tile URLs |
| `ui.js` | Layers menu, zoom system, country selector, grid, compass, conspiracy strings |
| `tiles.js` | Tile loading/caching, Web Mercator math, coordinate conversions |
| `utils.js` | Helpers — haversine distance, toasts, color pickers, Overpass rate limiter |
| `player.js` | Player sprite routing per vehicle mode |
| `car.js` | Car variants, roads, fuel system, petrol stations, road snapping |
| `train.js` | Train variants, railways, stations, track snapping |
| `bike.js` | Bike variants, animated sprites |
| `boat.js` | Boat variants, water body detection, water boundaries |
| `mode-plane.js` | Aircraft fleet, airports, flight tracking, altitude, Blitzortung, thunder |
| `mode-ufo.js` | UFO atmosphere, user-drawn strings, auto-matching, notebook |
| `mode-train.js` | Train atmosphere — clouds, sunshine, rain, parallax trees |
| `weather.js` | Open-Meteo fetch, rain/snow particles, cloud overlay, fog, lightning |

---

## Running

Open `index.html` in a browser. No build step or server required.

For local development with live reload:
```bash
npx serve .
```

---

## Architecture

- **Global state object `G`** centralizes game state (position, zoom, vehicle, overlays, listings)
- **Render pipeline** draws ordered layers each frame: tiles → overlays → infrastructure → pins → effects → player → compass
- **Player always centered** — the world pans around the player at `(canvas.width/2, canvas.height/2)`
- **Vehicle mode dispatch** — each vehicle has its own data loader and movement constraints
- **Overpass rate limiter** — 3-second minimum gap between API requests to avoid 429 errors

---

*Built by [RudVentur](https://rudventur.com)*

---

# Snout First — Map Spots System & Project Structure Update

**Addendum to main README — v0.3**
**Part of the RudVentur Universe** — [rudventur.com](https://rudventur.com)
**Live at:** https://rudventur.github.io/map-merger-venti/snout-first.html

---

## Project Structure Decision

Snout First stays as a **folder inside map-merger-venti** repo. It shares Firebase, map tiles, and the Leaflet instance with Map Merger Venti.

```
map-merger-venti/
├── index.html                      ← Map Merger Venti main
├── snout-first/
│   ├── index.html                  ← Snout First main page
│   ├── css/
│   │   └── snout.css               ← Snout First specific styles
│   ├── js/
│   │   ├── petuserbox.js           ← Pet profile component
│   │   ├── pet-registration.js     ← Pet creation
│   │   ├── pet-feed.js             ← Sniff posting
│   │   ├── pet-on-map.js           ← Pet emoji on map
│   │   ├── wandering.js            ← Wandering system
│   │   ├── feeding.js              ← Feeding log
│   │   ├── notifications.js        ← Owner notifications
│   │   ├── distance.js             ← Haversine tracking
│   │   ├── map-spots.js            ← Map spots system
│   │   ├── clown-markers.js        ← User presence (clowns)
│   │   └── timers.js               ← Countdown/countup engine
│   └── assets/
│       └── (pet photos cached, icons, etc.)
├── js/
│   ├── firebase-config.js          ← Shared Firebase config
│   ├── auth.js                     ← Shared auth
│   ├── channels.js                 ← Map channels
│   ├── languages.js                ← Translator data
│   └── translator-layer.js         ← Translator layer
├── translator_v7.html              ← Standalone translator
└── README.md                       ← Main README
```

**URL structure:**
```
rudventur.github.io/map-merger-venti/                 ← MMV
rudventur.github.io/map-merger-venti/snout-first/     ← Snout First
```

---

## Map Spots System — The Big New Feature

### What Is a Map Spot?

A spot is a GPS marker placed on the map by any user. It can be ANYTHING:

- **Pet grave / memorial** — "Here lies Rex, the best boy. 2015-2026"
- **Stray cat feeding station** — "Orange tabby lives here, feed daily"
- **Danger zone** — "Busy road, keep dogs on lead"
- **Event** — "Dog meetup Saturday 3pm" (with countdown)
- **Lost pet** — "Lost black cat, last seen here" (expires in 48h)
- **General marker** — anything the user wants to pin
- **Vet / shelter / pet shop** — community-added locations
- **Roadkill warning** — "Hedgehog crossing, drive slow"
- **Dog park** — "Off-lead area, good for big dogs"
- **Photo spot** — "Great spot for pet photos"

### Spot Types

Every spot has a `type` that determines its icon, behaviour, and whether it has timers:

```javascript
const SPOT_TYPES = {
  memorial:    { emoji: '🪦', label: 'Memorial',       timers: ['time_since'],         permanent: true },
  grave:       { emoji: '⚰️', label: 'Grave',           timers: ['time_since'],         permanent: true },
  feeding:     { emoji: '🍖', label: 'Feeding Station', timers: [],                     permanent: true },
  danger:      { emoji: '⚠️', label: 'Danger Zone',     timers: [],                     permanent: true },
  event:       { emoji: '🎉', label: 'Event',           timers: ['countdown'],          permanent: false },
  lost_pet:    { emoji: '🔍', label: 'Lost Pet',        timers: ['expires'],            permanent: false },
  found_pet:   { emoji: '🎾', label: 'Found Pet',       timers: ['expires'],            permanent: false },
  vet:         { emoji: '🏥', label: 'Vet / Shelter',   timers: [],                     permanent: true },
  park:        { emoji: '🌳', label: 'Dog Park',        timers: [],                     permanent: true },
  warning:     { emoji: '💀', label: 'Warning',         timers: ['expires'],            permanent: false },
  photo_spot:  { emoji: '📸', label: 'Photo Spot',      timers: [],                     permanent: true },
  water:       { emoji: '💧', label: 'Water Bowl',      timers: [],                     permanent: true },
  custom:      { emoji: '📌', label: 'Custom',          timers: ['countdown','expires'], permanent: false },
};
```

---

## Timer System

Every spot can have ONE OR MORE timers attached. Four timer modes:

### 1. Time Since (count UP from a past date)
```
🪦 Rex — Best Boy Ever
   Passed: 14 March 2024
   ⏱️ 2 years, 25 days ago
```
Counts up forever. Used for memorials, graves, anniversaries.

### 2. Countdown (count DOWN to a future date)
```
🎉 Dog Meetup @ The Park
   Saturday 22 March, 15:00
   ⏱️ 2 days, 4 hours, 12 minutes
```
When reaches zero: shows "HAPPENING NOW" for the event duration, then switches to "time since" mode ("Happened 3 days ago").

### 3. Expires (count DOWN, spot disappears when done)
```
🔍 Lost Cat — Black, white paws
   Last seen: here, 2 hours ago
   ⏱️ Expires in 46 hours
```
When reaches zero: spot is auto-hidden (not deleted — stays in database as `expired: true` for history). Can be renewed by the creator.

### 4. Full Timestamp (always shown)
Every spot regardless of type shows:
```
Created: 18 Mar 2026, 23:14 GMT
GPS: 51.5074° N, 0.1278° W
```

### Timer Data Structure

```javascript
// Each spot can have multiple timers
timers: [
  {
    id: "timer_1",
    mode: "time_since",        // time_since | countdown | expires
    target_date: 1710720000000, // the date it counts from/to
    label: "Passed",           // what to show before the time
    duration_hours: null,      // for expires: how long until expiry
  },
  {
    id: "timer_2",
    mode: "countdown",
    target_date: 1711900800000,
    label: "Event starts",
    duration_hours: 3,         // event lasts 3 hours after target_date
  }
]
```

### Timer Display Engine

```javascript
function formatTimer(timer) {
  const now = Date.now();
  const diff = timer.target_date - now;

  if (timer.mode === 'time_since') {
    return formatDuration(now - timer.target_date) + ' ago';
  }

  if (timer.mode === 'countdown') {
    if (diff > 0) {
      return 'in ' + formatDuration(diff);
    } else if (timer.duration_hours && Math.abs(diff) < timer.duration_hours * 3600000) {
      return 'HAPPENING NOW';
    } else {
      return formatDuration(Math.abs(diff)) + ' ago';
    }
  }

  if (timer.mode === 'expires') {
    if (diff > 0) {
      return 'Expires in ' + formatDuration(diff);
    } else {
      return 'EXPIRED';
    }
  }
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const years = Math.floor(days / 365);

  if (years > 0) return years + 'y ' + (days % 365) + 'd';
  if (days > 0) return days + 'd ' + (hours % 24) + 'h';
  if (hours > 0) return hours + 'h ' + (minutes % 60) + 'm';
  if (minutes > 0) return minutes + 'm ' + (seconds % 60) + 's';
  return seconds + 's';
}
```

### Timer Refresh
All timers update every second in the UI. Firebase only updates on create/edit (not every tick — that would kill your quota).

---

## Clown Markers — User Presence on Map

### What Are Clowns?

When a user wants to be visible on the map, they appear as a **clown emoji**. This is the "I am here" marker.

Why clowns? Because we're all clowns on the internet, and it's funnier than a boring blue dot.

### How It Works

1. User opens Snout First / Map Merger Venti
2. Clicks **"Show Me on Map"** button (or it's automatic in channels)
3. A clown appears at their GPS position (or map center if no GPS)
4. Other users see the clown
5. Hover shows username (if set)
6. **Refresh button** — manually update your clown's position

### Clown Behaviour
- **Auto-updates position** every 30 seconds if GPS available
- **Refresh button** forces immediate position update
- **Goes stale after 5 minutes** of no updates — clown gets a sleeping badge
- **Disappears after 15 minutes** of no activity (or on disconnect via `onDisconnect`)
- **Click a clown** — see their username, how long they've been here, and their pet (if walking one)

### Clown Display
```
Active:    normal clown
Stale:     clown + sleeping (hasn't updated in 5+ min)
Walking:   clown + their pet
```

### Why a Refresh Button?
Not everyone has GPS. Not everyone wants auto-tracking. The refresh button lets users manually say "I'm HERE now" — one click, position updates. Simple, user-controlled, no creepy always-on tracking.

---

## Firebase Schema — Map Spots & Clowns

```
rudventur-social-db/
│
├── (existing snoutfirst/, mapmergerventi/, etc.)
│
├── map_spots/
│   └── {spotId}/
│       ├── type: "memorial"                // from SPOT_TYPES
│       ├── emoji: "🪦"                     // auto from type, or custom
│       ├── custom_emoji: null              // override if user picks different
│       │
│       ├── title: "Rex — Best Boy Ever"
│       ├── description: "Golden retriever who loved tennis balls..."
│       ├── photo_url: "https://..."        // optional photo
│       │
│       ├── lat: 51.5074
│       ├── lng: -0.1278
│       ├── address: "Hyde Park, London"    // optional display
│       │
│       ├── created_by: "uid_abc123"
│       ├── created_by_name: "Mateusz"
│       ├── created_at: 1710000000000       // full timestamp
│       │
│       ├── permanent: true                 // false = can expire
│       ├── expired: false                  // true when expiry timer runs out
│       ├── visible: true                   // soft delete / hide
│       │
│       ├── timers/
│       │   └── {timerId}/
│       │       ├── mode: "time_since"      // time_since|countdown|expires
│       │       ├── target_date: 1710720000000
│       │       ├── label: "Passed"
│       │       └── duration_hours: null    // for events: how long it lasts
│       │
│       ├── linked_pet_id: "pet_xyz"        // optional: links to a Snout First pet
│       │
│       ├── reactions/                      // people can react to spots
│       │   └── {uid}: "🕯️"               // candle, flower, heart, paw, etc.
│       │
│       └── comments/
│           └── {commentId}/
│               ├── from_uid, from_name
│               ├── text, timestamp
│
├── clown_markers/
│   └── {channelId}/                        // or "global" for non-channel view
│       └── {uid}/
│           ├── lat: 51.5074
│           ├── lng: -0.1278
│           ├── name: "Mateusz"             // display name
│           ├── emoji: "🤡"                 // always clown (for now)
│           ├── last_updated: 1710000000000
│           ├── pet_id: "pet_xyz"           // if walking a pet, show it too
│           └── status: "active"            // active|stale|offline
```

---

## Creating a Map Spot — UI Flow

### Step 1: User clicks "Add Spot" button or long-presses map

### Step 2: Spot Creation Form

```
┌─────────────────────────────────────────┐
│  NEW MAP SPOT                           │
│                                         │
│  Type: [Memorial      ▼]               │
│        Memorial                         │
│        Grave                            │
│        Feeding Station                  │
│        Danger Zone                      │
│        Event                            │
│        Lost Pet                         │
│        Vet / Shelter                    │
│        Dog Park                         │
│        Custom                           │
│                                         │
│  Title: [________________________]      │
│  Description: [__________________]      │
│  Photo: [Upload]                        │
│                                         │
│  GPS: 51.5074°N, 0.1278°W             │
│     [Use my location] [Pick on map]     │
│                                         │
│  ── TIMERS (optional) ──                │
│  [+ Add Timer]                          │
│                                         │
│  Timer 1:                               │
│  Mode: [Time since ▼]                  │
│  Label: [Passed___]                     │
│  Date:  [2024-03-14] Time: [09:00]     │
│                                         │
│  Timer 2:                               │
│  Mode: [Expires ▼]                     │
│  Duration: [48] hours                   │
│                                         │
│  ── LINK TO PET (optional) ──           │
│  [Link to Snout First pet ▼]           │
│                                         │
│  [Place Spot]                           │
└─────────────────────────────────────────┘
```

### Step 3: Spot appears on map instantly (Firebase real-time)

### Step 4: Other users see it, can react and comment

---

## Map Spot Rendering

### On the Map (Leaflet)

```javascript
function createSpotMarker(spot) {
  const emoji = spot.custom_emoji || spot.emoji;
  const timerText = getActiveTimerText(spot.timers);

  const icon = L.divIcon({
    className: '',
    html: `<div class="map-spot" data-id="${spot.id}" data-type="${spot.type}">
      <span class="spot-emoji">${emoji}</span>
      ${timerText ? `<span class="spot-timer">${timerText}</span>` : ''}
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  const marker = L.marker([spot.lat, spot.lng], { icon }).addTo(map);
  marker.on('click', () => openSpotPanel(spot));
  return marker;
}
```

### Spot Appearance by Type

```
Memorial     — subtle glow, muted colours, respectful
Grave        — dark border, candle animation option
Feeding      — warm amber glow, pulsing
Danger       — red pulsing border
Event        — bouncy animation, countdown badge
Lost Pet     — URGENT red pulse, expires badge
Vet          — green cross style
Park         — green leaf style
Custom       — neutral, user's choice
Warning      — skull pulse
```

### Expired Spots
When an `expires` timer runs out:
- Spot fades to 50% opacity
- Shows "EXPIRED" badge
- Still visible but clearly inactive
- Creator can "Renew" (resets timer)
- After 7 days expired: auto-hidden (visible: false)

---

## Clown Marker Implementation

### Showing Yourself

```javascript
async function showMeOnMap() {
  let pos = map.getCenter();

  if (navigator.geolocation) {
    try {
      const gps = await new Promise((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 });
      });
      pos = { lat: gps.coords.latitude, lng: gps.coords.longitude };
    } catch(e) {
      console.log('No GPS, using map center');
    }
  }

  const clownRef = ref(db, `clown_markers/${channelId}/${myUid}`);

  await set(clownRef, {
    lat: pos.lat,
    lng: pos.lng,
    name: myName || 'Anonymous Clown',
    emoji: '🤡',
    last_updated: Date.now(),
    pet_id: currentPetId || null,
    status: 'active'
  });

  onDisconnect(clownRef).remove();
}
```

### Refresh Button

```javascript
document.getElementById('btn-refresh-clown').addEventListener('click', async () => {
  let pos = map.getCenter();

  if (navigator.geolocation) {
    try {
      const gps = await new Promise((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 });
      });
      pos = { lat: gps.coords.latitude, lng: gps.coords.longitude };
    } catch(e) {}
  }

  await update(ref(db, `clown_markers/${channelId}/${myUid}`), {
    lat: pos.lat,
    lng: pos.lng,
    last_updated: Date.now(),
    status: 'active'
  });

  showToast('Position updated!');
});
```

### Stale Detection (runs on all clients)

```javascript
setInterval(() => {
  clownMarkers.forEach((marker, uid) => {
    const data = marker._clownData;
    const age = Date.now() - data.last_updated;

    if (age > 15 * 60 * 1000) {
      marker.remove();
      clownMarkers.delete(uid);
    } else if (age > 5 * 60 * 1000) {
      updateClownDisplay(marker, 'stale');
    }
  });
}, 60000);
```

---

## Spot Detail Panel (when clicked)

```
┌─────────────────────────────────────────┐
│  Rex — Best Boy Ever              [X]   │
│                                         │
│  ┌──────────┐                           │
│  │  PHOTO   │  Golden Retriever         │
│  │          │  2015 - 2024              │
│  └──────────┘                           │
│                                         │
│  "The goodest boy who ever lived.       │
│   Loved tennis balls, hated baths,      │
│   and could hear a cheese wrapper       │
│   from three rooms away."               │
│                                         │
│  Passed 2 years, 4 days ago             │
│                                         │
│  51.5074°N, 0.1278°W                   │
│  Placed: 18 Mar 2026 at 23:14          │
│  By: Mateusz                            │
│                                         │
│  ── Reactions ──                        │
│  candle 12  rose 8  heart 23  paw 15   │
│                                         │
│  ── Comments (3) ──                     │
│  "Rest easy Rex" — Alex, 2d ago         │
│  "Good boy forever" — Sarah, 5d ago     │
│                                         │
│  [Write a comment...]                   │
└─────────────────────────────────────────┘
```

---

## Updated Build Order

### Phase 1: Foundation (from original README)
1-5. Firebase project, auth, petuserbox, pet registration

### Phase 2: Snout First Core
6-10. Pet browsing, feeding log, sniff posting

### Phase 3: Map Walking
11-18. Channels, pet deployment, following, distance tracking

### Phase 4: Wandering
19-24. Disconnect, wandering, despawn, pickup, reconnect

### Phase 5: Notifications
25-28. In-app notifications, dashboard

### Phase 6: MAP SPOTS
29. Build spot type system (SPOT_TYPES config)
30. Build spot creation form (type, title, desc, photo, GPS)
31. Build timer engine (time_since, countdown, expires)
32. Render spots on map with live-updating timer badges
33. Build spot detail panel (reactions, comments)
34. Build expired spot handling (fade, renew, auto-hide)
35. Link spots to Snout First pets (optional)
36. Test: create memorial, see timer counting, add reactions

### Phase 7: CLOWN MARKERS
37. Build clown presence system
38. GPS / map-center fallback
39. Refresh button
40. Stale detection (5min sleeping, 15min remove)
41. Show pet alongside clown when walking
42. onDisconnect cleanup
43. Test: two users, see each other's clowns, go stale

### Phase 8: Polish
44. Translator Map layer toggle
45. Channel sharing URLs
46. Mobile responsive pass
47. Boot sequences
48. Walk history path replay

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v0.1 | 2026-03-18 | Initial README — virtual pet model |
| v0.2 | 2026-03-18 | Shared real-pet model, distance tracking, feeding log, notifications |
| v0.3 | 2026-04-08 | **Map Spots system** (13 spot types, 4 timer modes, reactions, comments), **Clown markers** (user presence with refresh), project stays as folder in map-merger-venti, full Firebase schema for spots + clowns |

---

## What This Enables

The map spots + clowns + pets together create a **living community map**:

- See who's nearby right now (clowns)
- See which pets are being walked (pet emojis)
- See which pets are wandering and need pickup (wandering)
- Find feeding stations for strays
- Find lost pets (with expiry timer)
- Remember pets that have passed (with "time since")
- Know about upcoming events (with countdown)
- Avoid danger zones
- Find vets and parks

All of this on ONE map. All real-time. All community-powered.

---

*Built with midnight energy by [@;PumpkinG(Claude.ai+Grok.com+!--Z.AI--!)&RudVentur:@P;@](https://rudventur.com) &copy; 2026*
