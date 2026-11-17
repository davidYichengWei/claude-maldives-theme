# Coconuts

## Sub-features

- A crate of five coconuts stands on the water villas' boardwalk, between the
  last villa and the walk's end; its top has a dark hollow for each place, so
  the empty ones show how many are gone (`CRATE_TOP`). Each
  coconut is a fifth of the room left in the context before it is compacted
  (`levelOf`: tokens over `autoCompactThreshold`, read once from
  `$.session.usage({ breakdown: 'summary' })` and again after a compaction).
  A compaction fills the crate to five whatever room it leaves: the engine
  has no count of the compacted context until the next request (see
  `dev/verify/engine-facts.ts`), and its system prompt and tools, which no
  compaction frees, are often most of it. The first count after it is where
  the crate starts from (`refilled`): only a change from that count takes
  coconuts out again. The plane is done as the compaction hook returns.
  `coconut-wait.json` checks the crate fills (`expect`).
- Every coconut a drink is made of is one flat shape (`#cco`, no outline): in
  the crate, in Clawd's hand by the crate and at the island bar (`nutAt`), and
  the empty shell it tosses (`#cch`, the same with its hole showing).
- The room is read after every main-loop tool call and every
  `session.measure`. When the crate holds more than the room, and Clawd rides
  the boat, the boat goes by the end of the boardwalk (`byTheWalk`): it lies
  there stern to the walk, Clawd hops up, takes one from the crate (it rises
  into the left hand), lifts it to drink (`sips`, `SIP_S`), tosses the shell
  into the sea in front of the walk (an arc, then spray and a ring of foam
  at `SPLASH`), walks back empty-handed and hops aboard, and the trip goes
  on (to the circuit, or home). More than one owed: it drinks and tosses each
  in turn; at most three a trip, the rest on another trip straight after.
- Clawd holds a coconut only by the crate, from taking it to tossing it
  (`holding`); never on deck, on the island or while fishing.
- Owed while Clawd is ashore, it waits for the next turn: once Clawd is
  aboard (`retry` at `boards`), the boat goes by the boardwalk before its
  circuit.
- A compaction calls the seaplane (`Plane`, `planeCalled`): it flies in from
  the right edge on a long shallow descent, levels off nose a little up just
  above the water, touches down flat with a burst of spray and slows to
  `MOOR`, behind the end of the boardwalk, in `PLANE_IN_S`, foam at its bow
  and a wake behind it while it moves on the water; its propeller turns
  throughout (`flightOf`: `touch`, `pitch`). Clawd is sent to wait for it
  (`Voyage.wait`, `toWait`): aboard, the boat makes for the walk's end and
  Clawd walks to `WAIT`, by the crate;
  ashore, the boat fetches it off the island first. While it waits the trip
  stays put whatever the agent does and no coconuts are fetched (`steerAll`).
  Standing there it passes the time on the wall clock (`waiter`, `ON_PIER`,
  `WAITER_S`, `WAITER_BUSY`): a look through its spyglass towards the plane,
  then a tune it sways to with notes rising, its face glancing and winking
  throughout. It takes these up and leaves them off only at ease
  (`waiterAtEase`), so nothing drops half way.
- Once the compaction is done (`Plane.done`), the cargo is handed over
  (`unloaded`, `Plane.swap`, `Plane.cargo`) as soon as the plane is moored
  and Clawd stands at `WAIT` (or a minute on regardless), and, if Clawd has
  stood waiting, once it is at ease (up to a few seconds on): the door slides
  open, and each coconut short of a full crate is thrown down into
  Clawd's hand, held a moment and set in the next empty place
  (`handedOver`, `SWAP`, `swapSeconds`); the door shuts. The crate stays
  where it is. Then Clawd leaves the walk for work or home, and the plane
  turns, gathers speed across the water, raises its nose and lifts off with
  spray, and climbs away at an angle out by the right edge (`lift`).
- Coconuts come only by the seaplane: more room than the crate holds with no
  plane on its way (the room read again, or the Compact preview) calls one
  with its cargo ready (`resupplied`), once the last plane is out of view. A
  Clawd out by the boardwalk finishes there first.

## How to get to it (user POV)

Work through a long conversation, or the Clawd menu's Context left row:
**Use 20%** (`/maldives drink`) previews a fifth of the room used up, the
boat fetching Clawd off the island first when it is home; **Compact**
(`/maldives resupply`) previews a compaction, the seaplane bringing a full
crate. Reset goes back to the real room. `/compact` brings the seaplane;
`/maldives debug` has a `seaplane:` line.

## Driving it with verify/run.sh

`coconut-run.json` (one, then two owed out at work), `coconut-landing.json`
(owed as the turn ends), `coconut-called.json` (the turn ends while Clawd is
on the walk), `coconut-ashore.json` (owed at home, fetched on the next turn's
way out), `coconut-refill.json` (a compaction mid-turn: the whole seaplane
run), `seaplane-idle.json` (a quick `/compact` at home: fetched off the
island, the plane waits for Clawd), `seaplane-turn-ends.json` (the turn ends
while Clawd waits), `seaplane-errand.json` (compacted while Clawd is at the
crate), `coconut-wait.json` (a long compaction: Clawd's spyglass and tune
by the crate). Events `room N`, `compact` and `compacted N`.

## Gotchas

- The scene draws the crate from how it stood as the trip set out
  (`errand.from`) until Clawd is back aboard, and the pantry atom holds how it
  will stand after; a trip called away before the walk falls back to
  `pantryAt` at that moment, so nothing taken is lost or taken twice.
- A trip asked for while Clawd is off the boat on the walk waits until it is
  back aboard (`errandUntil(…, isOff)` and a retry); `planOf` still plans one
  begun on the walk (`offTheWalk`), which fuzz exercises.
- Aboard again from the walk counts as aboard in `stageAt` for both phases,
  else a trip called then planned Clawd walking from the dock's deck.
- The errand adds about 8 k to a scene. In a crowd past every rung the last
  rung leaves out the visitors called up by hand; tracks skip stay keyframes.
- A wait never ends by itself: its plan's `errand.back` is Infinity. Spans
  drawn from a plan skip it (`errandSpan`); anything that steps through a
  plan's moments must too (the fuzz once drew a scene at Infinity and hung).
- The plane is drawn under the pier, being farther off; the coconuts it
  throws are drawn with the crate, over the pier. Every shell tossed and
  every coconut thrown plays one shared set of keyframes from its own moment
  (`TOSSED`, `THROWN`), for room; keyframes no element plays are left out,
  as the clock cannot put them on its ticks.
- A plain scene leaves out the plane's spray; the rest of a busy scene with
  the plane in it sits right at `ROOM`.
- Tests mock `clock.after` to run the callback at once: with the test clock
  frozen, a retry for a moment still ahead runs forever. Advance the clock by
  the wait in the mock.
