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
Next: Lobby, names, ready, countdown, mirrored guest view.

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
