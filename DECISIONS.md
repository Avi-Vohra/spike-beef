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

## FOURTH audit finding: dive was firing ~47 times per match from pure AI movement noise
Continuing the user's explicit "audit everything, make sure it's fun, don't stop" directive.
Measured real CPU-vs-CPU stats (not vibes): dive fired 4692 times across 100 matches
(~47/match, more than one per point) — a mechanic meant to be a rare, deliberate
emergency save was instead constantly hijacking ordinary movement.
- **Root cause #1**: dive.js's double-tap detector only checked "pressed again within
  a max window" with no MINIMUM gap — a human's deliberate double-tap and an AI's (or a
  human's own) ordinary bang-bang direction-correction oscillation both satisfy "pressed
  again within 0.25s," and measured directly that the AI's natural re-press gaps are
  heavily concentrated at 1-20 ticks (0-0.33s) with no clean separation from genuine
  double-tap timing. Fixed by requiring a MINIMUM gap too (DOUBLE_TAP_MIN_GAP=0.08s,
  tracked via a release-age timer rather than a decaying countdown) so a same-tick or
  near-instant flicker can no longer qualify, while a real human double-tap (release,
  pause, press again ~100-200ms later) still does.
- **Root cause #2, found while fixing #1**: `ai.js`'s positioning jitter was re-rolled
  from a fresh random value EVERY SINGLE TICK (hashing `state.tick` directly), so the
  AI's target position chattered at up to 60Hz — combined with the deadzone comparison,
  this flipped its LEFT/RIGHT decision constantly near the boundary. This is itself a
  real movement-feel bug independent of diving (twitchy, unnatural-looking AI movement —
  directly relevant to "opponent readability"), not just a dive-trigger issue. Fixed by
  bucketing the jitter to hold steady for JITTER_HOLD_TICKS (36 ticks ≈ 0.6s) before
  re-rolling — matching how a real player's judgment doesn't re-evaluate from scratch
  every 16ms. This alone dropped CPU-vs-CPU win-share from a skewed 82/18 to a healthy
  53/47 in one measurement (confirms twitchy AI movement was ALSO a fairness bug, not
  just a feel issue) and cut dive frequency from 47/match to ~7/match.
  - **Important trade-off discovered empirically, not assumed**: pushing the jitter
    hold even longer (60 ticks) cut dives further (~4/match) but made the AI
    noticeably MORE exploitable (win-share skewed back to 68/32) — too slow to track
    changes. 36 ticks was kept as the better balance point between "stop twitching"
    and "stay responsive," not the value that most minimized dive count in isolation.
  - Also discovered the two fixes were aliasing against each other: the first
    jitter-hold attempt (10 ticks ≈ 0.167s) landed almost exactly inside the
    double-tap window, so every jitter-bucket transition WAS itself a boundary-
    flicker double-tap — barely moved the needle (4692→2805) until the hold was
    pushed clearly outside the double-tap window's range.
