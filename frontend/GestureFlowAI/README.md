# 🖐 GestureFlow AI

Touchless hand-gesture control for **Vidhan.ai** — scroll, point, and click on the website using only your webcam. No mouse, no touchscreen.

This is a **pure in-browser** feature that lives entirely inside the frontend
module — plain JavaScript + MediaPipe, nothing to install and no backend.

---

## ✅ How it's wired in

### Where it lives

The script is served from [`public/gesture-control.js`](../public/gesture-control.js) and loaded once in [`index.html`](../index.html):

```html
<script defer src="/gesture-control.js"></script>
```

That single file is the **entire integration** — it works on every page of the
app. The hand-landmark model is self-hosted alongside it at
[`public/models/hand_landmarker.task`](../public/models/hand_landmarker.task)
(served at `/models/hand_landmarker.task`), so gesture control works without
reaching any external CDN for the model.

### Using it

1. Run the frontend: `cd frontend && npm run dev` → opens `http://localhost:3000`
2. Click the **🖐 Gesture: OFF** button (bottom-right) and allow camera access
3. A **hand-skeleton monitor** appears (bottom-right): a dark panel drawing the
   21 tracked points and bones — **no camera video is ever displayed**. Colors
   show the recognised state live: indigo = tracked, cyan = scrolling,
   green = pinch/press; the index fingertip is always highlighted orange.
4. Use the **Mode** button to switch between the two modes:

#### SCROLL mode (default — "no-touch")

Point your index finger like pressing an invisible elevator button:

| Hand gesture | Action |
|---|---|
| ☝️ Index finger pointing **UP** (other fingers curled) | Page scrolls **up** steadily |
| 👇 Index finger pointing **DOWN** | Page scrolls **down** steadily |
| ⬅️ Index finger pointing **LEFT** (held ~0.1 s) | **Previous page** (`history.back()`) — one-shot with 1.6 s cooldown |
| ➡️ Index finger pointing **RIGHT** | Forward page — same one-shot rule |
| 🖐 Open palm / ✊ fist / no hand | Smooth stop |

A small pill ("⬅ Previous page") confirms each page-turn. A held point-left can
never fire twice — the hand must return to neutral before the next turn.

Reliability: the detection loop is exception-proof, the webcam auto-reconnects
if its track dies (device grabbed by another app), and the ON state survives
page reloads within the same tab session.

The status badge (bottom-left) tells you live what the AI sees, e.g. *"☝️ Scrolling UP — open your palm to stop"*.

#### CURSOR mode ("touch")

| Hand gesture | Action |
|---|---|
| ☝️ Point index finger | Cursor follows your fingertip (One-Euro-filtered: steady when still, instant when moving) |
| 🟢 Hover a button | A green outline appears around the element that a pinch will click |
| 🤏 Pinch thumb + index | **Press** — cursor locks in place (fills green) |
| ✋ Open the pinch | **Click** — released like a real mouse button |

Accuracy assists built in:
- **Pre-pinch rewind** — the click lands where you were aiming ~110 ms *before* the
  pinch motion started, so pinching can't drag the cursor off the button.
- **Button magnetism** — the click snaps to the nearest clickable element within
  ~18 px, and the green outline always previews the exact target.
- **Press-and-hold > 1.2 s cancels** the click (change your mind mid-pinch).
- Real `pointerdown/up`, `mousemove` and `click` events are dispatched, so React
  hover states and buttons behave exactly as with a physical mouse.

### Why it feels smooth (architecture)

The #1 lesson learned building this: **never scroll from the camera loop.**

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│  Camera + AI loop       │        │  Physics loop                │
│  (~30 fps, uneven)      │───────▶│  (display refresh, 60–120fps)│
│  MediaPipe HandLandmarker│ dir=−1│  time-based (dt) integration │
│  reads finger direction │  0/+1  │  ramps velocity, writes      │
│  MEASURES only          │        │  scrollTop — the ONLY thing  │
└─────────────────────────┘        │  that scrolls                │
                                   └──────────────────────────────┘
```

Key implementation details (all in `gesture-control.js`):

- **Two decoupled loops** — the camera/AI loop only *measures* the pointing direction; a separate `requestAnimationFrame` physics loop runs at the display's refresh rate and does the actual scrolling with time-based easing (`1 − e^(−rate·dt)`). Scrolling stays buttery even when the camera is slow.
- **`scroll-behavior: smooth` override** — the site's CSS sets `html { scroll-behavior: smooth }`, which makes *every* `scrollTop` write animate. 60 writes/sec would cancel each other and the page would barely move. While gesture-scrolling, the script forces `scroll-behavior: auto` inline on the scroller and **restores the original value when scrolling stops**.
- **Scroll-container auto-detection** — scrolls the page if the page scrolls; otherwise finds the largest scrollable inner container (SPAs often scroll a `<div>`, not the window).
- **2-frame direction confirmation** — a direction change needs 2 consecutive camera frames (~66 ms), so one noisy AI frame can't flip your scroll direction.
- **Sub-pixel accumulator** — slow scroll speeds accumulate fractional pixels instead of rounding to zero.
- **Fast-motion tracking** — camera requested at 60 fps; MediaPipe confidence thresholds lowered (0.3–0.4) so the hand lock survives motion blur; open palm can never scroll (≥2 non-index fingers must be curled).

### Tuning

Live in the browser console (no reload needed):

```js
window.GESTURE_SCROLL_SPEED = 1.5;  // 50% faster cruise
window.GESTURE_SCROLL_SPEED = 0.7;  // slower, easier reading
```

Defaults in the script's `physics` object:

| Constant | Default | Meaning |
|---|---|---|
| cruise speed | `innerHeight × 1.1` px/sec | steady scroll speed while pointing |
| `RAMP_UP` | 9 /sec | how quickly scrolling ramps in |
| `RAMP_DOWN` | 12 /sec | how quickly it eases to a stop |
| `CONFIRM` | 2 frames | camera frames to confirm a direction change |

Optional hook for custom behaviour:

```js
window.onGesture = (name) => {          // "SCROLL" | "CLICK"
  if (name === "CLICK") { /* ... */ }
  return false;                          // return false to block the built-in action
};
```

### Requirements & notes

- Modern browser (Chrome / Edge recommended), webcam, and camera permission.
- Internet needed at runtime for the MediaPipe Tasks-Vision library (loaded from
  jsDelivr). The hand-landmark model is **self-hosted** at
  `public/models/hand_landmarker.task`; if that asset is ever missing the script
  falls back to Google's CDN copy automatically.
- Runs on GPU via WebAssembly — no backend, nothing sent to any server; all
  video processing stays in the browser.

### Troubleshooting

| Symptom | Fix |
|---|---|
| Button says "Failed: …" | Camera permission denied, or no internet for the CDN model |
| Hand not detected | More light on your hand; keep it fully inside the preview frame |
| Pointing up "does nothing" | You may already be at the top of the page — point 👇 down first |
| Scrolls the wrong panel | The auto-detector picks the largest scrollable element; make sure the panel you want is the one that scrolls with the mouse wheel too |
| Direction flips randomly | Keep middle/ring/pinky clearly curled — an open palm is deliberately ignored |

---

> A standalone desktop (Python + OpenCV + PyAutoGUI) version once existed to
> drive the OS mouse/keyboard for any browser. It has been superseded by this
> in-browser web version and is no longer part of the project.
