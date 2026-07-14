/*
 * GestureFlow AI  —  touchless control for Vidhan.ai (whole-app, drop-in).
 *
 * Loaded once from index.html:  <script defer src="/gesture-control.js"></script>
 * A floating 🖐 button (bottom-right) turns it ON, and a MODE button switches:
 *
 *   SCROLL mode  (default, "no-touch")  ->  point your index finger UP to
 *                scroll up, point DOWN to scroll down. Open palm / fist / no
 *                hand = stop. Direction is explicit, so there is nothing to
 *                misread — and the speed ramps in/out smoothly.
 *                Point LEFT (held ~0.1s) = go BACK to the previous page;
 *                point RIGHT = forward. One-shot with cooldown, so a held
 *                gesture can never fire twice.
 *
 * RELIABILITY: the loop is exception-proof, the camera auto-reconnects if the
 * webcam track dies, and the ON state survives page reloads (session-scoped).
 *
 *   CURSOR mode  ("touch")  ->  point your index finger to move the cursor
 *                (One-Euro-filtered + display-rate interpolation = steady and
 *                lag-free). Pinch thumb+index = press, open = click. The click
 *                lands where you aimed BEFORE the pinch motion, and snaps to
 *                the nearest button ("magnetism"); a green outline previews
 *                exactly what will be clicked.
 *
 * ARCHITECTURE (why it is smooth):
 *   • The camera/AI loop only MEASURES hand velocity (~30fps, whatever the
 *     webcam gives us).
 *   • A separate physics loop runs on requestAnimationFrame at the DISPLAY
 *     refresh rate (60–120fps) with time-based integration, and is the only
 *     thing that actually scrolls. So scrolling is always buttery even when
 *     the camera is slow — exactly how touch scrolling works on phones.
 *
 * Optional: window.onGesture = (name) => {...}  ("CLICK", "SCROLL"). Return
 * false to skip the built-in action.
 * Optional: window.GESTURE_SCROLL_SPEED = 1.5  (scroll distance multiplier).
 */
