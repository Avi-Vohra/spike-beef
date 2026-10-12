# Current state
TIER 1 FULLY COMPLETE (all 6 items). Touch controls (on-screen buttons,
pointer:coarse only), landscape-lock rotate screen, canvas DPI scaling, and
mobile hardening (no pull-to-refresh/scroll/context-menu, wake lock, vibrate
on hit/point) are all in. Menu: Local 2P and vs CPU (3 difficulties) enabled,
Online 1v1 disabled ("coming soon").
Local server running at http://localhost:8787 for manual checking.
Tier 2: online play is ACTUALLY WORKING end-to-end in code (can't test two
real browsers myself, but connection logic, room codes, share link,
join-by-link, and a minimal playable match are all wired). Menu -> Online
1v1 -> Create Room (shows code + share) or Join Room (code entry) -> on
connect, match starts immediately (no lobby/ready-up/countdown yet — next
item). PeerJS pinned to 1.5.4 via jsdelivr, verified reachable.
Deep audit #2 done (stable-2 tag): walked every screen transition, found and
fixed one real stuck-state (no Cancel on the "Connecting..." screen).
Lobby, names, ready, countdown, mirrored guest view also done (online.js
handshake + ui.js lobby screens + swapLeftRight/mirrorState for the guest).

MID-SESSION REDESIGN (see DECISIONS.md "Mid-session redesign" section): a
live two-phone playtest found the original instant-tap hit model unfun —
rallies ended almost instantly, no way to tell when/how to hit, every hit
felt identical, art was a flat blob. Replaced with a charge-and-release hit
system (hold HIT to charge, release to swing: tip / charged hit / spike),
slower gravity for readability, shared landing-point prediction, a little
seeded luck on bounces. Rally length improved (~0 -> ~3.4 avg hits); CPU-vs-
CPU win-share balance is a known, investigated, documented rough edge
(DECISIONS.md) deprioritized in favor of the visual redesign — not yet
touched and explicitly requested.
VISUAL REDESIGN DONE (this session): limbed characters with run/charge/swing
animation, charge meter above head, landing-point marker, fx.js (screen
shake + capped particle bursts: impact/sand-puff/confetti), ball speed trail,
cloud parallax, trapezoidal sand for a cheap perspective read. Extracted
device.js (wake lock/vibrate/name) to keep main.js under 300 lines.
Not done, scope-cut and documented in DECISIONS.md: hit-stop/camera zoom,
WebAudio sound set, accessibility motion settings.
Sound + hit-stop added after that (see DECISIONS.md). Session paused for live
user Q&A, then resumed: Tier 3's first item (emote taunts) is now done —
4 emoji buttons (laugh/cry/sleep/flex), shared 2s cooldown, speech bubble
over your character, synced online over the SAME transport channel as game
packets (taunts are tagged objects, game packets are plain arrays, so the
two protocols can't collide — verified with a direct transport-level test,
not just read-through).
TIER 2 AND TIER 3 BOTH FULLY COMPLETE. Tier 2's last item (ping indicator,
reconnect, forfeit, rematch) is done: connection-health dot driven by
silentMs, 3s "Reconnecting..." banner, 15s auto-forfeit (whoever's still
there wins), and a real same-room rematch (reuses the existing transport,
no new room code) via a netcode-level rematchReady handshake. Verified
silentMs timing and rematchReady signaling directly over LoopbackTransport.
main.js is ~319 lines (over the ~300 guideline) — accepted rather than
risking a hasty untested refactor; reasoning in DECISIONS.md.
TIER 4 FULLY COMPLETE too (net sway, animated sea wave, CSS screen
transitions closed out the last 3 partial items). Only Tier 4's "physics
feel tuning" stays flagged [~] since the CPU-balance issue is an accepted
open item, not something left undone.
Tier 5 core-mechanics item COMPLETE: charged serve, block, dive, soft tip
(already satisfied by the charge model) all done and tested.

