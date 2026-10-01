# 🗺️ RudVentur Creator Map (Translator Map)

**Part of the RudVentur Universe** — [rudventur.com](https://rudventur.com)

An interactive world language map built with Leaflet.js. Explore languages by zooming in, translate text across 50+ languages in real-time, and customise every label on the map to your liking.

---

## ✨ Features

### 🏳️ Flag Markers
Every language is represented by its country's flag emoji on the map. Major languages (🇬🇧🇵🇱🇩🇪🇫🇷🇪🇸🇯🇵🇨🇳 etc.) are visible from world view. Regional and minority languages appear as you zoom into their area.

### 📌 Click-to-Move
Languages can be repositioned anywhere on the map:
1. Click **📌 MOVE** in the header
2. Click a flag — it starts blinking
3. Click anywhere on the map — language moves there
4. Press `ESC` or click the flag again to deselect

### ⚡ Live Translation (MyMemory API)
- Type any text in the translate bar
- Select a base (source) language
- Hit **TRANSLATE** or press Enter
- Translations appear on the map where language names were (in purple)
- Powered by [MyMemory](https://mymemory.translated.net/) — free, no API key required

### 🔤 Per-Language Sizing
Every language has its own font size slider, available in three places:
- **☑ Languages panel** — slider next to each checkbox
- **Side info panel** — slider when clicking a language
- **Header** — global "ALL SIZE" slider as baseline

### 💾 Full State Persistence (localStorage)
Everything saves automatically between sessions:
- Custom marker positions
- Per-language font sizes
- Checked/unchecked languages

Use **↺ RESET ALL** to wipe everything back to defaults.

### 🗂️ Language Info Panel
Click any flag (when not in move mode) to open a side panel showing:
- Country flag + hello greeting
- Country, speaker count
- Alphabet display
- Language family
- Quick grammar note
- Current translation (if active)
- Link to full grammar modal

### 🔍 Zoom-Based Layers
Languages appear/disappear based on zoom level — just like roads on Google Maps:
- **Zoom 1–2**: Major world languages only
- **Zoom 3–4**: European languages + dialects appear
- **Zoom 5–6**: Regional languages (Welsh, Catalan, Basque, etc.)
- **Zoom 7+**: Minority languages (Sorbian, Faroese, etc.)

### 🚦 Collision Resolution
When labels overlap at a given zoom level, lower-tier languages are hidden automatically. Collision padding scales with font size.

---

## 🗃️ File Structure

```
translator_v7.html    ← Single-file application (HTML + CSS + JS, all inline)
README.md             ← This file
```

No build step. No dependencies to install. Open the HTML file in a browser and it works.

**External CDN dependencies (loaded at runtime):**
- [Leaflet.js 1.9.4](https://unpkg.com/leaflet@1.9.4/) — map engine
- [Google Fonts](https://fonts.googleapis.com/) — Fira Code + Orbitron
- [CartoDB Dark Tiles](https://carto.com/basemaps/) — dark map layer
- [MyMemory API](https://mymemory.translated.net/) — translation engine

---

## 🌍 Languages Included (50+)

### Major (visible from world view)
English, Spanish, French, German, Russian, Greek, Arabic, Mandarin, Japanese, Korean, Polish, Turkish, Hindi, Italian, Portuguese, Swedish, Finnish, Hungarian, Dutch, Ukrainian, Czech, Romanian, Hebrew

### Dialects
American English, Canadian French, Mexican Spanish, Brazilian Portuguese, Swiss German (dialect of German), Moldovan (dialect of Romanian)

### Regional Europe
Welsh, Catalan, Basque, Irish, Breton, Galician, Silesian, Kashubian, Corsican, Frisian, Luxembourgish, Maltese, Estonian, Latvian, Lithuanian, Slovak, Slovenian, Albanian, Macedonian, Bosnian, Montenegrin, Icelandic, Belarusian, Bulgarian, Serbian, Croatian

### Minority
Scots Gaelic, Sorbian, Faroese

---

## ➕ Adding a New Language

Open `translator_v7.html` and find the `LANGUAGES` array. Add a new object:

```javascript
{
  name: "Language Name",
  code: "iso-code",        // ISO 639-1 or custom code
  lat: 0.0,                // latitude for map placement
  lng: 0.0,                // longitude
  country: "Country",
  speakers: "Xm+",
  tier: "major",           // "major" | "regional" | "minority"
  minZoom: 3,              // zoom level where it first appears
  family: "Language Family",
  hello: { text: "Hello" },
  alphabet: "A B C ...",
  grammar: "Short grammar note."
}
```

Then add a flag emoji to the `FLAGS` object:
```javascript
'iso-code': '🇽🇽',
```

That's it. The page renders it automatically.

---

## 🎨 Design System

| Element | Value |
|---------|-------|
| Background | `#0a0a0a` |
| Panel | `#0d1117` |
| Major accent | `#00ff41` (phosphor green) |
| Regional accent | `#00f0ff` (cyan) |
| Translation | `#c084fc` (purple) |
| Warning/Amber | `#ffb800` |
| Display font | Orbitron 900 |
| Code font | Fira Code 400/600 |
| Map tiles | CartoDB Dark |

---

## 🔧 Integration into Map Merger Venti

This translator map is designed to blend into the Map Merger Venti project. Key integration points:

**Shared map instance** — If Map Merger Venti already has a Leaflet map, the language markers can be added as a layer group that toggles on/off.

**Layer toggle** — Add a checkbox/button in Map Merger's UI to show/hide language markers:
```javascript
const langLayer = L.layerGroup(markers);
langLayer.addTo(map);     // show
langLayer.remove();        // hide
```

**Shared tile layer** — Both projects use CartoDB Dark tiles, so no conflict.

**Module extraction** — The key pieces to extract:
1. `LANGUAGES` array + `FLAGS` object → move to a shared `languages.js`
2. Marker creation logic → wrap in a function that accepts an existing map instance
3. Translation bar + side panel → can be injected into existing UI
4. localStorage keys — namespace with `rudventur-translator-` prefix to avoid collisions with Map Merger state

**Suggested approach:**
1. Copy `translator_v7.html` into the repo as reference
2. Extract the `LANGUAGES` data and `FLAGS` into `js/languages.js`
3. Create `js/translator-layer.js` with functions: `initTranslatorLayer(map)`, `toggleTranslatorLayer()`, `doTranslate(text, baseLang)`
4. Import into Map Merger's main HTML and wire up to existing controls

---

## 📋 Version History

| Version | Changes |
|---------|---------|
| v1–v4 | Initial builds with Claude Code (language data, Leaflet map, translation) |
| v5 | Fixed translate status bar, collision resolution, alphabet displays, dialect badges |
| v6 | Draggable markers, position persistence, collision padding scales with font size, duplicate Greek removed |
| v7 | **Flag emojis**, **click-to-move** mechanic, **per-language size sliders** (3 locations), **full state persistence** (positions + sizes + checked langs), zoom controls moved right, base language dropdown with flags |

---

## 🧪 Part of the RudVentur Universe

- [rudventur.com](https://rudventur.com) — Central hub
- **ChemVentur** — Multiplayer chemistry browser game
- **Snout First** — Social media for pets
- **splash_splash** — PumpKIN-Guy platformer
- **ArtSpace City** — Canvas-based interactive map game
- **Map Merger Venti** — Multi-layer map tool (this project)

---

*Built with 🧪 and late-night determination by [RudVentur](https://rudventur.com) © 2026*