(function () {
  "use strict";

  var LIB = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
  var WASM = LIB + "/wasm";
  // Self-hosted model shipped with the frontend (frontend/public/models/…) so
  // gesture control works without reaching Google's CDN. Falls back to the CDN
  // copy if the local asset is missing/unreachable (see createLandmarker).
  var MODEL_LOCAL = "/models/hand_landmarker.task";
  var MODEL_CDN =
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/" +
    "hand_landmarker/float16/1/hand_landmarker.task";

  // ---------- helpers ----------
  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function pinchRatio(lm) {
    var hand = dist(lm[0], lm[9]);
    return hand === 0 ? 1 : dist(lm[4], lm[8]) / hand;
  }

  function fire(name) {
    if (typeof window.onGesture === "function") {
      return window.onGesture(name);
    }
    return undefined;
  }

  // ---------- scroll target ----------
  // Find the element that actually scrolls. Many SPAs scroll an inner
  // container instead of the window, so window.scrollBy() would do nothing.
  // Cached briefly because scanning the DOM every frame is wasteful.
  // An open dropdown / menu / popover with its own scrollbar always wins:
  // when one is on screen, the user is choosing from it — scrolling the page
  // behind it would be useless. Checked on a short cache so a dropdown that
  // has just opened is picked up quickly.
  var _popupEl = null;
  var _popupAt = 0;
  function findScrollablePopup() {
    var now = performance.now();
    if (now - _popupAt < 350) return _popupEl;
    _popupAt = now;
    _popupEl = null;
    var els = document.querySelectorAll(
      "[role='listbox'],[role='menu'],[class*='dropdown'],[class*='popover'],[class*='autocomplete']"
    );
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (e.scrollHeight - e.clientHeight > 20 && e.clientHeight > 60) {
        var oy = getComputedStyle(e).overflowY;
        if (oy === "auto" || oy === "scroll") _popupEl = e;   // last = newest
      }
    }
    return _popupEl;
  }

  var _scrollEl = null;
  var _scrollElAt = 0;
  function getScroller() {
    var popup = findScrollablePopup();
    if (popup) return popup;
    var now = performance.now();
    if (_scrollEl && _scrollEl.isConnected && now - _scrollElAt < 1500) return _scrollEl;
    var de = document.scrollingElement || document.documentElement;
    var best = de;
    var bestScore = de.scrollHeight - de.clientHeight; // how much the page itself scrolls
    // Only bother scanning for an inner scroller if the page barely scrolls.
    if (bestScore < 40) {
      var els = document.querySelectorAll("div,main,section,article,ul,ol");
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var room = el.scrollHeight - el.clientHeight;
        if (room > 40 && el.clientHeight > 180) {
          var oy = getComputedStyle(el).overflowY;
          if (oy === "auto" || oy === "scroll") {
            var score = Math.min(room, 100000) + el.clientHeight;
            if (score > bestScore) { bestScore = score; best = el; }
          }
        }
      }
    }
    _scrollEl = best;
    _scrollElAt = now;
    return best;
  }

  // CRITICAL: this site sets `html { scroll-behavior: smooth }`. Per the CSSOM
  // spec that makes even direct scrollTop writes animate smoothly — so 60
  // writes/sec each start a smooth animation that the next one cancels, and
  // the page barely moves. While gesture-scrolling we force the scroller to
  // instant behavior (inline style) and restore the original value on stop.
  var _patched = null;   // { el, prev }
  function restoreScrollBehavior() {
    if (_patched) {
      _patched.el.style.scrollBehavior = _patched.prev;
      _patched = null;
    }
  }
  function instantScrollBy(px) {
    var el = getScroller();
    if (_patched && _patched.el !== el) restoreScrollBehavior();
    if (!_patched) {
      _patched = { el: el, prev: el.style.scrollBehavior || "" };
      el.style.scrollBehavior = "auto";
    }
    el.scrollTop += px;
  }

  // ---------- point-to-scroll physics ----------
  //
  // Camera loop  -> setDir(-1|0|+1):  which way the finger points right now
  // Physics loop -> step(dt):         every display frame, ramp the velocity
  //                                   toward the target and move scrollTop.
  //
  // Pointing UP   = steady scroll up.  Pointing DOWN = steady scroll down.
  // Anything else = smooth stop. Because physics runs at display refresh with
  // time-based easing, starting/stopping feels buttery, never steppy.
  var physics = {
    scrollVel: 0,        // px/sec  (+ = scroll down)
    dir: 0,              // -1 up | 0 stop | +1 down (confirmed direction)
    pending: 0,          // candidate direction awaiting confirmation
    streak: 0,           // consecutive camera frames voting for `pending`
    lastHandT: 0,        // ms timestamp of last hand measurement
    accum: 0,            // sub-pixel accumulator so slow scrolls aren't lost

    // Tuning
    RAMP_UP: 16,         // 1/sec — how fast speed ramps in when pointing (higher = snappier start)
    RAMP_DOWN: 12,       // 1/sec — how fast it eases out when released
    STOP: 10,            // px/sec — below this it's considered stopped
    CONFIRM: 1,          // frames to confirm STARTING / switching — react immediately
    RELEASE: 5,          // frames to confirm STOPPING — a couple of missed
                         // detections must never stutter an active scroll

    speed: function () {
      var mult = window.GESTURE_SCROLL_SPEED || 1;
      // Steady cruise ≈ 1.1 viewport-heights per second.
      return window.innerHeight * 1.1 * mult;
    },

    reset: function () {
      this.scrollVel = 0;
      this.dir = 0;
      this.pending = 0;
      this.streak = 0;
      this.accum = 0;
      restoreScrollBehavior();
    },

    // Called from the camera loop with the pointing direction of this frame.
    // Starting/switching needs CONFIRM consecutive frames (filters one-frame
    // AI misreads); stopping needs RELEASE frames, so a few dropped
    // detections mid-scroll never stutter the movement.
    setDir: function (d) {
      this.lastHandT = performance.now();
      if (d === this.dir) {           // agreeing with current state
        this.pending = d;
        this.streak = 0;
        return;
      }
      if (d === this.pending) this.streak++;
      else { this.pending = d; this.streak = 1; }
      var need = d === 0 ? this.RELEASE : this.CONFIRM;
      if (this.streak >= need) {
        this.dir = d;
        this.streak = 0;
      }
    },

    // Called from the camera loop when NO hand is visible. Treated like a
    // "stop" vote — several in a row are needed before the scroll releases.
    lost: function () {
      this.setDir(0);
    },

    // Called EVERY display frame with dt in seconds. Returns px/sec velocity.
    step: function (dt) {
      if (dt > 0.05) dt = 0.05;   // clamp huge gaps (tab switch etc.)

      // Safety: if the camera stalls >300ms, stop scrolling.
      if (this.dir !== 0 && performance.now() - this.lastHandT > 300) {
        this.dir = 0;
      }

      var target = this.dir * this.speed();
      var rate = target !== 0 ? this.RAMP_UP : this.RAMP_DOWN;
      var k = 1 - Math.exp(-rate * dt);
      this.scrollVel += (target - this.scrollVel) * k;
      if (target === 0 && Math.abs(this.scrollVel) < this.STOP) this.scrollVel = 0;

      if (this.scrollVel !== 0) {
        if (fire("SCROLL") !== false) {
          // Sub-pixel accumulation → slow speeds still render smoothly.
          this.accum += this.scrollVel * dt;
          var px = this.accum | 0;   // truncate toward zero
          if (px !== 0) {
            this.accum -= px;
            instantScrollBy(px);
          }
        } else {
          this.accum = 0;
        }
      } else {
        // Fully stopped → give the page its smooth anchor-scrolling back.
        restoreScrollBehavior();
      }
      return this.scrollVel;
    },
  };

  // ---------- pointing-direction detector ----------
  // Returns -1 (index finger pointing UP), +1 (pointing DOWN), or 0 (neither).
  //
  // Two threshold sets (hysteresis):
  //   strict  — used to START a scroll: index clearly extended, other fingers
  //             curled, direction clearly vertical.
  //   relaxed — used while ALREADY scrolling: much more forgiving, so natural
  //             wrist flex / partial curl (very common when pointing DOWN)
  //             doesn't drop the gesture mid-scroll. This is what makes the
  //             movement feel locked-on and smooth.
  function pointingDir(lm, activeDir) {
    var relaxed = activeDir !== 0;
    var wrist = lm[0];

    // Index extended? (tip farther from the wrist than the middle joint).
    // Slightly forgiving so a natural, not-fully-straight point still registers.
    var extMul = relaxed ? 1.0 : 1.03;
    if (dist(lm[8], wrist) <= dist(lm[6], wrist) * extMul) return 0;

    // Middle/ring/pinky curled? (tip not much farther from wrist than its
    // middle joint). Pointing DOWN naturally loosens the curl, so the bar is
    // lower once a scroll is active.
    var curlMul = relaxed ? 1.3 : 1.2;
    var curled = 0;
    if (dist(lm[12], wrist) < dist(lm[10], wrist) * curlMul) curled++;
    if (dist(lm[16], wrist) < dist(lm[14], wrist) * curlMul) curled++;
    if (dist(lm[20], wrist) < dist(lm[18], wrist) * curlMul) curled++;
    if (curled < (relaxed ? 1 : 2)) return 0;   // open palm → no scroll

    // Finger direction: average of knuckle→tip and mid-joint→tip vectors —
    // robust against wrist flexion when pointing downward.
    var dx = (lm[8].x - lm[5].x) + (lm[8].x - lm[6].x);
    var dy = (lm[8].y - lm[5].y) + (lm[8].y - lm[6].y);
    var domMul = relaxed ? 0.8 : 0.9;
    if (Math.abs(dy) < Math.abs(dx) * domMul) return 0;   // pointing sideways
    if (Math.abs(dy) < (relaxed ? 0.05 : 0.06)) return 0; // too small to trust
    var d = dy < 0 ? -1 : +1;   // image y grows downward: up = negative dy
    // While active, never flip straight to the opposite direction from the
    // relaxed check — the strict pass on the next frames will confirm it.
    if (relaxed && d !== activeDir) {
      return pointingDir(lm, 0) === d ? d : 0;
    }
    return d;
  }

  // ---------- page-turn detector (point LEFT = back, RIGHT = forward) ----------
  // Same hand shape as scrolling, but the index finger held clearly HORIZONTAL.
  // Returns -1 (screen-left = previous page), +1 (screen-right = forward), 0.
  function pointingHorizDir(lm) {
    var wrist = lm[0];
    if (dist(lm[8], wrist) <= dist(lm[6], wrist) * 1.05) return 0;   // index not extended
    var curled = 0;
    if (dist(lm[12], wrist) < dist(lm[10], wrist) * 1.2) curled++;
    if (dist(lm[16], wrist) < dist(lm[14], wrist) * 1.2) curled++;
    if (dist(lm[20], wrist) < dist(lm[18], wrist) * 1.2) curled++;
    if (curled < 2) return 0;                                        // open palm → ignore
    var dx = (lm[8].x - lm[5].x) + (lm[8].x - lm[6].x);
    var dy = (lm[8].y - lm[5].y) + (lm[8].y - lm[6].y);
    if (Math.abs(dx) < Math.abs(dy) * 1.25) return 0;                // not clearly horizontal
    if (Math.abs(dx) < 0.09) return 0;                               // too small to trust
    // The preview is mirrored: raw image +x = the user's screen-LEFT.
    return dx > 0 ? -1 : +1;
  }

  // One-shot navigation: needs 3 agreeing camera frames (~0.1s) to fire, then
  // a cooldown AND a return to neutral before it can fire again — a held
  // point-left can never rapid-fire history.back().
  var nav = { dir: 0, streak: 0, cooldownUntil: 0, needNeutral: false };
  function navCheck(h) {
    var now = performance.now();
    if (h === 0) {
      nav.dir = 0;
      nav.streak = 0;
      nav.needNeutral = false;
      return;
    }
    if (nav.needNeutral || now < nav.cooldownUntil) return;
    if (h === nav.dir) nav.streak++;
    else { nav.dir = h; nav.streak = 1; }
    if (nav.streak >= 3) {
      nav.streak = 0;
      nav.needNeutral = true;
      nav.cooldownUntil = now + 1600;
      if (h === -1) {
        if (fire("PAGE_BACK") !== false) history.back();
        showToast("⬅ Previous page");
      } else {
        if (fire("PAGE_FORWARD") !== false) history.forward();
        showToast("➡ Forward");
      }
    }
  }

  // ---------- One Euro filter (industry standard for hand cursors) ----------
  // Adaptive smoothing used by Quest / Leap Motion style pointers: heavy
  // smoothing when the hand is nearly still (rock-steady cursor, no jitter),
  // almost none when it moves fast (zero perceptible lag).
  function OneEuro(minCutoff, beta) {
    this.minCutoff = minCutoff;   // Hz — lower = steadier when still
    this.beta = beta;             // speed coefficient — higher = snappier
    this.dCutoff = 1.0;
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = 0;
  }
  OneEuro.prototype.reset = function () {
    this.xPrev = null;
    this.dxPrev = 0;
  };
  OneEuro.prototype.alpha = function (cutoff, dt) {
    var tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  };
  OneEuro.prototype.filter = function (x, tMs) {
    if (this.xPrev == null) {
      this.xPrev = x;
      this.tPrev = tMs;
      return x;
    }
    var dt = (tMs - this.tPrev) / 1000;
    if (dt <= 0) return this.xPrev;
    this.tPrev = tMs;
    var dx = (x - this.xPrev) / dt;
    var ad = this.alpha(this.dCutoff, dt);
    this.dxPrev += ad * (dx - this.dxPrev);
    var cutoff = this.minCutoff + this.beta * Math.abs(this.dxPrev);
    var a = this.alpha(cutoff, dt);
    this.xPrev += a * (x - this.xPrev);
    return this.xPrev;
  };

  // ---------- pointer engine (CURSOR mode) ----------
  // Camera loop  -> measure(): filters the fingertip and runs the pinch
  //                state machine (pinch = press, release = click).
  // Display loop -> step(dt):  interpolates the rendered cursor toward the
  //                filtered target every display frame — silky at 60–120fps
  //                even though the camera only delivers ~30fps.
  var CLICKABLE_SEL =
    "a,button,[role='button'],[role='tab'],[role='menuitem'],[role='option']," +
    "input,select,textarea,label,summary,[onclick],[tabindex]";

  // Find the best clickable element near (x,y). Sampling a ring of offsets
  // gives "button magnetism": a click a few px off the edge of a button still
  // lands on it. Hover checks use the small ring (cheap, runs often); actual
  // clicks use the full ring (accuracy matters, runs once).
  var OFFS_HOVER = [[0, 0], [12, 0], [-12, 0], [0, 12], [0, -12]];
  var OFFS_CLICK = [
    [0, 0], [10, 0], [-10, 0], [0, 10], [0, -10],
    [18, 0], [-18, 0], [0, 18], [0, -18], [14, 14], [-14, 14], [14, -14], [-14, -14],
  ];
  function clickableNear(x, y, full) {
    var offs = full ? OFFS_CLICK : OFFS_HOVER;
    for (var i = 0; i < offs.length; i++) {
      var e = document.elementFromPoint(x + offs[i][0], y + offs[i][1]);
      if (!e) continue;
      var c = e.closest && e.closest(CLICKABLE_SEL);
      if (c) return c;
      if (i === 0 && e !== document.body && e !== document.documentElement) {
        try {
          if (getComputedStyle(e).cursor === "pointer") return e;
        } catch (_) {}
      }
    }
    return null;
  }

  var pointer = {
    fx: new OneEuro(2.2, 0.015),
    fy: new OneEuro(2.2, 0.015),
    tx: 0, ty: 0,        // filtered target (px, viewport)
    vx: 0, vy: 0,        // target velocity (px/sec) for latency prediction
    lastMeasT: 0,        // ms timestamp of previous measurement
    x: 0, y: 0,          // rendered cursor position (px)
    seen: false,         // hand currently visible
    started: false,      // rendered pos initialised
    hist: [],            // [tMs, x, y] recent targets (for pre-pinch rewind)
    pinched: false,
    pressX: 0, pressY: 0,
    pressEl: null,
    pressT: 0,
    hoverEl: null,
    hoverAt: 0,
    hoverX: -1, hoverY: -1,   // cursor position at the last hover scan
    quietUntil: 0,            // post-click quiet period (ms timestamp)

    // Pinch hysteresis: must close firmly to press, open clearly to release —
    // the gap prevents flutter right at the threshold.
    PINCH_ON: 0.38,
    PINCH_OFF: 0.52,
    FOLLOW: 42,          // 1/sec — rendered-cursor chase rate (higher = tighter)
    LEAD: 0.055,         // sec of velocity prediction — cancels camera latency
    REWIND_MS: 110,      // click uses the position this long BEFORE the pinch
    MAX_PRESS_MS: 2500,  // pinches held longer than this don't click (cancel)

    reset: function () {
      this.fx.reset();
      this.fy.reset();
      this.vx = 0;
      this.vy = 0;
      this.lastMeasT = 0;
      this.seen = false;
      this.started = false;
      this.hist.length = 0;
      this.pinched = false;
      this.pressEl = null;
      this.setHover(null);
      if (cursor) cursor.style.display = "none";
    },

    setHover: function (elm) {
      if (elm === this.hoverEl) return;
      this.hoverEl = elm;
      if (!hoverBox) return;
      if (!elm) {
        hoverBox.style.display = "none";
        return;
      }
      var r = elm.getBoundingClientRect();
      hoverBox.style.display = "block";
      hoverBox.style.transform = "translate3d(" + (r.left - 4) + "px," + (r.top - 4) + "px,0)";
      hoverBox.style.width = r.width + 8 + "px";
      hoverBox.style.height = r.height + 8 + "px";
    },

    // Position REWIND_MS ago — where the finger was before the pinch motion
    // started dragging it, so the click lands where the user was aiming.
    rewind: function () {
      var cut = performance.now() - this.REWIND_MS;
      for (var i = 0; i < this.hist.length; i++) {
        if (this.hist[i][0] >= cut) return [this.hist[i][1], this.hist[i][2]];
      }
      return [this.tx, this.ty];
    },

    dispatch: function (elm, types, x, y) {
      types.forEach(function (type) {
        var Ctor = type.indexOf("pointer") === 0 ? PointerEvent : MouseEvent;
        try {
          elm.dispatchEvent(new Ctor(type, {
            bubbles: true, cancelable: true, view: window,
            clientX: x, clientY: y, button: 0, pointerId: 7, pointerType: "mouse", isPrimary: true,
          }));
        } catch (_) {}
      });
    },

    // Called on every camera frame with the fingertip + pinch ratio.
    measure: function (nx, ny, ratio) {
      var t = performance.now();
      var p = mapToViewport(nx, ny);
      var ptx = this.tx;
      var pty = this.ty;
      this.tx = this.fx.filter(p[0], t);
      this.ty = this.fy.filter(p[1], t);
      // Target velocity (EMA) — used to predict ahead of camera latency.
      if (this.lastMeasT) {
        var mdt = (t - this.lastMeasT) / 1000;
        if (mdt > 0 && mdt < 0.2) {
          this.vx = this.vx * 0.5 + ((this.tx - ptx) / mdt) * 0.5;
          this.vy = this.vy * 0.5 + ((this.ty - pty) / mdt) * 0.5;
        }
      }
      this.lastMeasT = t;
      this.seen = true;
      this.hist.push([t, this.tx, this.ty]);
      while (this.hist.length && t - this.hist[0][0] > 400) this.hist.shift();

      if (!this.pinched && ratio < this.PINCH_ON) {
        // ── press ──
        this.pinched = true;
        this.pressT = t;
        // WYSIWYG targeting: the element with the green highlight is the
        // promise we made to the user — if the cursor is on (or near) it,
        // THAT is what gets clicked. Rewind is only a last-resort fallback
        // for pinch-while-still-moving clicks; on option lists it used to
        // land one item above the highlighted one.
        this.pressX = this.x;
        this.pressY = this.y;
        var elm = null;
        if (this.hoverEl && this.hoverEl.isConnected) {
          var hr = this.hoverEl.getBoundingClientRect();
          if (this.pressX >= hr.left - 24 && this.pressX <= hr.right + 24 &&
              this.pressY >= hr.top - 24 && this.pressY <= hr.bottom + 24) {
            elm = this.hoverEl;
          }
        }
        if (!elm) elm = clickableNear(this.pressX, this.pressY, true);
        if (!elm) {
          var pos = this.rewind();
          elm = clickableNear(pos[0], pos[1], true);
          if (elm) { this.pressX = pos[0]; this.pressY = pos[1]; }
        }
        this.pressEl = elm;
        // Dispatch at the element's centre so coordinates are always inside it.
        if (elm) {
          var er = elm.getBoundingClientRect();
          this.pressX = er.left + er.width / 2;
          this.pressY = er.top + er.height / 2;
        }
        var target = elm || document.elementFromPoint(this.pressX, this.pressY);
        if (target) this.dispatch(target, ["pointerdown", "mousedown"], this.pressX, this.pressY);
        cursor.style.background = "rgba(55,211,155,.9)";
      } else if (this.pinched && ratio > this.PINCH_OFF) {
        // ── release = click ──
        this.pinched = false;
        cursor.style.background = "transparent";
        var held = t - this.pressT;
        var elm = this.pressEl || document.elementFromPoint(this.pressX, this.pressY);
        if (elm) {
          this.dispatch(elm, ["pointerup", "mouseup"], this.pressX, this.pressY);
          if (held <= this.MAX_PRESS_MS && fire("CLICK") !== false) {
            this.dispatch(elm, ["click"], this.pressX, this.pressY);
            if (typeof elm.focus === "function") elm.focus({ preventScroll: true });
            // Quiet period: for 1.5s after a click, skip hover scans and
            // halve AI detection so a page navigation gets the CPU/GPU it
            // needs to open fast.
            this.quietUntil = performance.now() + 1500;
            this.setHover(null);
          }
        }
        this.pressEl = null;
      }
    },

    lost: function () {
      this.seen = false;
      this.vx = 0;
      this.vy = 0;
      this.lastMeasT = 0;
      // A vanished hand cancels a press without clicking.
      if (this.pinched) {
        this.pinched = false;
        this.pressEl = null;
        cursor.style.background = "transparent";
      }
    },

    // Called every display frame.
    step: function (dt) {
      if (!this.seen && !this.started) return;
      if (!this.started) {
        this.x = this.tx;
        this.y = this.ty;
        this.started = true;
      }
      // While pressing, the cursor stays pinned on the press point so the
      // pinch motion can't drag it off the button. While moving, aim slightly
      // AHEAD along the current velocity — cancels camera latency, so the
      // cursor feels glued to the finger instead of trailing it.
      var gx = this.pinched ? this.pressX : this.tx + this.vx * this.LEAD;
      var gy = this.pinched ? this.pressY : this.ty + this.vy * this.LEAD;
      var k = 1 - Math.exp(-this.FOLLOW * dt);
      this.x += (gx - this.x) * k;
      this.y += (gy - this.y) * k;
      cursor.style.display = this.seen || this.pinched ? "block" : "none";
      // transform, not left/top — GPU-composited, zero layout cost per frame
      cursor.style.transform = "translate3d(" + this.x + "px," + this.y + "px,0)";

      var now = performance.now();
      // Post-click quiet: fully silent for the first 350ms (page gets the
      // CPU), then hover tracking resumes at a reduced rate — dropdown flows
      // are two quick clicks in a row, so targeting must not go stale.
      var quiet = now < this.quietUntil;
      if (quiet && this.quietUntil - now > 1150) return;

      // Hover highlight: outline the clickable under the cursor and feed it
      // mousemove so React hover states react like a real mouse. Only scans
      // when the cursor actually moved (or every 250ms) — elementFromPoint
      // forces layout, so idle frames must not pay for it.
      var minGap = quiet ? 150 : 80;
      var moved = Math.abs(this.x - this.hoverX) + Math.abs(this.y - this.hoverY) > 5;
      if ((moved && now - this.hoverAt > minGap) || now - this.hoverAt > 250) {
        this.hoverAt = now;
        this.hoverX = this.x;
        this.hoverY = this.y;
        if (this.seen && !this.pinched) {
          var c = clickableNear(this.x, this.y, false);
          this.setHover(c);
          if (moved && !quiet) {
            var under = c || document.elementFromPoint(this.x, this.y);
            if (under) this.dispatch(under, ["pointermove", "mousemove"], this.x, this.y);
          }
        } else if (!this.seen) {
          this.setHover(null);
        }
      }
    },
  };

  // ---------- UI ----------
  var cursor, badge, toggleBtn, modeBtn, preview, pctx, scrollHint, hoverBox, navToast;
  var previewMinBtn, previewRestoreBtn;
  var navToastTimer = 0;

  // Whether the live hand panel is minimized. Remembered across sessions so the
  // user only sees it when they choose to.
  var previewMin = false;
  try { previewMin = localStorage.getItem("gfai_preview_min") === "1"; } catch (_) {}

  // Show the panel, the minimize button, or the tiny restore pill depending on
  // the current state. Does nothing visible while gesture control is OFF.
  function applyPreviewMinState() {
    if (!preview) return;
    if (!running) {
      preview.style.display = "none";
      previewMinBtn.style.display = "none";
      previewRestoreBtn.style.display = "none";
      return;
    }
    if (previewMin) {
      preview.style.display = "none";
      previewMinBtn.style.display = "none";
      previewRestoreBtn.style.display = "block";
    } else {
      preview.style.display = "block";
      previewMinBtn.style.display = "flex";
      previewRestoreBtn.style.display = "none";
    }
  }

  function showToast(text) {
    if (!navToast) return;
    navToast.textContent = text;
    navToast.style.opacity = "1";
    clearTimeout(navToastTimer);
    navToastTimer = setTimeout(function () {
      navToast.style.opacity = "0";
    }, 900);
  }

  function el(css, tag) {
    var e = document.createElement(tag || "div");
    e.style.cssText = css;
    document.body.appendChild(e);
    return e;
  }

  function buildUI() {
    // Positioned via transform (GPU-composited) — per-frame moves never
    // trigger layout, so the cursor costs the page essentially nothing.
    cursor = el(
      "position:fixed;left:0;top:0;width:28px;height:28px;border:3px solid #ff3b3b;" +
        "border-radius:50%;margin:-14px 0 0 -14px;pointer-events:none;z-index:2147483647;" +
        "display:none;box-shadow:0 0 0 2px rgba(255,255,255,.6);transition:background .1s;" +
        "will-change:transform;"
    );

    // Green outline around the clickable element under the cursor — instant
    // visual confirmation of exactly what a pinch will click.
    hoverBox = el(
      "position:fixed;left:0;top:0;border:2px solid #37d39b;border-radius:10px;" +
        "pointer-events:none;z-index:2147483646;display:none;" +
        "box-shadow:0 0 12px rgba(55,211,155,.35);will-change:transform;" +
        "transition:transform .1s,width .1s,height .1s;"
    );

    // small pill confirming a page-turn gesture (back/forward)
    navToast = el(
      "position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:2147483647;" +
        "pointer-events:none;font:600 14px system-ui,sans-serif;color:#fff;" +
        "background:rgba(20,24,40,.92);border:1px solid #3a4c82;padding:8px 16px;" +
        "border-radius:999px;opacity:0;transition:opacity .25s;"
    );

    // subtle edge indicator that only shows scroll direction as an arrow —
    // no words, no big flashing text.
    scrollHint = el(
      "position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483647;" +
        "pointer-events:none;font:700 22px system-ui,sans-serif;color:#7dd3fc;" +
        "text-shadow:0 2px 8px rgba(0,0,0,.5);opacity:0;transition:opacity .15s;display:block;"
    );

    badge = el(
      "position:fixed;left:16px;bottom:16px;z-index:2147483647;pointer-events:none;" +
        "font:600 13px/1.4 system-ui,sans-serif;color:#fff;background:rgba(20,24,40,.85);" +
        "padding:8px 12px;border-radius:10px;max-width:340px;display:none;"
    );

    preview = el(
      "position:fixed;right:16px;bottom:118px;width:220px;height:165px;z-index:2147483647;" +
        "border-radius:12px;border:2px solid #3a4c82;display:none;background:#000;",
      "canvas"
    );
    preview.width = 220;
    preview.height = 165;
    pctx = preview.getContext("2d");

    // Minimize button — tucked in the top-right corner of the live hand panel.
    // Lets the user hide the panel when they don't need to watch their hand.
    previewMinBtn = el(
      "position:fixed;right:20px;bottom:253px;width:26px;height:26px;z-index:2147483647;" +
        "cursor:pointer;font:700 18px/1 system-ui,sans-serif;color:#cbd5e1;" +
        "background:rgba(20,24,40,.92);border:1px solid #3a4c82;border-radius:8px;" +
        "display:none;align-items:center;justify-content:center;padding:0;",
      "button"
    );
    previewMinBtn.textContent = "–";
    previewMinBtn.title = "Hide the live hand panel";

    // Small restore pill shown in place of the panel while it is minimized.
    previewRestoreBtn = el(
      "position:fixed;right:16px;bottom:118px;z-index:2147483647;cursor:pointer;" +
        "font:600 13px system-ui,sans-serif;color:#fff;background:rgba(20,24,40,.92);" +
        "border:1px solid #3a4c82;border-radius:10px;padding:8px 12px;display:none;",
      "button"
    );
    previewRestoreBtn.textContent = "🖐 Show hand";
    previewRestoreBtn.title = "Show the live hand panel";

    modeBtn = el(
      "position:fixed;right:16px;bottom:64px;z-index:2147483647;cursor:pointer;" +
        "font:600 14px system-ui,sans-serif;color:#fff;background:#4a2a66;border:1px solid #6a3a82;" +
        "padding:10px 14px;border-radius:12px;display:none;",
      "button"
    );
    modeBtn.textContent = "Mode: SCROLL";

    // Hidden — gesture control is switched from the user's Profile page via
    // the window.GestureFlow API. Kept as an element so internal state
    // updates (label/color) stay harmless.
    toggleBtn = el(
      "position:fixed;right:16px;bottom:16px;z-index:2147483647;cursor:pointer;" +
        "font:600 14px system-ui,sans-serif;color:#fff;background:#2a3a66;border:1px solid #3a4c82;" +
        "padding:10px 14px;border-radius:12px;display:none;",
      "button"
    );
    toggleBtn.textContent = "🖐 Gesture: OFF";

    buildGuide();
  }

  // ---------- how-to-use guide (shown when gesture control turns ON) ----------
  var guideEl = null;

  function buildGuide() {
    guideEl = el(
      "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;" +
        "width:min(92vw,400px);background:rgba(10,14,28,.97);border:1px solid #3a4c82;" +
        "border-radius:18px;padding:22px 24px;color:#e2e8f0;display:none;" +
        "font:400 14px/1.65 system-ui,sans-serif;box-shadow:0 24px 80px rgba(0,0,0,.7);"
    );
    guideEl.innerHTML =
      "<div style='font:700 17px system-ui;margin-bottom:12px;color:#fff'>🖐 GestureFlow AI — How to use</div>" +
      "<div style='margin-bottom:10px'><b style='color:#7dd3fc'>SCROLL mode</b> (default)</div>" +
      "<div>☝️ Point index finger <b>UP</b> → scroll up</div>" +
      "<div>👇 Point <b>DOWN</b> → scroll down</div>" +
      "<div>⬅️ Point <b>LEFT</b> → previous page &nbsp;·&nbsp; ➡️ <b>RIGHT</b> → forward</div>" +
      "<div>🖐 Open palm → stop</div>" +
      "<div style='margin:12px 0 10px'><b style='color:#c4b5fd'>CURSOR mode</b> (press the Mode button)</div>" +
      "<div>☝️ Move your index finger → cursor follows</div>" +
      "<div>🤏 Pinch thumb+index = press · open = <b>click</b> (green ring shows the target)</div>" +
      "<div style='margin-top:12px;color:#94a3b8;font-size:13px'>The small dark panel (bottom-right) shows your live hand skeleton — " +
      "if it moves with your hand, tracking is working. 🟣 tracked · 🔵 scrolling · 🟢 pressing.</div>" +
      "<div style='display:flex;gap:10px;margin-top:16px'>" +
      "<button id='gfai-guide-ok' style='flex:1;font:600 14px system-ui;color:#fff;background:#4f46e5;border:0;padding:10px;border-radius:10px;cursor:pointer'>Got it</button>" +
      "<button id='gfai-guide-never' style='font:600 13px system-ui;color:#94a3b8;background:none;border:1px solid #3a4c82;padding:10px 14px;border-radius:10px;cursor:pointer'>Don't show again</button>" +
      "</div>";
    guideEl.querySelector("#gfai-guide-ok").addEventListener("click", function () {
      guideEl.style.display = "none";
    });
    guideEl.querySelector("#gfai-guide-never").addEventListener("click", function () {
      guideEl.style.display = "none";
      try { localStorage.setItem("gfai_guide_hide", "1"); } catch (_) {}
    });
  }

  function showGuide() {
    try {
      if (localStorage.getItem("gfai_guide_hide") === "1") return;
    } catch (_) {}
    if (guideEl) guideEl.style.display = "block";
  }

  function setStatus(t) {
    if (badge && badge.textContent !== t) badge.textContent = t;
  }

  // Small arrow at the top edge showing scroll direction — no text words.
  function showScrollHint(velPxSec) {
    if (!scrollHint) return;
    var a = Math.abs(velPxSec);
    if (a < 40) {
      scrollHint.style.opacity = "0";
      return;
    }
    scrollHint.textContent = velPxSec < 0 ? "▲" : "▼";
    scrollHint.style.opacity = String(clamp(a / 2000, 0.25, 1));
  }

  // Privacy-friendly tracking monitor: draws the hand SKELETON the AI sees —
  // 21 landmarks + bones on a dark panel. No camera pixels are ever shown.
  // Color tells you the recognised state at a glance:
  //   indigo = hand tracked · cyan = scrolling · green = pinch/press
  var BONES = [
    [0, 1], [1, 2], [2, 3], [3, 4],          // thumb
    [0, 5], [5, 6], [6, 7], [7, 8],          // index
    [5, 9], [9, 10], [10, 11], [11, 12],     // middle
    [9, 13], [13, 14], [14, 15], [15, 16],   // ring
    [13, 17], [17, 18], [18, 19], [19, 20],  // pinky
    [0, 17],                                  // palm edge
  ];

  function drawPreview(lm) {
    if (!pctx || previewMin) return;   // panel hidden → skip the canvas work
    var w = preview.width;
    var h = preview.height;
    pctx.fillStyle = "rgba(8,12,24,0.96)";
    pctx.fillRect(0, 0, w, h);

    if (!lm) {
      pctx.fillStyle = "#475569";
      pctx.font = "600 13px system-ui,sans-serif";
      pctx.textAlign = "center";
      pctx.fillText("🖐 show your hand", w / 2, h / 2 + 4);
      return;
    }

    // State color: what is the AI recognising right now?
    var color = "#818cf8";                                   // tracked (idle)
    if (mode === "SCROLL" && physics.dir !== 0) color = "#22d3ee";   // scrolling
    if (mode === "CURSOR" && pointer.pinched) color = "#37d39b";     // pressing

    // Mirrored so it moves like a mirror (matches user intuition).
    function px(i) { return (1 - lm[i].x) * w; }
    function py(i) { return lm[i].y * h; }

    pctx.strokeStyle = color;
    pctx.lineWidth = 2;
    pctx.lineCap = "round";
    pctx.beginPath();
    for (var b = 0; b < BONES.length; b++) {
      pctx.moveTo(px(BONES[b][0]), py(BONES[b][0]));
      pctx.lineTo(px(BONES[b][1]), py(BONES[b][1]));
    }
    pctx.stroke();

    // Joints
    pctx.fillStyle = color;
    for (var i = 0; i < 21; i++) {
      pctx.beginPath();
      pctx.arc(px(i), py(i), i % 4 === 0 ? 3 : 2, 0, 7);
      pctx.fill();
    }

    // Index fingertip — the control point — always highlighted.
    pctx.beginPath();
    pctx.arc(px(8), py(8), 6, 0, 7);
    pctx.fillStyle = "#ffb300";
    pctx.fill();

    // Scroll direction arrow next to the hand while scrolling.
    if (mode === "SCROLL" && physics.dir !== 0) {
      pctx.fillStyle = "#22d3ee";
      pctx.font = "700 20px system-ui,sans-serif";
      pctx.textAlign = "left";
      pctx.fillText(physics.dir === -1 ? "▲" : "▼", 8, physics.dir === -1 ? 24 : h - 10);
    }
  }

  // ---------- viewport mapping ----------
  // The central 62% of the camera frame maps to the whole viewport, so the
  // fingertip can reach screen corners without leaving the camera's view.
  function mapToViewport(nx, ny) {
    var a = 0.19;
    var b = 0.81;
    var fx = clamp((nx - a) / (b - a), 0, 1);
    var fy = clamp((ny - a) / (b - a), 0, 1);
    return [fx * window.innerWidth, fy * window.innerHeight];
  }

  // ---------- camera-frame handling (measurement only — no motion here) ----------
  var mode = "SCROLL";

  function handle(lm, video) {
    if (mode === "SCROLL") {
      cursor.style.display = "none";
      var d = pointingDir(lm, physics.dir);
      physics.setDir(d);
      // Page-turn only when not scrolling — a vertical point can never be
      // mistaken for a horizontal one mid-scroll.
      if (d === 0 && physics.dir === 0) navCheck(pointingHorizDir(lm));
      else navCheck(0);
      drawPreview(lm);
      setStatus(
        physics.dir === -1 ? "☝️ Scrolling UP — open your palm to stop"
        : physics.dir === 1 ? "👇 Scrolling DOWN — open your palm to stop"
        : "SCROLL mode — point ☝️/👇 to scroll · point ⬅️ for previous page"
      );
    } else {
      var tip = lm[8];
      drawPreview(lm);
      pointer.measure(1 - tip.x, tip.y, pinchRatio(lm));
      setStatus(
        pointer.pinched
          ? "🤏 Holding — open fingers to click"
          : "CURSOR mode — point to aim, pinch & release to click"
      );
    }
  }

  function noHand(video) {
    physics.lost();     // eases the scroll to a smooth stop in the physics loop
    pointer.lost();     // cancels a mid-air press without clicking
    drawPreview(null);
    setStatus("Show your hand to the camera");
  }

  // ---------- boot ----------
  var running = false;
  var landmarker = null;
  var video = null;
  var lastVideoTime = -1;
  var lastStepT = 0;
  var frameCount = 0;
  var lastFreshT = 0;
  var recovering = false;
  var stalls = 0;   // consecutive stall events without a confirmed fresh frame
  var pendingRecover = false;   // camera died while the tab was hidden
  var detectErrors = 0;         // consecutive detectForVideo throws
  var rebuildingAI = false;

  function safePlay() {
    if (!video) return;
    try {
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    } catch (_) {}
  }

  // If the GPU/WebGL context is lost, detectForVideo throws on EVERY frame
  // from then on — tracking would silently stay dead while the loop keeps
  // running. After a burst of consecutive errors, rebuild the landmarker
  // (createLandmarker falls back to CPU if the GPU delegate is broken).
  async function rebuildLandmarker() {
    if (rebuildingAI) return;
    rebuildingAI = true;
    setStatus("Restarting hand tracker…");
    try {
      try { if (landmarker && landmarker.close) landmarker.close(); } catch (_) {}
      landmarker = null;
      await createLandmarker();
      detectErrors = 0;
      setStatus("Show your hand");
    } catch (_) {
      // model fetch hiccup — the next error burst retries the rebuild
      detectErrors = 0;
    }
    lastVideoTime = -1;
    lastFreshT = performance.now();
    rebuildingAI = false;
  }

  // Keep the webcam alive through transient stalls without a jarring off/on.
  async function recoverCamera() {
    // Never fight a backgrounded tab — RAF is paused there, so a "stall" is
    // expected, not a real camera failure. Visibility handler resets timers.
    if (recovering || !running || document.hidden) return;
    recovering = true;
    stalls++;
    try {
      var tracks = (video && video.srcObject) ? video.srcObject.getVideoTracks() : [];
      var live = tracks.length && tracks[0].readyState === "live";
      if (live && stalls === 1) {
        // First stall while the track is STILL alive → just nudge playback.
        // A frozen video usually only needs play(); tearing the camera down
        // (stop+start) is what makes it visibly blink off. Avoid that.
        setStatus("Resuming camera…");
        try { await video.play(); } catch (_) {}
      } else {
        // Track actually ended, or the gentle nudge didn't help → full reconnect.
        setStatus("Reconnecting camera…");
        stopCamera();
        await startCamera();
      }
      lastVideoTime = -1;
      lastFreshT = performance.now();
      setStatus("Show your hand");
    } catch (e) {
      var name = e && e.name;
      if (name === "NotAllowedError" || name === "NotFoundError") {
        // Permission revoked or camera unplugged — retrying cannot fix these,
        // the user has to act. Everything else stays in the retry loop below.
        running = false;
        stalls = 0;
        sessionStorage.removeItem("gfai_on");
        toggleBtn.textContent = "🖐 Gesture: OFF";
        toggleBtn.style.background = "#2a3a66";
        setStatus(name === "NotFoundError"
          ? "No camera found — reconnect it and re-enable from your Profile page"
          : "Camera permission blocked — allow it in the browser, then re-enable");
        notify();
        recovering = false;
        return;
      }
      // Device busy / transient driver error — keep retrying for as long as
      // gesture control is ON. Another app (a video call, Windows Hello) may
      // hold the camera for a while; we take it back the moment it's free.
      recovering = false;
      setStatus("Reconnecting camera…");
      setTimeout(function () { if (running) recoverCamera(); }, stalls < 4 ? 1200 : 3000);
      return;
    }
    recovering = false;
  }

  // Build the landmarker for a given model URL, retrying on CPU if the GPU
  // delegate is unavailable (driver reset, WebGL blocked) — CPU still tracks
  // fine at 480x360, just uses a bit more processor.
  async function landmarkerFor(vision, fileset, model) {
    var opts = {
      baseOptions: { modelAssetPath: model, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 1,
      // Lower thresholds hold the hand lock through fast-swing motion blur so
      // tracking doesn't drop out mid-flick — and keep a noisy low-light hand
      // detectable at night (frames are also auto-brightened, see frameForAI).
      minHandDetectionConfidence: 0.35,
      minHandPresenceConfidence: 0.3,
      minTrackingConfidence: 0.3,
    };
    try {
      return await vision.HandLandmarker.createFromOptions(fileset, opts);
    } catch (e) {
      opts.baseOptions.delegate = "CPU";
      return await vision.HandLandmarker.createFromOptions(fileset, opts);
    }
  }

  async function createLandmarker() {
    var vision = await import(LIB);
    var fileset = await vision.FilesetResolver.forVisionTasks(WASM);
    try {
      // Prefer the self-hosted model bundled with the frontend.
      landmarker = await landmarkerFor(vision, fileset, MODEL_LOCAL);
    } catch (e) {
      // Local asset missing/unreachable — fall back to Google's CDN copy.
      landmarker = await landmarkerFor(vision, fileset, MODEL_CDN);
    }
  }

  async function startCamera() {
    if (!video) {
      video = document.createElement("video");
      video.style.display = "none";
      video.muted = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("autoplay", "");
      document.body.appendChild(video);
      // Chrome sometimes pauses hidden media elements to save power — that
      // freezes currentTime and looks exactly like a dead camera. Resume it.
      video.addEventListener("pause", function () {
        if (running && !document.hidden && video.srcObject) safePlay();
      });
    }
    // A smaller frame at a steady 30fps keeps hand detection FAST and smooth.
    // 60fps @ 640x480 asks MediaPipe to run inference twice as often — on a
    // machine without a working GPU delegate that saturates the main thread and
    // makes the whole app stutter. 480x360 @ 30fps is plenty for gesture control
    // and roughly halves the per-second detection cost.
    // All constraints are `ideal` (soft) — a hard `max`/`exact` can make a
    // RE-open fail with OverconstrainedError on cameras that renegotiate
    // formats, and that failure is how "camera off in the middle" starts.
    var stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 480 },
        height: { ideal: 360 },
        frameRate: { ideal: 30 },
        facingMode: "user",
      },
      audio: false,
    });
    video.srcObject = stream;
    // If the OS/another app takes the camera, the track ends — auto-recover.
    // While the tab is hidden we can't (and shouldn't) fight for the device;
    // remember it and reconnect the moment the tab is visible again.
    stream.getVideoTracks().forEach(function (tr) {
      tr.onended = function () {
        if (!running) return;
        if (document.hidden) { pendingRecover = true; return; }
        recoverCamera();
      };
      // NIGHT: ask the camera itself to fight the dark — continuous
      // auto-exposure / white balance where the hardware supports it.
      // Silently ignored everywhere else (never throws, never blocks).
      try {
        var caps = tr.getCapabilities ? tr.getCapabilities() : {};
        var adv = [];
        if (caps.exposureMode && caps.exposureMode.indexOf("continuous") >= 0)
          adv.push({ exposureMode: "continuous" });
        if (caps.whiteBalanceMode && caps.whiteBalanceMode.indexOf("continuous") >= 0)
          adv.push({ whiteBalanceMode: "continuous" });
        if (adv.length) tr.applyConstraints({ advanced: adv }).catch(function () {});
      } catch (_) {}
    });
    await video.play();
  }

  // ── NIGHT VISION: automatic low-light frame enhancement ─────────────────────
  // In a dark room the raw webcam frames are too dim/noisy for the hand model.
  // We continuously measure scene brightness on a tiny probe canvas; when the
  // scene is dark we brighten + contrast-boost each frame on a full-size canvas
  // (GPU-accelerated ctx.filter) and feed THAT to the AI instead of the raw
  // video. In daylight enhLevel is 0 and the raw video is used — zero overhead.
  var enhCanvas = null, enhCtx = null;   // enhanced frame fed to the AI at night
  var lumaCanvas = null, lumaCtx = null; // tiny probe used to measure brightness
  var enhLevel = 0;                      // 0 = daylight (off) … 1 = very dark (max boost)
  var lumaTick = 0;

  var LUMA_TARGET = 105;  // scene luma (0-255) below which boosting starts
  var LUMA_FLOOR  = 35;   // luma at or below which boost is maximal

  function measureLuma() {
    try {
      if (!lumaCanvas) {
        lumaCanvas = document.createElement("canvas");
        lumaCanvas.width = 48; lumaCanvas.height = 36;
        lumaCtx = lumaCanvas.getContext("2d", { willReadFrequently: true });
      }
      lumaCtx.drawImage(video, 0, 0, 48, 36);
      var d = lumaCtx.getImageData(0, 0, 48, 36).data;
      var sum = 0;
      for (var i = 0; i < d.length; i += 4) {
        sum += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      }
      var luma = sum / (d.length / 4);
      var target = Math.min(1, Math.max(0, (LUMA_TARGET - luma) / (LUMA_TARGET - LUMA_FLOOR)));
      enhLevel += (target - enhLevel) * 0.35;   // ease — no flicker at dusk levels
      if (enhLevel < 0.04) enhLevel = 0;
    } catch (_) { /* probe failure must never break tracking */ }
  }

  function frameForAI() {
    if (!enhLevel) return video;   // daylight: raw video, no extra work
    var w = video.videoWidth || 480, h = video.videoHeight || 360;
    if (!enhCanvas) {
      enhCanvas = document.createElement("canvas");
      enhCtx = enhCanvas.getContext("2d");
    }
    if (enhCanvas.width !== w) { enhCanvas.width = w; enhCanvas.height = h; }
    enhCtx.filter =
      "brightness(" + (1 + 1.35 * enhLevel).toFixed(2) + ") " +
      "contrast("   + (1 + 0.25 * enhLevel).toFixed(2) + ") " +
      "saturate("   + (1 + 0.15 * enhLevel).toFixed(2) + ")";
    enhCtx.drawImage(video, 0, 0, w, h);
    return enhCanvas;
  }

  // ONE loop per display frame: run physics every frame (buttery scrolling),
  // and run AI detection only when the camera has a NEW frame.
  function loop(t) {
    if (!running) return;

    // -- physics: always, time-based --
    var dt = lastStepT ? (t - lastStepT) / 1000 : 0.016;
    lastStepT = t;
    if (mode === "SCROLL") {
      var vel = physics.step(dt);
      showScrollHint(vel);
    } else {
      showScrollHint(0);
      pointer.step(dt);   // silky cursor interpolation at display refresh
    }

    // -- AI detection: only on fresh camera frames --
    // Wrapped in try/catch: ONE bad frame or DOM hiccup must never kill the
    // loop (an uncaught throw here would silently turn the whole thing off).
    try {
      if (landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        lastFreshT = performance.now();
        stalls = 0;   // real frames flowing → clear any pending stall state
        // Post-click: drop to every 2nd camera frame for the first ~700ms so a
        // page navigation right after the click gets the CPU/GPU. After that,
        // full rate again — the cursor must never feel slow while aiming.
        frameCount++;
        // NIGHT: re-measure scene brightness ~1.5x/sec (cheap 48x36 probe)
        if (++lumaTick % 20 === 1) measureLuma();
        if (performance.now() >= pointer.quietUntil - 800 || frameCount % 2 === 0) {
          var res = landmarker.detectForVideo(frameForAI(), performance.now());
          detectErrors = 0;
          if (res && res.landmarks && res.landmarks.length) {
            handle(res.landmarks[0], video);
          } else {
            noHand(video);
          }
        }
      } else if (lastFreshT && performance.now() - lastFreshT > 3500 &&
                 !recovering && !rebuildingAI && !document.hidden) {
        // Watchdog: the camera stopped delivering frames (device grabbed by
        // another app, USB hiccup, privacy toggle) — reconnect automatically.
        // Skipped when the tab is hidden (RAF is paused → stalls are expected).
        recoverCamera();
      }
    } catch (_) {
      // ONE bad frame must never kill the loop — but if EVERY frame throws
      // (lost WebGL context), the tracker itself is dead: rebuild it.
      if (++detectErrors > 45 && !rebuildingAI) rebuildLandmarker();
    }
    requestAnimationFrame(loop);
  }

  function stopCamera() {
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(function (t) {
        t.stop();
      });
      video.srcObject = null;
    }
  }

  async function toggle() {
    if (running) {
      running = false;
      toggleBtn.textContent = "🖐 Gesture: OFF";
      toggleBtn.style.background = "#2a3a66";
      modeBtn.style.display = "none";
      applyPreviewMinState();   // hides panel, minimize button and restore pill
      badge.style.display = "none";
      cursor.style.display = "none";
      showScrollHint(0);
      physics.reset();
      pointer.reset();
      sessionStorage.removeItem("gfai_on");
      stopCamera();
      notify();
      return;
    }
    toggleBtn.textContent = "🖐 Starting…";
    badge.style.display = "block";
    setStatus("Loading tracker & camera…");
    try {
      if (!landmarker) await createLandmarker();
      await startCamera();
      running = true;
      lastVideoTime = -1;
      lastStepT = 0;
      lastFreshT = performance.now();
      physics.reset();
      pointer.reset();
      sessionStorage.setItem("gfai_on", "1");   // survive page reloads
      toggleBtn.textContent = "🖐 Gesture: ON";
      toggleBtn.style.background = "#1f9e78";
      modeBtn.style.display = "block";
      applyPreviewMinState();   // show panel + minimize btn, or the restore pill
      showGuide();
      notify();
      requestAnimationFrame(loop);
    } catch (e) {
      setStatus("Failed: " + (e && e.message ? e.message : e));
      toggleBtn.textContent = "🖐 Gesture: OFF";
      running = false;
      notify();
    }
  }

  function cycleMode() {
    mode = mode === "SCROLL" ? "CURSOR" : "SCROLL";
    modeBtn.textContent = "Mode: " + mode;
    physics.reset();
    pointer.reset();
    showScrollHint(0);
  }

  // ---------- public API (used by the Profile page toggle) ----------
  var listeners = [];
  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](running); } catch (_) {}
    }
  }
  window.GestureFlow = {
    toggle: function () { toggle(); },
    isRunning: function () { return running; },
    showGuide: function () { if (guideEl) guideEl.style.display = "block"; },
    // subscribe(fn) → fn(isRunning) now and on every change; returns unsubscribe
    subscribe: function (fn) {
      listeners.push(fn);
      try { fn(running); } catch (_) {}
      return function () {
        listeners = listeners.filter(function (f) { return f !== fn; });
      };
    },
  };

  function init() {
    buildUI();
    toggleBtn.addEventListener("click", toggle);
    modeBtn.addEventListener("click", cycleMode);
    previewMinBtn.addEventListener("click", function () {
      previewMin = true;
      try { localStorage.setItem("gfai_preview_min", "1"); } catch (_) {}
      applyPreviewMinState();
    });
    previewRestoreBtn.addEventListener("click", function () {
      previewMin = false;
      try { localStorage.removeItem("gfai_preview_min"); } catch (_) {}
      applyPreviewMinState();
    });

    // When the tab is switched away and back, requestAnimationFrame pauses, so
    // the camera's frame timers go stale. On return, reset them (and nudge the
    // video) so the watchdog does NOT mistake the pause for a camera failure
    // and needlessly restart / turn off the camera.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && running) {
        lastVideoTime = -1;
        lastFreshT = performance.now();
        lastStepT = 0;
        stalls = 0;
        if (pendingRecover) {
          // The camera track died while we were in the background — reconnect
          // right now instead of waiting for the watchdog to notice.
          pendingRecover = false;
          recoverCamera();
          return;
        }
        if (video && video.paused) safePlay();
      }
    });

    // If gesture control was ON before a page reload (dev reload, F5), turn
    // it back on automatically — camera permission is already granted, so
    // this needs no user interaction.
    if (sessionStorage.getItem("gfai_on") === "1") {
      setTimeout(function () {
        if (!running) toggle();
      }, 600);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