MAJOR BUG FOUND AND FIXED during a user-requested full audit: the charge-
and-release hit model (this session's big earlier redesign) was only
resolving a charged hit/spike/tip if ball contact happened within the
EXACT SAME TICK as releasing HIT — any realistic timing wasted the whole
charge. Measured: 6 real charged shots vs 68 total contacts in one match
before the fix; 80 vs 33 after. Also found and fixed a second bug while
verifying the first: online guests never animated their own charge meter
locally (netcode.js's prediction called stepPlayer but not updateCharge).
Both fixed, verified directly (not just read-through), full test suite
green. See DECISIONS.md "MAJOR BUG FOUND AND FIXED" section for full
detail including what's still an accepted open item (CPU win-share, and a
minor guest-side cosmetic gap on the swing follow-through animation).
THIRD major audit finding (same audit pass, found while wiring dive's fx):
online GUESTS never got any sound/particles/vibration/announcer feedback
for the whole session — guestController.tick() discarded its return value,
so main.js's processEvents call never fired for guests. Fixed via a new
drainEvents() on the guest netcode. Verified directly over
LoopbackTransport. Full detail in DECISIONS.md.
Also split src/ball.js out of physics.js (which had grown to 331 lines)
to stay under the file-size guideline — all tests green after the move.
USER REQUESTED A FULL FUN/EDGE-CASE AUDIT, EXPLICITLY "DON'T STOP." Continuing
that now instead of moving to Tier 5 polish items.

FOURTH audit finding (measured, not assumed): dive was firing ~47 times per
match from pure AI movement noise — the double-tap detector had no minimum
gap, and separately ai.js's positioning jitter re-rolled every single tick
(60Hz chatter), both of which satisfied the "double tap" check constantly.
Fixed with three layered changes: a real minimum gap, jitter held steady
for ~0.6s at a time (also fixed genuinely twitchy AI movement — confirmed
this independently improved CPU-vs-CPU balance too), and a ball-proximity
gate (diving only makes sense near the ball anyway). Dive rate now ~2.3/
match. Added a permanent regression guard to the stress test.
Next: investigate server win rate, which has sat at 72-85% across every
measurement in this investigation regardless of the above changes — this
looks like a real, stable signal (not the known chaotic win-share noise),
worth fixing for actual player fairness.

# Log
- Done: sim.js + physics.js + rules.js with tests (headless match completes, deterministic, in-bounds).
- Done: canvas render (beach court, players, ball), keyboard input (WASD/arrows), fixed-timestep main loop.
- Done: tests for touch-fault counting and spike-vs-bump outcome differences.
- Done: screens/menu (ui.js DOM overlay) + match-end + pause; Local 2P is the only enabled mode so far.
- Done: CPU opponent (ai.js, 3 difficulties) + deep audit #1 — fixed touch-cooldown gating, serve/bump net-clearance tuning, switched AI to physics-projected landing prediction. Tagged stable-1.
- Done: touch controls (on-screen D-pad + jump/hit), landscape-lock rotate screen, mobile hardening (scroll/zoom/context-menu blocked), wake lock, vibrate on hit/point. Tier 1 complete.
- Done: src/transport.js — fake clock + LoopbackTransport (delay/jitter/loss), deterministic, tested (4 new tests).
- Done: src/netcode.js — host-authoritative sim over the transport interface, redundant guest input packets, host snapshots. Net test (a): full CPU-driven match over LoopbackTransport at 40ms/0% loss completes with matching final scores and no dropped/duplicated events.
- Done: guest-side prediction of own avatar + interpolation of ball/opponent from snapshot history; net tests (b) 150ms/jitter/5%loss and (c) 300ms/10%loss both pass. Split tests/run.mjs into 3 files to stay under the 300-line cap.
- Done: src/transport.js PeerTransport (createPeerHost/createPeerGuest), src/online.js orchestration, room codes, share link, join-by-link, error screens. Deep audit #2 found+fixed a stuck "Connecting..." screen with no Cancel. Tagged stable-2.
- Done: lobby/names/ready/countdown/mirrored-guest-view (online.js handshake protocol + ui.js screens + swapLeftRight/mirrorState).
- Done: MECHANICS REDESIGN — charge-and-release hit model (tip/charged-hit/spike) replacing instant-tap, slower gravity, shared predictLandingPoint, seeded bounce jitter, net-proximity arc-assist, wall-clamp bug fix, ai.js rewritten for charging. See DECISIONS.md for the full account including dead-ends tried and reverted.