- **Root cause #3 (the decisive fix)**: added a proximity gate — diving now requires
  the ball to actually be within `DIVE_MAX_BALL_DIST` (260px), since diving only makes
  sense as a reach for a ball you could plausibly get to, never as a general movement
  burst. This is also a stronger, more principled filter than timing alone: the AI's
  (and a human's) direction-correction noise happens almost entirely while repositioning
  for a ball that's still far away, not during an actual defensive scramble, so gating
  on distance suppresses nearly all remaining accidental triggers at the source rather
  than fighting the AI's input-noise distribution with ever-tighter timing thresholds.
  Dropped dive frequency to ~2.3/match. Wired the ball through both call sites
  (sim.js's real authoritative step, and netcode.js's guest-side local prediction,
  which uses its last-known snapshot ball position) — verified both compile and the
  full test suite (including two new direct tests: a far-away double-tap does NOT dive,
  a close double-tap DOES) passes.
- Added a permanent regression guard to the existing 200-match stress test
  (tests/sim.test.mjs): fails if dive fires more than 15 times/match on average, so
  this specific bug class can't silently return unnoticed.
- **Win-share note**: this session has repeatedly observed (and documented) that the
  CPU-vs-CPU win-share stat swings widely from small, seemingly-unrelated constant
  changes — consistent with the chaotic sensitivity already noted earlier in this file.
  The 53/47 result from the jitter fix looked like a real improvement; the subsequent
  dip to 67/33 after ALSO adding the proximity gate is most likely more of that same
  known chaotic noise (a single early-match difference cascading through a long
  deterministic simulation) rather than a new problem introduced by the proximity gate
  itself, which has no obvious mechanism to bias one side over the other (it's a
  symmetric, side-independent distance check). Flagged rather than chased further,
  consistent with this session's standing policy on this specific noisy metric — the
  genuinely robust, non-noisy finding across EVERY measurement in this investigation
  (server win rate sitting at 72-85% regardless of the dive/jitter changes) is a
  separate, real issue, next on the list.

## FIFTH audit finding (the big one): the net genuinely could not be cleared from close range
Investigated the stable server-win-rate signal (72-85% across every measurement above,
unlike the noisy match-level win-share stat). Traced a real match point-by-point:
rallyHits for server-won points were 77% CONCENTRATED at exactly 3 — far too specific
to be organic variety. Root cause, confirmed by direct simulation, not assumed: the
RECEIVER kept clipping the net on their return and racking up consecutive touches
until faulting out (4th-touch fault), handing the server a free point without the
server doing anything. The server player's x position literally never moved during
these rallies — they never got to touch the ball at all.
- **Confirmed the actual physics failure directly**: simulated a hit from 32px off the
  net (the real observed distance from the match trace) and found it clips the net
  regardless of hit type — including a FULLY CHARGED hit with the existing
  NET_ARC_BOOST applied. The old approach (`steep += proportional-boost`) was a
  fudge-factor tweak, not a solved guarantee, and measurably wasn't enough. Also found
  the old boost ONLY applied inside the charged-hit branch — passive 'touch'/'fumble'
  contacts (common during fast exchanges, and exactly what the receiver was stuck
  making) got ZERO net assistance at all, using a fixed DEFAULT_STEEP regardless of
  proximity.
- **The fix, built properly rather than another fudge-factor**: added `ensureClearsNet`
  — solves the actual projectile-motion physics for the vy needed to be above net
  height by the time the ball's horizontal travel reaches the net's collision-zone
  EDGE (not its center — an early version of this fix solved to the wrong point and
  was still short), and raises vy to at least that if the current trajectory would
  clip. Combined with a horizontal-power reduction scaled by proximity (up to 60% at
  point-blank — trading punch for hang-time, matching how a real player naturally pops
  a point-blank ball up rather than crushing it flat, since physically there's no room
  to do otherwise). Applied uniformly to every branch that aims at the opponent (hit/
  spike/tip via the charged path, fumble, touch, save) — NOT to block, which already
  has its own correct near-net behavior by design.
- **Two real bugs found and fixed WHILE building this fix, not before shipping it**:
  (1) The naive vy-solve blows up toward negative infinity as distance-to-net
  approaches 0 (dividing by an near-zero time). Fixed with both a time floor
  (NET_CLEARANCE_MIN_TIME=0.05s, preventing the asymptotic blowup) and a final sanity
  cap (NET_CLEARANCE_MAX_VY=-1950, a strong-but-not-absurd ceiling) — caught by an
  actual test producing vy=-8200 before the floor/cap existed, not by inspection.
  (2) Solving to the net's CENTER (distance 0 from NET_X) rather than its collision
  EDGE (NET_HALF_W+BALL_RADIUS=17px out) meant the solved vy was for clearing ~17px
  later than the real collision check actually fires — insufficient by exactly that
  margin. Found by re-simulating substep-by-substep after the first version still
  failed its own test, not by re-deriving the math on paper.
- **Explicitly accepted, not silently papered over**: literally 5px from the net (the
  player almost touching it) remains a genuinely hard edge case where even the solved
  guarantee, floored and capped, may still clip — matches real volleyball (a player
  jammed right against the net has no real recourse either). The test for this
  distance checks it resolves to SOMETHING (no NaN/hang), not that it always clears.
- **Measured impact, before vs after** (100-match CPU-vs-CPU samples): server win rate
  72-85% (stable across many unrelated prior changes) → 40-61% (receiver now has a
  modest, explicable edge instead of the server having a dominant one). Average rally
  length 2.8-3.3 hits → 3.3-5.5 hits (rallies are measurably longer and healthier — the
  200-match test's own rallyHits distribution for both server-wins and receiver-wins is
  now spread smoothly across many lengths with a gentle peak at 4-6, replacing the
  previous suspicious 77%-concentration spike at exactly 3). This is very likely the
  single highest-value fix of this entire audit pass — it was quietly deciding a large
  fraction of every match via an unfair, unreadable mechanism (the server never even
  touched the ball; the point was decided by the receiver's own forced fault).
- Split the growing `tests/sim.test.mjs` (hit 401 lines) into itself (unit-level physics/
  charge/dive/net-clearance checks, 290 lines) and a new `tests/stress.test.mjs`
  (the 200-match CPU-vs-CPU statistics test + difficulty sanity check, 118 lines) —
  same pattern as the earlier `tests/run.mjs` split this session. Also bumped the
  per-match tick budget in tests from 8 to 12 simulated minutes, since healthier/longer
  rallies legitimately push some close matches past the old budget — a real, good
  consequence of the fix, not something to paper over by cutting rallies short again.

## Live browser verification + a false-alarm "frozen game" investigation
First real in-browser visual check this session (via Chrome automation tools, not just
reasoning about the code): loaded the menu, started a vs-CPU match, and confirmed all
three recent visual fixes actually render correctly in a live canvas, not just in
isolated reasoning — the idle backdrop shows behind the menu (no raw black), the sand's
forced-perspective corners are fully covered (no black wedges), and the net renders as
a proper clipped diamond-mesh crosshatch instead of the old ladder look.
- **False alarm investigated and resolved**: after starting a match, the ball/score
  appeared completely frozen across multiple screenshots spanning 15+ real seconds
  (well past the 5s auto-serve timeout), while background clouds visibly drifted —
  looked exactly like a sim-loop regression. Instrumented `main.js`'s `frame()` with a
  temporary `window.__debug` counter (appScreen/state/tick/frameCalls) to check directly
  rather than guess. Confirmed: `document.visibilityState` on the automated tab is
  `"hidden"` (Chrome backgrounds tabs driven by the extension even though
  `document.hasFocus()` is true for input dispatch), and `frameCalls` stayed completely
  flat across clicks and a 6s wait — `requestAnimationFrame` itself was being throttled
  to near-zero by Chrome's background-tab policy, not paused by any game-code bug. The
  cloud drift that looked like "proof the loop is running" is actually computed from an
  absolute `performance.now()` timestamp independent of the tick accumulator, so it
  moves on the rare frame that does fire while the sim-stepping logic (gated by the same
  `frame()` call) effectively never gets enough callbacks to accumulate a real serve.
  Removed the debug instrumentation after confirming the diagnosis; `node --check` and
  the full `node tests/run.mjs` suite both still pass, confirming nothing in `main.js`
  was actually broken.
- **Implication for remaining audit work**: this automation can verify static visual
  state (screenshots) reliably, but NOT sustained real-time gameplay flow (serves,
  rallies, scoring) — the backgrounded tab's rAF throttling makes elapsed sim-time
  diverge arbitrarily from wall-clock time. Continuing the rest of this audit pass via
  the existing Node-side sim/physics/stress test harness (the same methodology that has
  caught every real bug this session) plus sparse, static screenshot checks for visual
  regressions — not via sustained live-interaction testing, which this tooling can't
  reliably sustain. Noting this explicitly so a future "it looks frozen in the browser"
  observation isn't mistaken for a new regression without first checking
  `document.visibilityState`.

## Continuing per explicit user instruction: mechanics + graphics, extras deprioritized
User confirmed extras (courts/cosmetics/settings/practice mode) aren't a priority and
asked to keep iterating specifically on mechanics feel and graphics, without stopping.
- **Movement feel**: `stepPlayer` previously snapped `vx` instantly to ±MOVE_SPEED or 0
  the moment a direction bit changed — zero inertia, which reads as robotic/teleport-y.
  Added `MOVE_ACCEL`/`MOVE_DECEL` (6500/7800 px/s^2) so velocity ramps to full speed in
  ~4 ticks (~0.067s, confirmed via a direct trace: vx hits 430 by tick 3) — imperceptible
  as sluggish, but removes the instant-snap feel. Deliberately NOT a skill/positioning
  cost (unlike the earlier movement-while-charging experiment that was reverted for
  exactly that reason) — pure feel polish. Dive still bypasses this entirely (sets vx
  directly, unchanged). Full test suite still green after the change (win-share stayed
  in the same already-documented noisy range, not a new regression).
- **Graphics — "more 3D" read for round shapes**: added `shadedCircle` to art.js (radial
  gradient: bright highlight top-left, darkened rim, same idea as a lit sphere) and
  swapped it in for both the ball and character heads (previously flat-filled
  `outlinedCircle`). Verified visually via zoomed screenshots, not just by reading the
  code — both now clearly read as rounded/lit rather than flat discs. Limbs/torso left
  as flat-colored capsules (stroked lines, not easily gradient-shaded without a larger
  rewrite) — judged lower value than the two most-looked-at round shapes on screen.
- **Shot placement, done right this time**: found `p.aimDir` was dead code — a vestige
  of the mid-session redesign's cut "steer aim while charging" idea (reverted because it
  conflicted with free movement during charge) that was never removed, always 0, meaning
  every charged hit went in exactly one fixed horizontal direction (straight toward the
  opponent) with power/arc as the only real variable. Re-examined why the original idea
  was cut: it tried to add a LATERAL aim axis, which doesn't actually exist in this
  strictly 2D side-view sim — x is the court's only spatial axis, already fully used for
  player position and shot depth via charge/power. Implemented the version that actually
  fits this game's geometry instead: whichever movement key is held AT THE INSTANT OF
  CONTACT (same bits used for free movement all game, read a second time for a second
  purpose — no new input, no movement cost during the charge itself) leans a hit/tip
  flatter+harder (toward-net direction: a riskier, more aggressive kill-style shot) or
  more arced (away-from-net: safer, lands deeper). Verified numerically, not just by
  reading the code: same charge level, RIGHT-held-at-contact vs neutral vs LEFT-held
  produced vx 557/516/475 and vy -417/-471/-511 — a real, usable tactical choice.
  Removed the dead `aimDir` field entirely rather than leaving it alongside the new
  mechanic. Full test suite still green.
- **Tried and reverted: background palm trees + distant islands**. Attempted a
  procedural palm silhouette (curved trunk + fanned frond strokes) and a hazy distant
  island hump for extra depth/parallax. Checked it visually via a real screenshot before
  keeping it, not just by reading the code — and it was bad: the palm's frond fan read
  as a hand/claw reaching out of the water, not a tree, and the distant island was
  either invisible (the hump) or looked like stray spikes (the small accent dots).
  Reverted the whole addition (`git checkout` on render.js, deleted the new scenery.js)
  rather than ship a worse-looking court. Lesson for next time: a procedural silhouette
  needs an actual visual check before being kept, same discipline already applied to
  the sand-corner and net-mesh fixes — "looks right in my head" isn't sufficient for art.
- **Camera punch-zoom on the hardest hits**: added `fx.triggerPunch`/`getPunchScale` — a
  brief (~0.1s, exponential decay) extra camera scale centered on the court, same
  category of feel-fix as the existing hit-stop/screen-shake, wired to spike (0.05) and
  block (0.03) only — the two hit types that already trigger hit-stop, so the camera
  punch and freeze-frame land together rather than competing. Verified the decay curve
  numerically (fx.js has no DOM dependency, runs fine standalone under Node): 5% punch
  decays to +0.3% by 12 frames (~0.2s), matching the intended quick snap-back. main.js's
  render block now scales around the court center (WIDTH/2, HEIGHT/2) before applying
  shake, so punch and shake compose correctly instead of fighting each other's origin.
  Pushed main.js to 325 lines (was already an accepted 319-line overage, documented
  earlier this session — a few more lines for a self-contained 4-line render-block change
  isn't worth a hasty split).
- **Found a real "how do I know how to hit" regression — at the instructions layer**:
  the in-game "How to Play" screen still described the ORIGINAL pre-redesign instant-tap
  model ("Jump + hit near the top of your jump = spike. Hit while standing = bump.") —
  it never mentioned charge-and-release, tip, block, dive, charged serve, or the new
  shot-placement mechanic at all. Every one of those shipped this session without the
  one screen whose whole job is explaining controls ever being updated. This is exactly
  the "can't tell how to hit" complaint the whole redesign was supposed to fix, just
  silently reintroduced one layer up. Rewrote it to describe the actual current model.
  Verified visually (not just read-through): hit a browser-cache snag first — a plain
  `navigate` to the same URL kept serving the OLD module from Chrome's cache even though
  `curl`ing the dev server directly showed the file was already updated — a hard reload
  (cmd+shift+r) was needed to see the real current state. Worth remembering for any
  future live-browser check in this environment: a `navigate` alone isn't sufficient
  proof of "what's actually running," a hard reload is.
- **Tried and reverted: deliberate AI shot placement**. Attempted to make medium/hard AI
  use the new placement mechanic intentionally — aim toward the net (short/flat) when
  the opponent is standing deep, away from it (deep/arc) when they're camped at net,
  i.e. "hit where they ain't." Code was correct and the test suite's PASS/fail gates all
  stayed green (no out-of-bounds, no NaN, no stuck matches, dive-rate guard fine) — but
  measured the actual effect directly rather than trusting that: average rally length
  across 50 CPU-vs-CPU matches dropped from 5.05 hits (current baseline) to 2.24 — more
  than HALVED. That's a real, large regression against the single goal the entire
  mechanics redesign existed for ("points finish so fast, no time to respond" was the
  ORIGINAL user complaint this whole session started from) — a smarter-looking AI isn't
  worth cutting rally length in half. Reverted via `git checkout -- src/ai.js`. Lesson:
  this is exactly the kind of change that looks correct by code review and still needs
  a real before/after measurement, same discipline as every other finding this session —
  the stress-test harness's win-share metric is known-noisy, but rally length is one of
  its stable, trustworthy signals and should be checked before keeping any AI behavior
  change, not just the hard pass/fail gates.
- **Torso highlight stripe**: exported `lighten()` from art.js and added a thin lighter
  stripe down one side of the torso capsule (offset toward the facing direction) —
  cheap way to give the one remaining flat-filled major shape (after the ball/head
  gradient pass) a bit of the same "lit, not flat" read, without the cost of a true
  gradient on a stroked shape. Verified visually via a zoomed screenshot before keeping
  it (same discipline as the reverted palm-tree attempt) — reads as a subtle highlight,
  not distracting.
- **Spike was too cheap**: `SPIKE_MIN_CHARGE` (0.12) was BELOW `TIP_CHARGE_THRESHOLD`
  (0.15) — a barely-charged tap in the air already qualified as a full-power spike, the
  same charge level that only produces a weak tip on the ground. Measured before fixing:
  3433 spikes vs 4408 regular hits across 40 CPU-vs-CPU matches — the supposedly-hardest,
  highest-commitment shot firing almost as often as an ordinary one. Raised to 0.3 (a
  real, deliberate charge). Re-measured after: spikes 2842 (down ~17%), hits 4479 (up
  slightly), rally length basically unchanged (5.02 -> 4.84). Full test suite still PASS.
- **Hands and feet**: added small filled circles/ellipses at the end of every arm and
  leg capsule — previously those were bare stroked-line ends, which read as amputated
  stumps at this character scale. Feet track the actual swinging leg endpoint (not a
  fixed position) so they stay attached through the run cycle. Hands sit at the exact
  point that resolves a hit in physics.js, the most relevant spot for "hit graphics."
  Verified via zoomed screenshot before keeping (same discipline as every other art
  change this session) — reads as rounded limb ends, not a separate/floating shape.
- **Directional impact particles**: `fx.spawnImpact` now accepts an optional angle to
  bias its particle burst into a cone (±~115°) around the ball's actual outgoing
  velocity direction after a hit, instead of always splashing uniformly in all 360°.
  Wired through gameEvents.js using `Math.atan2(ball.vy, ball.vx)` on the post-hit ball
  state for tip/hit/spike/block/save. Fumble stays radial (no single clear "good"
  direction — matches its "weak unaimed deflect" flavor). Verified fx.js still runs
  standalone under Node (no DOM dependency) with no crash on the new angle param.
- **Swing trail**: added 2 fading "ghost" hand circles trailing the swing arc during the
  post-hit animation (hit/spike/block only, not tip/fumble/save) — same motion-blur idea
  already used for the ball's own speed trail, now applied to the hitting hand so a
  power shot reads as motion, not a single static pose. Reuses the exact same arc formula
  as the real hand position (sampled a bit earlier in `progress`), so it can't drift out
  of sync with the actual swing.
- **Serve indicator**: added a small bouncing chevron above whoever's currently serving
  during the 'serve' phase — there was previously NO visual cue for this at all, which
  matters far more in human-vs-human play than vs CPU (two people sharing a keyboard, or
  two separate devices online, both need to know whose serve it is; a CPU opponent
  doesn't need telling). Verified visually via screenshot — reads clearly over the
  server's head. Directly relevant to the 2-player (local + online) focus requested.
- **Ball squash-and-stretch**: the ball now briefly deforms (flattened perpendicular to
  impact, stretched along it) at the moment of contact, decaying back to round in ~0.1s
  — classic game-feel technique, same impact-angle data already computed for the
  directional particles. Implemented via rotate-into-impact-frame / scale / rotate-back
  around the ball's own translate, kept separate from the spin rotation so squash
  direction doesn't spin with the ball. Verified the decay curve numerically under Node
  (fx.js has no DOM dependency) and confirmed no console errors / correct render in the
  live browser after wiring it through render.js and main.js.
- Noted for future live checks: the dev server's no-cache headers (needed to fix stale
  content) make every navigation re-fetch the whole module graph from disk, which is
  measurably slower than before — a click right after `navigate` now needs a longer
  wait (~2s, not ~1s) before the menu's listeners are actually attached, or it silently
  does nothing. Not a bug, just a different timing budget than earlier in this session.
- **Hit-cooldown ring**: a thin fading circle appears around a player for the brief
  HIT_COOLDOWN window (0.18s) right after they touch the ball — without any cue, a rapid
  second touch silently not registering (by design, so one swept contact across several
  substeps doesn't count as 3) just looked like unresponsive controls. Drawn in world
  space before the squash/dive transform so it stays a clean circle regardless of pose.
- **Dive-cooldown arc**: a closing cyan arc (0.6s, matches DIVE_COOLDOWN) around a player
  who just dove — same "why didn't that work" problem as the hit cooldown but for dive's
  longer, more noticeable lockout window. Distinct color/radius from the hit-cooldown
  ring so the two never get confused when they happen to overlap (a dive followed
  immediately by a touch).
- **Touch-count pips**: small pips above whichever side currently holds the ball, filling
  in as they use their MAX_TOUCHES(3) allowance — "about to fault on the next touch" was
  previously only trackable by mentally counting hit sounds, genuinely hard in live play
  and worse in human-vs-human where both players need to agree on the count. Uses
  `match.lastToucherSide`/`match.touches[side]` rather than indexing both sides blindly,
  since the non-active side's touch count is stale leftover data from earlier in the
  rally (confirmed by reading rules.js's registerTouch, which only resets the NEW
  toucher's count, never the old one's).
- Split src/hud.js out of render.js (score, connection dot, serve indicator, touch pips,
  banner) — render.js had grown to 303 lines across this round's additions, back to 213
  after the split; hud.js is 98 lines. Verified both still compile and the match renders
  correctly after the move, not just a syntax check.

## SIXTH audit finding: double-hit-same-tick bug near the net
Continuing the edge-case hunt with the user now focused on real 2-player (local + online)
testing. Checked whether two players could physically both reach the ball at once —
PLAYER_RADIUS=26, and the minimum gap between two players both pressed up against the
net boundary is only 62px, so the ball sitting at center court (equidistant, 31px from
each) is within collision range (minDist=38) of BOTH players simultaneously.
- **Confirmed via direct reproduction, not assumed**: with both players at that exact
  boundary position and the ball between them, calling `step()` once produced TWO
  separate 'touch' events in the same tick (side 1 then side 0), with the second
  immediately reversing the velocity the first had just set (vx flipped from the
  direction p1 sent it to the opposite direction from p2) — a physically nonsensical
  same-instant double-contact, and two fault-eligible touches charged in one tick.
- **Root cause**: `sim.js`'s hit-resolution loop ran once per substep (4 substeps/tick),
  and each player's own `hitCooldown` only blocks THAT player from re-hitting — it does
  nothing to stop the OTHER side from also registering a hit in a later substep of the
  SAME tick. My first fix attempt (a `break` after the first hit within one substep's
  inner loop) only stopped it within a single substep and did NOT fix the real bug,
  which spans substeps — caught by re-running the exact reproduction after the first
  fix and seeing it still fail, not by assuming the first attempt worked.
- **The real fix**: a tick-level `ballTouchedThisTick` flag (not substep-level), set the
  moment any player registers a hit, gating the entire hit-resolution loop for the
  remaining substeps of that tick. Re-ran the reproduction: exactly one 'touch' event
  now, correct final velocity.
- **Verified this doesn't change normal play**: re-measured the 40-match CPU-vs-CPU
  average rally length before/after — 4.84 both times, identical. This is a real, rare
  edge case (both players deliberately crowding the exact net boundary), not something
  that was quietly affecting typical rallies, but a genuine correctness bug for the kind
  of tight net-crowding play two competitive humans (the current focus) are likely to
  produce more often than the CPU, which doesn't deliberately camp the net boundary.

## New serve mechanic: toss-serve (explicit user request: "separate mechanic for serves")
Replaced the instant charge-and-release serve (hold HIT, release, ball launches immediately
from a glued position) with a toss-serve: pressing HIT tosses the ball off the server's
hand into a real free-falling arc; the server then has to time their RELEASE against the
ball actually falling back into reach, same charge-and-release pipeline as every other
hit (tip/hit/spike by charge level), but as a genuine two-beat gesture instead of one
button press. `match.serveTossed` tracks the transition; phase deliberately stays 'serve'
(not 'rally') through the whole toss flight, only flipping once real contact resolves —
this matters because `registerTouch`'s existing phase==='serve' special case is what
keeps the server's own contact from counting toward `rallyHits`, which ace detection
depends on (confirmed by testing: without this, ACE call-outs would never fire again).
- **Three real bugs found and fixed while building this, each caught by actually running
  it, not by review**:
  1. **Toss drifted out of reach**: gave the toss a small `dir*30` horizontal nudge (felt
     natural on paper) — over the ~1.1s flight this compounds into real drift, and traced
     a continuously-held toss landing completely untouched 70px from a server who never
     moved. Fixed: zero horizontal velocity on toss, straight up and straight back down.
  2. **Toss origin just outside reach even with zero drift**: the serve's `dir*40`
     horizontal offset from the server (purely a visual "ball floats beside your body"
     position under the old instant-serve model, never collision-relevant before) put the
     ball ~41.8px away at its lowest reachable height — just outside the 38px
     (PLAYER_RADIUS+BALL_RADIUS) collision radius. Reduced to `dir*18`, leaving real
     margin. Found by tracing exact ball/player distance tick-by-tick, not by guessing.
  3. **Serve was unreturnable — 200/200 in the stress harness, literally every point an
     instant ace**: the server's own contact reuses the normal hit/spike trajectory
     shapes, which are flat and fast — tuned for mid-rally exchanges where the receiver
     already has time to be in position, not a cold-open serve. A well-timed release hit
     ~620px/s horizontal, far faster AND flatter (less hang time) than the old fixed-arc
     serve's ~340px/s max. Added `capServeTrajectory` (SERVE_MAX_SPEED=560,
     SERVE_MIN_ARC_RATIO=1.1) to re-shape the server's own contact back into a returnable
     envelope, applied only when `match.phase==='serve'` at the moment of contact (before
     `registerTouch` flips it). **Sub-bug caught on the first attempt**: ordered the arc-
     ratio enforcement BEFORE the speed cap, not after — enforcing the ratio can only grow
     `|vy|`, so capping speed first and then raising `|vy|` pushed speed right back over
     the cap (ace rate was still ~49% after this "fixed" version). Swapped the order
     (ratio first, uniform speed-scale last, which preserves the ratio) — re-measured:
     ace rate dropped from 49% to 0.6%, a sane number, not 0% (still possible) or 100%.
- **Also had to fix the AI's serve logic**, which was written for the old instant model
  ("hold until charge reaches a target, then release immediately"). Under the toss model
  that releases almost right after the toss begins — 50+ ticks before the ball actually
  falls back into reach — wasting RELEASE_GRACE_SECONDS entirely and resolving as a weak
  passive touch instead of a real serve. Fixed: AI now just tosses immediately (press HIT)
  then falls through to the SAME distance-based release logic it already uses for every
  other incoming ball, since post-toss the ball genuinely is just a normal ball the AI
  needs to react to. Removed the now-dead `serveCharge` profile field.
- Rewrote the serve-related sim.test.mjs test (Test 6c) for the new model: confirms an
  early release (long before the ball falls back) wastes the charge into a weak 'touch',
  a well-timed release (just before actual contact) produces a real charged hit, and the
  server's own contact never counts toward rallyHits either way. The old test checked
  ball velocity one tick after an instant release — meaningless under a model where
  contact only resolves once the tossed ball actually falls back, sometimes 70+ ticks
  later.
- Net effect, measured over 40 CPU-vs-CPU matches: ace rate 0.6% (sane), average rally
  length 3.47 (down from the pre-redesign 4.84 baseline — a believable consequence of
  serving now being a real timing skill rather than a free near-max-power opener, not
  something chased further given this session's standing policy on not over-tuning
  CPU-vs-CPU aggregate stats).

## New block mechanic: active block (explicit user request: "separate mechanic for blocking")
The old block was free and automatic: jumping anywhere near the net while NOT charging
auto-triggered it, zero skill required — essentially an accidental side-effect of
jumping near the net at the wrong moment, not a deliberate move. Redesigned to be
genuinely deliberate: hold HIT while jumping at the net, and the TIMING of that jump —
being near its peak (same window the spike mechanic uses) at the moment of contact — is
what separates a real block from a mistimed attempt. No release needed (unlike a charged
hit elsewhere) — holding through the peak IS the action. Off-peak timing while still
holding HIT near the net costs the charge and produces the same weak 'fumble' deflect as
any other mistimed contact, instead of a free pass. Implemented by moving the block check
to the FRONT of resolvePlayerHit's branch chain (`jumping && nearNet && p.charging`),
ahead of the regular charged-hit/mistimed branches, since it's a more specific case that
needs to win priority — a released charge (`p.charging` already false by then) still
correctly falls through to the normal spike/hit/tip logic, so there's no conflict between
"block near net" and "spike near net," which are different gestures (hold vs release).
- Updated Test 6d for the new model: confirms (a) holding HIT + jumping + near net + near
  peak = 'block', (b) the SAME position/timing WITHOUT holding HIT no longer auto-blocks
  (the core behavior change), (c) holding HIT near the net but off-peak = mistimed
  'fumble', (d) a block attempt far from the net still doesn't block regardless of timing.
- **CPU never attempts active blocks** (measured: 0 blocks across 40 CPU-vs-CPU matches,
  down from the old automatic model's ~398) — same precedent already established for
  dive ("CPU players never dive... they already reposition with perfect information...
  diving doesn't add anything for them"). Block is now the same category: a genuine
  human-skill move for local/online 2-player play, not something the CPU needs built for
  it. Not a silent gap — explicitly the same accepted design choice as dive.
- Re-measured balance after this change: average rally length 3.54 over 40 CPU-vs-CPU
  matches, consistent with the 3.47 baseline right after the serve-mechanic fix (not a
  new regression — small variance expected from the randomness two independently-tuned
  mechanics interacting).

## 2v2 team mode, part 1: core sim/rules generalization
Explicit user request: "2 players on one team on one computer and 2 players on another
team on a different computer... wasd and arrows for each on each computer." This is the
foundational layer (sim.js/physics.js/rules.js) — input wiring, rendering, menu, and
online netcode extension are separate follow-up pieces.
- `createPlayer(side, slot = side, xOffset = 0)`: added `slot` (this player's position
  in the flat `players` array, used to index per-tick inputs — kept separate from `side`
  because 2v2 puts two players on the same side with different slots) and `xOffset`
  (spreads 2v2 teammates apart visually; the engine has no player-vs-player collision so
  nothing breaks if they overlap, it just looks wrong). Both default to exactly the
  existing 1v1 behavior (`slot=side`, `xOffset=0`) — zero behavior change for 1v1.
- `createInitialState(seed, teamSize = 1)`: `teamSize=2` creates 4 players (2 per side,
  slots 0-3). `step()` now accepts EITHER the original `step(state, inputP1, inputP2)`
  two-arg form (unchanged, still works for every existing 1v1 call site) OR
  `step(state, inputsArray)` where `inputsArray[p.slot]` is each player's mask — detected
  via `Array.isArray`.
- Every per-player input lookup (`updateCharge`, `updateDive`, `stepPlayer`,
  `resolvePlayerHit`) switched from `inputs[p.side]` to `inputs[p.slot]` — required,
  since `p.side` is no longer a valid array index once two players share a side.
- `setPointReaction` now applies the win/lose pose to EVERY player on the winning/losing
  side (was direct `players[0]`/`players[1]` indexing, which only worked because 1v1 had
  exactly one player per side at a fixed index).
- Serve: the lowest-slot teammate on the serving side always serves — a deliberate
  simplification (no rotation between teammates), not an oversight; real volleyball
  rotation is out of scope for this pass.
- **Touch-count rule needed ZERO changes**: `rules.js`'s `registerTouch`/`lastToucherSide`
  logic already operates at the TEAM (side) level, not per-individual-player — a teammate
  touching the ball after their partner already correctly continues the team's touch
  count rather than resetting it (real volleyball rule), purely because the existing
  code was already side-indexed, not player-indexed. Confirmed by reading the logic
  before assuming it needed updating, not by guessing.
- Added Test 7 (sim.test.mjs): confirms 4 players created with correct sides/slots
  ([0,0,1,1]/[0,1,2,3]), and a FULL 2v2 match completes with all 4 players actively
  moving/hitting (not just the serve-fault loop) with no NaN anywhere — ball or any
  player position — over up to 12 simulated minutes. Full existing 1v1 suite still green
  throughout (ran after every incremental change, not just once at the end).
- **Deliberately not built this pass**: no CPU/AI support for 2v2 (ai.js still assumes
  one player per side) — matches the user's explicit ask, which is local-human + online
  team play, not vs-CPU. Local dual-keyboard input collection, 4-player rendering, the
  2v2 menu option, and online netcode carrying 2 players per side are separate follow-up
  pieces, not yet done as of this commit.

## 2v2 team mode, part 2: generalized rendering
Fixed render.js, which was hardcoded for exactly 2 players: `const [p1, p2] = state.players`
silently dropped any player past index 1 (an entire team in 2v2), and both
`drawServeIndicator`/`drawTouchPips` indexed `state.players[match.server]`/
`state.players[side]` directly — `match.server`/`side` are TEAM values (0/1), not
array indices, once a side holds 2 players (side 1's players live at array indices
2-3, not index 1). Replaced with a generic loop over all players (color/mood computed
from each player's own `side`, not array position) and `.find(p => p.side === ...)`
for the serve indicator and touch pips (which show above the first/lowest-slot
teammate on that side — the match state tracks team touches, not which individual
teammate last touched, so this is the closest available approximation). Emote bubbles
are per-side (the taunt bar is one shared UI control, not per local player) and now
show above each side's first teammate in 2v2. Verified 1v1 renders pixel-identical
to before via screenshot — this was purely a generalization, not a visual change for
the existing mode.

## 2v2 team mode, part 3: netcode extension, menu, and a live-connection investigation
- Generalized `netcode.js` for configurable `teamSize` (1 or 2): host receives/applies
  `teamSize`-length guest input arrays (was a single value), snapshot packets carry
  `2*teamSize` player positions (was a fixed 2), and the guest predicts `teamSize` local
  avatars + interpolates `teamSize` opponents (was exactly 1 of each). 1v1's wire format
  and behavior are unchanged (teamSize defaults to 1 everywhere).
- **Found and fixed a real crash-class bug in `online.js`** while doing this: renaming
  `getRenderState()`'s fields from singular `opponent`/`self` to plural
  `opponents`/`selves` (required for 2v2) left `online.js`'s `guestController` still
  reading the OLD field names — `r.opponent`/`r.self`, now always `undefined`. This
  would have crashed on the very first render of ANY online match (1v1 included, not
  just 2v2), the moment a guest connected. The existing test suite did NOT catch this:
  `net.test.mjs` only ever asserted on `getRenderState().ball`, never `.opponent`/`.self`
  specifically. Fixed by rewriting `mirrorTeamsForDisplay` to work off the arrays, and
  added a new integration test (exported `hostController`/`guestController` from
  online.js specifically for this) that drives the REAL display-building layer — not
  just the lower-level netcode functions — over LoopbackTransport for both teamSize 1
  and 2, asserting the right player count, valid sides, and the guest's own team drawn
  first. This is exactly the kind of bug "tests still pass" can hide if the test doesn't
  happen to touch the renamed field — a reminder to test the actual consumer, not just
  the producer, when renaming a shared data shape.
- Added "Online 2v2" to the main menu, a `teamSize`-aware `renderOnlineMenu`, and wired
  `onlineTeamSize` through `goOnlineMenu`/`createRoom`/`joinRoom` in main.js. The match
  loop now sends `[keyboard.getP1()|touch, keyboard.getP2()]` as the local team's inputs
  when `onlineTeamSize===2` (same P1=WASD/P2=Arrows split as Local 2P), vs. a single
  mask for 1v1. **Found and fixed a real UX bug while wiring this**: three separate
  "Cancel" buttons in the online flow (waiting screen, lobby, connecting screen) called
  `goOnlineMenu()` with no argument, silently defaulting back to teamSize 1 — so
  canceling out of a 2v2 room would drop you into the 1v1 menu without any indication
  the mode had changed. Fixed all three to pass `onlineTeamSize` through.
- **Live two-tab connection test**: created a room from one tab, joined from a second —
  got as far as real PeerJS signaling (a room code was issued, "Connecting..." appeared
  on the joining side), but the WebRTC handshake never completed within several minutes
  of real wall-clock time. Investigated rather than assumed-broken: checked
  `document.hidden` on the backgrounded tab (true, same as the rAF-throttling finding
  documented earlier this session), and — critically — ran the exact same two-tab test
  against the EXISTING, unmodified Online 1v1 path as a control. It showed the IDENTICAL
  stuck-at-"Connecting..." symptom. Since 1v1's connection code was not touched by this
  session's changes at all, this confirms the failure is a limitation of testing two
  simultaneous live connections in this single-window browser-automation environment
  (only one tab is ever truly foregrounded, throttling the other's timers badly enough
  to stall WebRTC signaling) — not a bug in the 2v2 work, and not something fixable from
  inside this codebase. Recorded here so a future "it won't connect" report in THIS
  testing environment isn't mistaken for a new regression without first running this
  same 1v1 control check.
- **What this means for confidence in 2v2 online**: the sim/rules/netcode/display logic
  is thoroughly verified (Node tests, including a full real match with all 4 players
  actively playing, plus the new online.js integration test over LoopbackTransport with
  simulated network delay/loss). The one layer that could NOT be verified end-to-end in
  this session is a real two-device WebRTC handshake, for the same reason the existing
  1v1 mode's real-device behavior was never independently re-verified this session
  either — that requires two actual separate devices/browsers, which this tooling
  cannot provide. The user should treat this the same way as any other online feature
  in this project: the logic is sound and tested as thoroughly as this environment
  allows, but a real two-phone/two-computer check is the way to confirm it fully.

## Updated How-to-Play again for the new serve/block mechanics
The in-game instructions had already been fixed once this session for the charge-model
redesign, but this session's later toss-serve and active-block changes made it stale
again (still said "hold HIT to serve" and "jump near the net without charging = block" —
both no longer true). Rewrote to describe the actual current serve (toss, then time your
release) and block (hold HIT while jumping, timed near peak) mechanics. Verified visually
— fits the panel cleanly at 11 lines. Also changed "3 touches max per side" to "per team"
since that phrasing reads more naturally for 2v2 (the underlying rule/count is identical
for both modes — team touches already worked correctly with zero logic changes, as
documented in the 2v2 part 1 entry above).

## 2v2 polish: match-end screen team labels
`renderMatchEnd` said "P1 wins the match!" regardless of mode — made no sense for a 2v2
team win (neither "P1" nor "P2" refers to a specific real player anymore, since both
sides now have two). Added a `teamSize` param: 2v2 shows "Red Team"/"Blue Team" (matching
the actual on-court colors), 1v1 keeps the existing "P1"/"P2" wording. Threaded through
from main.js's `onMatchEnd` using the same `onlineTeamSize` already tracked for the
online flow (local/CPU matches are always 1v1, so default to that).

## 2v2 polish: fixed a missed hardcoded-2-player spot in replay.js
Swept for remaining `players[0]`/`players[1]` direct-index assumptions after the render.js
fix (same bug class) and found one more: `replay.js`'s `record()` built each buffered frame
as `[{...players[0]}, {...players[1]}]`, silently dropping any player past index 1 — a 2v2
match's slow-motion final-point replay would have shown only 2 of the 4 players. Fixed with
`state.players.map(p => ({...p}))`. The only other direct-index hit (`ai.js`) is the
existing 1v1 CPU code, correctly unreached in 2v2 (no CPU support there, by design).

## 2v2 polish: fixed dive sand-puff fx using the wrong player in 2v2
Found via a continued sweep for `players[ev.side]`-style direct indexing (same bug class
as render.js/replay.js): `gameEvents.js`'s dive handler did `players[ev.side]` to find
WHO dove and position the sand-puff particle burst at their feet — `ev.side` is a TEAM
value (0/1), not a safe array index once a side holds more than one player. Verified the
exact failure mode directly: for team1's second player (slot 3) diving, the old lookup
`players[1]` would grab team0's SECOND player (x=200) instead of the actual diver
(x=800) — the sand-puff would appear at a teammate's feet on the completely wrong side
of the court. Fixed by adding `slot` to the dive event in sim.js (events only carried
`side` before) and switching gameEvents.js to `players.find(p => p.slot === ev.slot)`.
Online guests still get no sand-puff for a dive (unchanged, already-accepted gap — the
host's snapshot only ever serializes bare event type strings, stripping side/slot same
as every other event field), but the common offline/host case is now correct for 2v2.
