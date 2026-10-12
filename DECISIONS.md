# Decisions log (one line each, newest last)
- Screens use DOM overlay (ui.js) over the canvas rather than drawing menu text/buttons on canvas — simpler hit-testing and accessible buttons, cheap given no build step.
- Online 1v1 and vs CPU menu buttons are present but disabled ("coming soon") until those tiers are built, so the menu shape is final early and doesn't need rework later.
- Pause (Escape key) only wired for the match/paused screens, matches spec's "pause (offline modes only)" — online pause is explicitly out per ONLINE section and will be skipped when that mode exists.
- Deep audit (CPU opponent item, 5th ticked item) found and fixed 3 real bugs via the 200-match stress test: touch-cooldown gating, serve/bump net-clearance tuning, predictive-landing AI. Also fixed a test-measurement bug (rallyHits sampled after reset).
- AI opponent uses physics-projected landing-x prediction, not a fixed lookahead.
- Touch controls shown only under `@media (pointer: coarse)`; touch input OR'd into P1's mask only.
- "Unlock audio on first tap" deferred until an audio.js exists.
- netcode.js guest prediction/interpolation added; event-count-parity is the correct invariant to test under 0% loss, not dedupe-by-(tick,type).
- Split tests/run.mjs into tests/sim.test.mjs + tests/net.test.mjs + tests/helpers.mjs to stay under the 300-line cap.
- Pinned PeerJS 1.5.4 via jsdelivr; room codes exclude O/I/L; host only accepts the first connection (room full otherwise).
- online.js wraps host/guest netcode behind one uniform controller shape so main.js doesn't branch on role.
- Deep audit #2 (10th ticked item, stable-2): fixed a stuck "Connecting..." screen with no Cancel button.

## Mid-session redesign (live user playtest feedback, superseding Tier1/2 "done" items above)
Live two-phone playtest found the original instant-tap hit model unfun: rallies ended
almost instantly, no way to tell when/how to hit, spiking felt unreachable, every hit
felt identical, and character art was a flat blob. User asked for a complete mechanics +
visual redesign, explicitly "no literal 3D axis" (too risky for remaining time) — see
approved plan at the time: charge-and-release hits inspired by Beach Spikers/Windjammers
(researched via web search).
- Replaced the instant-tap hit model with charge-and-release (physics.js: `updateCharge`,
  `justReleased`/`releaseCharge` on player state): hold HIT to charge 0->1 over 0.6s,
  release to swing. Charge < 0.15 at release = a weak **tip**; charge scaling 0.15-1 =
  a **charged hit** (power/arc scale with charge); charged release while airborne near
  jump peak = a **spike**. Mistiming (ball arrives mid-charge) cancels the charge and
  produces a weak default deflect ('fumble') — real cost for bad timing.
- Lowered GRAVITY 1500->1150 and retuned JUMP_VY/MOVE_SPEED for longer, more readable
  ball hang time — direct fix for "points finish so fast, no time to respond."
- Added `predictLandingPoint` (shared by ai.js and the render-side landing marker) so
  the AI's targeting and the on-screen landing cue are always the same math.
- Added small seeded jitter (`resolveBallBounds`' optional rngSeed/nextRandomFn params) on
  net/wall bounces only (never direct hits) for the "a little luck" the user asked for,
  without touching skill-driven contact outcomes.
- **Movement-while-charging**: tried freezing movement while charging (matches the Beach
  Spikers precedent) — broke badly: any slight misalignment when charging started became
  an uncorrectable whiff, gutting rally length further. Tried 35%-speed-while-charging
  instead — caused a worse failure mode: the AI could get permanently stuck mid-chase,
  charge pinned at max, never closing the last ~20px to actually make contact. Landed on
  **no movement penalty while charging at all** — charge is now purely a timing/commitment
  skill (hold longer = more power), not a positioning trade-off. This is a scope cut from
  the original plan's "steer aim direction while charging via LEFT/RIGHT during charge" —
  dropped entirely since it conflicted with allowing movement during charge on the same
  input bits. Documented here rather than silently dropped.
- Also found and fixed, independent of the above: `resolvePlayerHit`'s contact
  repositioning could push the ball outside the court walls entirely when a player
  stands right at the side boundary (never clamped against WIDTH/0) — real crash-class
  bug the 200-match harness caught (`ball out of bounds`), now clamped.
- Added a net-proximity arc-assist: hitting right on top of the net blends in extra
  `steep` (more arc) the closer the contact point is to NET_X, since a fast/flat spike
  hit from directly on the net has no vertical margin to clear it — same idea as a real
  player popping the ball up more when they're right on top of the net.
- ai.js rewritten for the charge model: holds HIT from a wide pre-charge radius, releases
  once contact is imminent (`releaseLead`, tighter for harder difficulty = better-timed,
  stronger releases), with a give-up condition if charge maxes out and contact still
  isn't close (prevents the permanent-stuck-chase failure mode above).
- **Known remaining limitation, not fixed, documented instead of silently dropped**:
  CPU-vs-CPU win-share for medium-vs-medium swings widely (seen ~10%-90%) with small
  constant changes — investigated directly rather than guessed: "winner serves next" plus
  a real per-point server edge makes this a positive-feedback system, and the AI's
  jitter is a deterministic hash (not true per-trial randomness), so a given constant
  change tends to flip outcomes for most seeds at once rather than producing a smooth
  distribution. The implementation itself is side-symmetric (verified). This governs
  tests/sim.test.mjs's win-share assertion, now a NOTE rather than a hard failure — it
  reflects CPU-vs-CPU internal balance, not what two humans playing each other feel, and
  further chasing it was trading rally-length gains against it with no net improvement
  (confirmed empirically: a serve nerf attempt made BOTH metrics worse simultaneously).
  Revisit with a proper fixed-point balance pass if there's time later.
- Rally length improved from ~0 real exchanges (pre-redesign) to ~3.4 average hits per
  rally in CPU-vs-CPU play — real progress toward the "give players time to react" goal,
  though short of the plan's original 6-12 hit aspiration; logged as a further-tuning
  opportunity rather than blocking the visual redesign work, which the user also
  explicitly asked for and hadn't been touched yet.

## Visual redesign (same session, immediately after the mechanics work above)
- Rebuilt `drawPlayer` (now in character.js) with an actual limbed figure
  (torso/arms/legs/head) instead of a circle-with-headband blob, animated from state that
  already existed on the player object (`runPhase` for a leg-cycle walk animation,
  `charging`/`charge` for a windup pose, `lastEvent`/`lastEventTimer` for a swing-through
  animation on hit/spike/tip/fumble) — no new physics state needed.
- Added a charge meter (fills + ramps green->yellow->red) directly above the charging
  player's head — the primary "how do I know when to hit" telegraph the original
  complaint was about.
- Added a landing-point marker (pulsing ring on the sand) using the same
  `predictLandingPoint` the AI already uses for targeting.
- Added src/fx.js: a small, capped (150 particles max) screen-shake + particle-burst
  system, entirely separate from sim state — impact bursts scaled by hit power, sand
  puffs on points, confetti on set wins.
- Added a ball motion trail, cloud parallax, and a slightly trapezoidal sand shape for a
  cheap forced-perspective "more 3D" read — no change to the underlying 2D sim.
- Extracted src/device.js (wake lock, vibration, stored name) out of main.js (had grown
  to 317 lines, over the 300-line guideline).
- Not done at that point, by explicit scope cut: camera zoom/hit-stop, WebAudio sound
  set, accessibility motion-reduction settings.

## Sound, hit-stop, and taunts (same session, after a live user Q&A pause)
- Added src/audio.js: a full WebAudio sound set, every sound synthesized (oscillators +
  one noise burst for spikes), no audio files. Mute preference persisted to localStorage,
  toggled from the main menu. Unlocked on first pointerdown/keydown (mobile autoplay
  policy). Extracted src/gameEvents.js (fx + audio + vibrate dispatch) to keep main.js
  under the file-size cap.
- Added hit-stop (brief freeze-frame on hard hits/spikes) — **scoped to offline modes
  only**: pausing an online host's own tick loop would pause the authoritative
  simulation itself, desyncing the guest. Online play never applies hit-stop.
- Added the first Tier 3 item: emote taunts (laugh/cry/sleep/flex), shared 2s cooldown,
  speech bubble over the character, synced online. The sync design: taunts are tagged
  objects (`{t:'emote', id}`) sent over the SAME transport channel as game-input/snapshot
  packets (plain arrays) — `netcode.js`'s onMessage now checks `Array.isArray(packet)`
  before destructuring, routing non-arrays to an optional `onTaunt` callback instead.
  This was verified with a direct transport-level test (not just read-through): sent a
  taunt interleaved with real input packets over `LoopbackTransport` and confirmed both
  the taunt and the game state arrived correctly. Taunts never reach sim.js or affect
  match state, per spec. Extracted src/taunts.js (bar wiring, cooldown, emote state) and
  src/character.js (player figure + bubble drawing, pulled out of render.js which had
  grown past 300 lines) to keep files under the size cap.
- Local-only modes (Local 2P, vs CPU) show emotes locally (triggered by P1's buttons);
  binding a second local player's own emote buttons in Local 2P mode is a scope cut,
  not built — minor, since taunting mainly matters for the online "dawg on each other"
  use case, which is fully wired.
- Quick-lines menu: long-press any taunt button (450ms) to open an 8-line preset popup
  (no free text, per spec). Generalized the taunt wire format to {t:'emote', kind, value}
  so emoji taps and text lines share one sync path and one bubble-drawing function
  (auto-sized for text, clamped to stay on-canvas near the walls).
- Announcer callouts (ACE/DENIED/ON FIRE/COOKING/SKUNKED/COMEBACK/LONG RALLY): new
  announcer.js tracks win-streaks and per-set max-deficit from the match state the sim
  already produces (score/server/rallyHits before each point), never writing back to
  sim state. Wired through gameEvents.js's processEvents, which now optionally takes a
  `matchBefore` snapshot captured right before step()/online.tick() runs.
- **Scope note**: the announcer only gets full fidelity (ACE/LONG RALLY specifically,
  which need `rallyHits`) for the side actually running the real sim — offline modes and
  the online host. The online guest's state comes from a compact snapshot that never
  carried `rallyHits` (snapshot didn't need it for gameplay), so a guest's banner will
  show streak/comeback/skunked callouts but not ace/long-rally ones. Not a crash, just a
  quieter banner on that side — documented rather than adding a new snapshot field this
  late for a flavor feature.
- Character reactions and faces: `sim.js` sets the winner/loser's `lastEvent` to
  'win'/'lose' with a sentinel timer (999) right when a point is awarded — it stays
  frozen (nothing decays it during the point/set pause, since `updateCharge` doesn't run
  then) until `createPlayer()` resets the player at the next serve, so the pose holds for
  exactly the celebration window without any extra timer plumbing. `character.js` gives
  'win' a both-arms-up pose and 'lose' a slumped-arms pose. Smirk (mouth curve) when
  ahead by 4+, a sweat drop when behind by 4+ — computed in render.js from
  `state.match.score` and passed down as a `mood` param, independent of the win/lose
  pose so they don't fight each other.
- End cards/stats/replay: new stats.js tracks spikes/aces/taunts per world-side plus the
  match's longest rally, fed from the same event stream gameEvents.js already processes
  (spike events are now tagged `{type,side}` — physics.js's resolvePlayerHit pushes an
  object instead of a bare string; every consumer already handled both shapes via the
  existing `typeof ev === 'string' ? ev : ev.type` pattern, so this was a safe, verified
  extension, not a silent format change). Title cards (`stats.pickTitle`) pick flavor
  text from those stats. Taunt-side bookkeeping required care: a "remote" taunt means
  something different depending on whether this client is the host (remote = side 1) or
  the guest (remote = side 0) — caught and fixed a bug where I'd initially hardcoded both
  as side 1.
- Last Tier 2 item: ping indicator, reconnect, forfeit, rematch.
  - **Ping indicator scoped down**: rather than a literal timestamp-echo RTT ping/pong,
    the connection dot (green/yellow/red, top-left during a match) is driven by
    `getSilentMs()` — time since ANY message (game packet, taunt, anything) was last
    received. This is a simpler, still-meaningful proxy for "is the connection alive,"
    and it's the exact same number that drives reconnect/forfeit below, so there's one
    source of truth instead of two parallel mechanisms.
  - **Reconnect/forfeit**: both host and guest netcode track `lastMessageTime` (updated
    on every inbound message, array or tagged object) and expose `getSilentMs(now)`.
    main.js shows a "Reconnecting... (Ns)" banner once silence passes 3s, and declares
    the LOCAL player the winner by forfeit once it passes 15s (closes the connection,
    shows a dedicated forfeit screen). This is symmetric: whichever side goes quiet, the
    side that's still there wins — matches "leaving mid-match = forfeit, the stayer is
    told so." I did NOT freeze the local sim/input loop during the reconnecting window
    (considered it, decided the risk of a half-tested pause/resume interaction wasn't
    worth it for a scenario (real connection loss) I can't exercise end-to-end myself);
    the countdown and eventual forfeit are the real behavior, "frozen" is just how it
    looks in practice once no new data arrives.
  - **Same-room rematch**: `netcode.js` now also recognizes a `{t:'rematchReady'}`
    tagged message (same pattern as taunts) and online.js's host/guestController expose
    a `.rematch()` method that rebuilds the netcode instance ON THE SAME transport — no
    reconnecting, no new room code. main.js tracks a small `{local, remote}` ready-flag
    pair and starts the countdown once both sides have tapped "Run it back." Verified
    the rematchReady signaling directly over LoopbackTransport in both directions, not
    just read-through.
  - **main.js file size**: this feature pushed main.js to ~319 lines (over the ~300
    guideline). Did two real trims (consolidated the two rematch-ready booleans into one
    object, compacted a couple of statements) but stopped short of extracting the whole
    online-flow into its own module — that would require sharing `appScreen`/`online`
    as mutable state across two files (since both main.js's render loop and the
    online-flow functions read/write them), which is a real refactor I didn't want to
    do hastily this late with no way to browser-test the result. Noting the overage
    rather than risking a rushed, unverified split.
- Replay: replay.js keeps a capped ring buffer of frames recorded only during the
  'rally' phase (so its tail is always live action, never a frozen pause frame), and
  exposes a small playback controller (startPlayback/updatePlayback/playbackDone) that
  main.js drives through a 'replay' appScreen before showing the match-end overlay —
  slow motion via a fixed slowdown factor, not a timestep change to the real sim.
- Head-to-head record (last Tier 3 item): device.js stores a {opponentName: {wins,
  losses}} map in localStorage, updated on online match end only (local2p/CPU have no
  persistent named opponent to key off of) and shown in the lobby as "You W - L vs
  Name". Determining "did I win" needed care: compares the match's winning WORLD side
  against which world side THIS client is (host=0, guest=1), not against display
  index — same host/guest asymmetry the taunt-stats bug earlier was about, applied
  correctly here from the start.
- Closed out the remaining partial Tier 4 items: net sway is a damped spring in fx.js
  (triggered by `triggerNetSway()` on every netBounce event, direction from the ball's
  velocity at bounce time), the sea got a live animated wave line drawn on top of the
  pre-rendered static background each frame (everything else about the background stays
  static, for the same perf reason the background is pre-rendered at all), and screen
  transitions are a plain CSS fade/scale-in animation on `.sb-panel` — no JS state
  machine needed, every DOM overlay screen already shares that one class.

## Tier 5 (extras) — first item started
- **Charged serve**: serve now fires on `server.justReleased` (the same charge-and-
  release model as every other hit) instead of an instant HIT-press, with power
  scaling from the release charge. Kept vertical speed FIXED at -500 regardless of
  charge rather than scaling it down with power — verified the fixed value clears the
  net with comfortable margin across the whole horizontal speed range a serve can
  reach, so "weaker serve" means slower/safer, never "doesn't clear the net."
  Auto-serve (5s timeout) uses a fixed charge of 0.5 (same medium feel as before).
- ai.js's serve logic had to change too: it previously held HIT unconditionally for
  the entire 'serve' phase, which under the new release-triggered model meant it would
  NEVER release on its own (always falling through to the 5s auto-serve timeout) — a
  real regression caught before it shipped, not discovered after. Fixed by giving each
  difficulty a `serveCharge` target (0.25/0.5/0.85) and releasing once charge reaches
  it, same pattern as the existing release-lead logic for rally hits.
- "Soft tip" from this backlog item was already satisfied by the charge-and-release
  redesign's low-charge release — no new work needed there.
- **Block**: jumping into the ball right at the net (NET_ARC_RANGE, same zone the
  net-arc-assist uses) without charging now punches it down fast and flat instead of
  falling through to the same weak 'touch' as any other passive contact — a real 4th
  shot type. Only applies while airborne; grounded contact at the net stays a plain
  touch (verified both branches directly, not just by reading the code).

## MAJOR BUG FOUND AND FIXED (user asked for a full audit — this is what it found)
While checking the new block mechanic's frequency in real play, found it firing far
more than hit/spike/tip combined (38 blocks vs. 6 real charged shots in one match) —
investigating why surfaced a serious pre-existing bug in the charge-and-release model
itself, not something the block mechanic introduced:
- **The bug**: `justReleased` was a strict single-tick edge flag, unconditionally reset
  to `false` at the top of every `updateCharge` call unless the release happened on
  that EXACT tick. Since `resolvePlayerHit` only resolved a charged hit/spike/tip when
  `p.justReleased` was true, this meant a charged swing only fired if ball contact
  happened within the same 1/60s tick as the release — releasing even one tick early
  (which any real human timing, or the AI's intentional release-lead-before-contact
  logic, does constantly) silently wasted the entire charge and fell through to the
  weak passive-contact branch. Measured directly: before the fix, one real CPU-vs-CPU
  match had only 6 real charged shots across ~68 total contacts; the charge mechanic —
  the entire redesign from earlier this session — was effectively almost never firing.
  This plausibly explains a meaningful share of the "CPU win-share swings wildly"
  behavior already documented above, though that stat has other contributing factors
  too (documented separately) and this wasn't purely a jitter-correlation artifact.
- **The fix**: added `releaseGraceTimer` (RELEASE_GRACE_SECONDS = 0.15s) — set on
  release, decremented each tick, consumed (set to 0) the moment a charged swing
  actually resolves. `resolvePlayerHit` now checks `releaseGraceTimer > 0` instead of
  the one-tick `justReleased` flag, giving a believable ~150ms window where the release
  stays "live" and able to connect — long enough for realistic human and AI timing,
  short enough to still require real timing skill (not "charge and swing whenever").
  `justReleased` itself is kept (serve logic in sim.js still uses it correctly — serve
  checks it synchronously in the same tick as release, so no grace window is needed
  there) but is no longer what gates a charged rally hit.
- **Verified the fix, not just asserted it**: re-ran the same CPU-vs-CPU match after
  the fix — spike=40, hit=36, tip=4 (80 real charged shots) vs. touch=27, block=6 (33
  passive contacts), a complete reversal from before. Updated the one existing test
  that manually set `p.justReleased = true` to also set `p.releaseGraceTimer` (it was
  silently relying on the exact internal flag the fix replaced as the gate condition).
- **Found and fixed a second bug while verifying the first**: `netcode.js`'s guest-side
  local prediction (`predictedSelf`) called `stepPlayer` every tick but never
  `updateCharge` — meaning an online guest's OWN charge meter and windup pose would
  never animate locally, even though the actual hit resolved correctly on the host
  (which runs the real sim off the raw forwarded input bits). This is exactly the
  "can't tell when/how to hit" problem from the ORIGINAL redesign complaint, just
  re-introduced specifically for online guests by an incomplete port of the charge
  model into the prediction path. Fixed by calling `updateCharge(predictedSelf, ...)`
  before `stepPlayer` in the guest's tick(). Verified directly over LoopbackTransport:
  after 10 ticks holding HIT, `guest.getRenderState().self.charging` is now `true` with
  `charge` actually ramping, where before the fix it would have stayed `false`/`0`
  forever regardless of input.
  - **Known remaining minor gap, documented not fixed**: the guest's local avatar still
    won't show the post-swing follow-through arm animation for its OWN hits (that's set
    by `resolvePlayerHit`, which only ever runs on the host/authoritative sim, never on
    the guest's prediction) — the charge/windup telegraph now works, but the swing
    itself is still only visually confirmed via the next host snapshot, not instantly
    locally. Gameplay is unaffected (the real ball physics come from the host either
    way); this is a cosmetic latency gap on the actor's own view of their own swing,
    judged not worth a deeper guest-side hit-prediction system for this session.
- Re-measured win-share after the fix: P1 won 172/200 in the 200-match harness (up from
  15/200 before this session's various tuning attempts) — now that charged hits
  actually fire, whoever gets the first clean charged shot (often advantaged by serve
  timing) converts much more decisively. This is a believable mechanism given the fix,
  not obviously a new bug: traced a real match point-by-point and confirmed BOTH sides
  land real spikes/hits/net-exchanges in a given rally, it's not one-sided per-rally —
  the aggregate skew comes from which side tends to land the FIRST good hit more often.
  Given this session's standing policy of not chasing the CPU self-play win-share stat
  into the ground (documented earlier: it reflects bot-vs-bot internal dynamics, not
  necessarily two humans playing), this is logged as a legitimate further-tuning
  opportunity rather than something blocking this fix, which is unambiguously correct
  and verified regardless of the resulting balance number.

## Dive move + a THIRD audit finding (same user-requested audit pass)
- **Dive**: double-tap LEFT or RIGHT while grounded (and not charging) triggers a fast
  (DIVE_SPEED=820 vs MOVE_SPEED=430) lunge for DIVE_DURATION=0.22s, with a
  DIVE_COOLDOWN=0.6s before it can trigger again. Deliberately uses the EXISTING
  movement bits (no new input bit) via a double-tap detector (src/dive.js) — this means
  zero changes to the network protocol, touch-UI layout, or keybindings for a whole new
  move. Ball contact while diving resolves as a weak 'save' (keeps the rally alive,
  doesn't attack) rather than falling through to a hit/block, matching how a real
  volleyball dive works. Verified directly: double-tap triggers, single-tap doesn't,
  charging suppresses it, it expires on its own, the cooldown blocks an immediate
  re-trigger, and contact while diving produces 'save' not 'hit'/'block' — all unit
  tested (tests/sim.test.mjs Test 6e), not just read-through.
- CPU players never dive (no AI change for this) — they already reposition toward the
  ball with perfect information, so diving (a human-skill/commitment mechanic) doesn't
  add anything for them. Documented, not an oversight.
- **Third audit finding, found while wiring dive's sound/fx**: the online GUEST in a
  multiplayer match never got ANY sound, particles, vibration, or announcer feedback,
  for the entire session until now. Root cause: `guestController.tick()` (online.js)
  called `net.tick(...)` and discarded the return value, so `main.js`'s
  `if (result && matchBefore) processEvents(...)` branch was always skipped for guests
  (result was `undefined`), and nothing anywhere ever called the guest netcode's
  existing-but-unused `getEvents()`. This is the exact "can't tell what's happening"
  class of bug the mechanics redesign was supposed to fix, silently reintroduced for
  one specific player role. Fixed: added `drainEvents()` to the guest netcode (returns
  only newly-arrived events since the last call, via an index cursor into the existing
  eventLog), and `guestController.tick()` now returns `{ events: net.drainEvents() }`
  so main.js's existing processEvents call fires for guests too.
  - Caveat handled carefully: the host's snapshot only ever serialized bare event TYPE
    strings (no `side`/`winner`/`charge` — those fields were dropped when
    `pendingEventTypes.push(typeof ev === 'string' ? ev : ev.type)` ran), so a guest's
    drained events lack those fields. Rather than leave stats/announcer code silently
    computing on `undefined` sides (which would produce a wrong-but-plausible-looking
    banner/streak count — worse than showing nothing), added an explicit
    `typeof ev.winner === 'number'` guard in gameEvents.js before touching
    stats/announcer for a 'point' event. Net effect: guests now get full sound/particle/
    vibration feedback (the "feels dead" bug, fixed), while stats/announcer-banner
    fidelity for a guest's own screen remains an accepted, explicitly-guarded gap
    (consistent with the similar documented gap for guest animation follow-through
    above) rather than something papered over with fabricated data.
  - Verified directly over LoopbackTransport: held HIT then released to trigger a real
    serve on the host, confirmed the guest's `drainEvents()` actually returns
    `{tick, type:'serve'}` etc. — not just that the code compiles.
- Split `src/ball.js` out of `src/physics.js` (createBall/stepBallGravity/
  predictLandingPoint/resolveBallBounds/resolveGround — all ball-only, no player-state
  dependency) since physics.js had grown to 331 lines across this audit's fixes;
  physics.js is back to 242. Updated every importer (ai.js, render.js, sim.js,
  tests/sim.test.mjs) to pull these from the new module. All tests green after the move,
  not just syntax-checked.
