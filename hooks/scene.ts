// The Maldives lagoon backdrop: one SVG whose layers follow the agent's mood.

import type { Mood, Need } from '../types'
import { ENTER_X, HORIZON_Y, LEAVE_X, ROAM_S, depthScale, enterSeconds, fixAt, lapAt, lapStart, leaveSeconds, roams, routeOf, sailsBehind, sizeOn, sizesOf, whereabouts } from './fleet'
import type { Boat, Point } from './fleet'
import { BAR, BEACH_TIP, CIRCUIT_START, DOCK, circuitAt, FIRE, HOME, ISLE, JETTY, LAP_FACING, LOUNGER, along, dayOf, facingAt, isByLounger, lifeAt, lyingIn, planOf, scatter, turns } from './voyage'
import type { Day, Doing, Leg, Voyage } from './voyage'

const W = 1600
const H = 1000
const HORIZON = 430
const SUN_X = 1130
const SUN_Y = 212

// What the lead boat flies: nothing but its plain pennant, or what the agent
// is held on and needs the person for.
export type Signal = Need | 'error' | 'none'

// The signal flown now, the one it replaced, and the seconds since the change.
// `hailed` is how long ago the boat began calling for the person, when that
// differs from `age`.
export type Flag = { from: Signal; to: Signal; age: number; hailed?: number }

// How long one signal takes to give way to the next.
export const HOIST_S = 1.6
// One beat of the mascot's hailing hops.
const HAIL_S = 2.4
const HOIST = `${HOIST_S}s ease-in-out calc(var(--h,0) * -1s) 1 both`

// Seconds between one leap of a dolphin pod and its next.
const LEAP_EVERY = 52

// Every looping animation takes its phase from the wall clock (--t, seconds),
// so a redraw resumes the motion where it was instead of restarting it. --d
// shifts one element's phase.
const PHASE = 'calc((var(--t,0) + var(--d,0)) * -1s)'

function loop(name: string, seconds: number, timing: string): string {
  return `animation:${name} ${seconds}s ${timing} ${PHASE} infinite`
}

// Deterministic scatter in [0, 1).
function rnd(i: number, salt: number): number {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return v - Math.floor(v)
}

// Three decimals, for scales.
function f3(n: number): string {
  return String(Math.round(n * 1000) / 1000)
}

function f(n: number): string {
  return String(Math.round(n * 10) / 10)
}

const STYLE = `
.sky0{stop-color:#1f86d6}.sky1{stop-color:#5fb8ec}.sky2{stop-color:#bfe6f8}.sky3{stop-color:#f2fbff}
.sea0{stop-color:#0f6fae}.sea1{stop-color:#1597c2}.sea2{stop-color:#22bfc8}.sea3{stop-color:#5fdcd2}.sea4{stop-color:#a6f0e2}
.halo0{stop-color:#e9fff9}.halo1{stop-color:#9ff3e4}.halo2{stop-color:#5fdcd2}
.sand0{stop-color:#fffaf0}.sand1{stop-color:#f6ead0}.sand2{stop-color:#e3cfa3}
.roof0{stop-color:#d9b273}.roof1{stop-color:#a87a3f}
.cl0{stop-color:#ffffff}.cl1{stop-color:#e3f1fa}
.sund0{stop-color:#fffbe6}.sund1{stop-color:#ffedb0}.glow0{stop-color:#fff1bf}.col0{stop-color:#fff6d6}
.gcol{fill:#fffadf}
.far{fill:#3f8f7a}.farsand{fill:#f1e6c8}
.wall{fill:#b7875a}.wallshade{fill:#946a43}.deck{fill:#8a6440}.post{stroke:#6b4c2f}
.trunk{fill:#9a7650}.bark{fill:#82623f}.ring{stroke:#7d5d3c;fill:none}.sh{fill:#6b5326;opacity:.18}
.fa{fill:#2c8a4f}.fb{fill:#3aa35f}.fc{fill:#24733f}.rib{stroke:#1d5e33}
.bush{fill:#2f8a4f}.bush2{fill:#3fa35e}.leaf{stroke:#2f8a4f;stroke-width:2.2;stroke-linecap:round}.flw{fill:#ff6f91}.flc{fill:#ffe08a}
.grass{fill:none;stroke:#5f9e47;stroke-width:1.5;stroke-linecap:round}.grain{fill:#a88a52}.shoal{fill:#a6f3e4}
.crb{fill:#e8603c}.crl{stroke:#b8432a;stroke-width:1.3;stroke-linecap:round;fill:none}
.foam{stroke:#ffffff}.wet{fill:#d2bd8a}
.crest{fill:#ffffff}
.glint{fill:#ffffff}
.gull{stroke:#2a3c46}
.shade{fill:#0a4f66;opacity:.13}
.tsk{fill:#5fa596}.tsh{fill:#4f8459}.tsl{fill:#74a872}.tsc{stroke:#346048}.teye{fill:#1d3326}
.mb{fill:#27566e}.mm{fill:#d5f0f0;opacity:.4}
.rbase{fill:#0a6278;opacity:.22}.kl{fill:none;stroke:#fff;opacity:.38}.sg{fill:none;stroke:#35b37e}
.k1{fill:#ff8fa3}.k2{fill:#ffa35c}.k3{fill:#b98ae0}.k4{fill:#ffd86b}.k5{fill:#4fd0bd}.k6{fill:#f2665f}
.s1{fill:none;stroke:#ff8fa3}.s6{fill:none;stroke:#f2665f}
.rf1{fill:#ff8a3c}.rf2{fill:#2f8fff}.rf3{fill:#ffe14d}.rf4{fill:#ffffff}
.fin{fill:#33505f}.dol{fill:#3f6f8f}.dolb{fill:#b9d3e2;opacity:.8}
.ff{fill:#3f86c2}.ffw{fill:#e6f6ff;opacity:.9}
.fishA{fill:#ffd84a}.fishB{fill:#ff8f3a}
.ham{fill:#f6f2e6}
.lit{fill:#4a3624;opacity:.55}
.stars,.moon,.moonglow,.navlamp{opacity:0}
@media (prefers-color-scheme: dark){
  .sky0{stop-color:#040d1f}.sky1{stop-color:#0b2242}.sky2{stop-color:#173f63}.sky3{stop-color:#2a5a7a}
  .sea0{stop-color:#06223a}.sea1{stop-color:#0a3550}.sea2{stop-color:#0e4c5e}.sea3{stop-color:#156066}.sea4{stop-color:#1f7470}
  .halo0{stop-color:#3d8f88}.halo1{stop-color:#23706c}.halo2{stop-color:#156066}
  .sand0{stop-color:#b8ab8c}.sand1{stop-color:#9c8f72}.sand2{stop-color:#7c7058}
  .roof0{stop-color:#7a6040}.roof1{stop-color:#4f3b25}
  .cl0{stop-color:#5a7290}.cl1{stop-color:#2c4460}
  .col0{stop-color:#c4d6ff}
  .gcol{fill:#d6e3ff}.glit{opacity:.55}
  .sun,.sunglow{opacity:0}.moon,.stars,.moonglow,.navlamp{opacity:1}
  .far{fill:#16362f}.farsand{fill:#6b6350}
  .wall{fill:#5e4630}.wallshade{fill:#4a3624}.deck{fill:#47341f}
  .trunk{fill:#5a4630}.bark{fill:#4a3926}.sh{fill:#000}
  .fa{fill:#173f2a}.fb{fill:#1e4d33}.fc{fill:#123321}.rib{stroke:#0c2618}
  .bush{fill:#173f2a}.bush2{fill:#1e4d33}.leaf{stroke:#173f2a}.flw{fill:#8a4a5c}.flc{fill:#9c8a5a}
  .grass{stroke:#2d4d2a}.grain{fill:#4f4636}.shoal{fill:#2f7f7a}
  .crb{fill:#93442f}.crl{stroke:#6e3424}
  .foam{stroke:#9fc4cc}.wet{fill:#655d48}
  .wvs{opacity:.45}
  .glint{fill:#dfe9ff}
  .gull{stroke:#9fb7cc}
  .shade{fill:#010d14;opacity:.14}
  .tsk{fill:#20463b}.tsh{fill:#22381f}.tsl{fill:#2f4a28}.tsc{stroke:#132313}.teye{fill:#07120c}
  .mb{fill:#0f1f2c}.mm{fill:#6f8799;opacity:.4}
  .colm{opacity:.45}
  .rbase{fill:#03202b;opacity:.35}.kl{opacity:.16}.sg{stroke:#1c5a44}
  .k1{fill:#7a4f63}.k2{fill:#7d5a3c}.k3{fill:#5a4a7a}.k4{fill:#7d7040}.k5{fill:#2a6f69}.k6{fill:#70393c}
  .s1{stroke:#7a4f63}.s6{stroke:#70393c}
  .rf1{fill:#9a5a30}.rf2{fill:#2a5c9a}.rf3{fill:#9a8a3a}.rf4{fill:#9fb0bd}
  .fin{fill:#0c1c26}.dol{fill:#1c3447}.dolb{fill:#5f7f95}
  .ff{fill:#1f4666}.ffw{fill:#8fb2cc}
  .fishA{fill:#a8903c}.fishB{fill:#a8643a}
  .ham{fill:#8f8a7c}
  .lit{fill:#ffcf7a;opacity:.95}
  .fire{opacity:1}
  .reflit{opacity:.5}
  .haze{opacity:.2}
}
@keyframes drift{from{transform:translateX(0)}to{transform:translateX(-${W}px)}}
@keyframes wv{from{transform:translateX(0)}to{transform:translateX(var(--p))}}
@keyframes swell{0%,100%{transform:translateY(0)}50%{transform:translateY(2.5px)}}
@keyframes shimmer{0%,100%{opacity:.1}50%{opacity:.95}}
@keyframes sparkle{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1)}}
@keyframes sway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
@keyframes fly{from{transform:translate(-200px,0)}to{transform:translate(${W + 200}px,-60px)}}
@keyframes flap{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.4)}}
@keyframes twinkle{0%,100%{opacity:.3}50%{opacity:1}}
@keyframes shoot{0%,95%{opacity:0;transform:translate(0,0)}96%{opacity:1}100%{opacity:0;transform:translate(-300px,130px)}}
@keyframes hoistS{from{transform:scale(var(--s0))}to{transform:scale(var(--s1))}}
@keyframes hoistO{from{opacity:var(--o0)}to{opacity:var(--o1)}}
@keyframes hoistF{from{fill:var(--f0)}to{fill:var(--f1)}}
@keyframes hoistL{from{fill:var(--l0)}to{fill:var(--l1)}}
@keyframes hoistG{from{fill:var(--g0)}to{fill:var(--g1)}}
@keyframes flagwave{0%,100%{transform:skewY(-8deg)}50%{transform:skewY(8deg)}}
@keyframes turn{0%{transform:scaleX(-1)}50%{transform:scaleX(0)}100%{transform:scaleX(1)}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}
@keyframes lap{to{stroke-dashoffset:-240}}
@keyframes breathe{0%,100%{opacity:.75}50%{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes swimR{0%{transform:translateX(-260px)}40%,100%{transform:translateX(${W + 260}px)}}
@keyframes swimL{0%{transform:translateX(${W + 260}px)}40%,100%{transform:translateX(-260px)}}
@keyframes dipL{0%,16%{transform:translateY(var(--dip))}24%,100%{transform:translateY(0)}}
@keyframes dipR{0%,17%{transform:translateY(0)}24%,100%{transform:translateY(var(--dip))}}
@keyframes wander{0%,100%{transform:translateY(-6px)}50%{transform:translateY(6px)}}
@keyframes wig{0%,100%{transform:translateY(-2px)}50%{transform:translateY(2px)}}
@keyframes flipA{0%,100%{transform:rotate(-16deg)}50%{transform:rotate(14deg)}}
@keyframes flipB{0%,100%{transform:rotate(16deg)}50%{transform:rotate(-14deg)}}
@keyframes wingflap{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.68)}}
@keyframes leapX{0%,94%{transform:translateX(0)}100%{transform:translateX(90px)}}
@keyframes leapY{0%,94%{transform:translateY(40px);animation-timing-function:ease-out}97%{transform:translateY(-26px);animation-timing-function:ease-in}100%{transform:translateY(40px)}}
@keyframes leapR{0%,94%{transform:rotate(-48deg)}100%{transform:rotate(48deg)}}
@keyframes splashA{0%,94.3%{opacity:0;transform:scale(.3)}95%{opacity:.9;transform:scale(1)}97.5%,100%{opacity:0;transform:scale(1.8)}}
@keyframes splashB{0%{opacity:.5;transform:scale(1.4)}2%{opacity:0;transform:scale(1.9)}2.1%,98.6%{opacity:0;transform:scale(.3)}99.2%{opacity:.9;transform:scale(1)}100%{opacity:.5;transform:scale(1.4)}}
@keyframes pod{0%,33.2%{opacity:1}33.4%,100%{opacity:0}}
@keyframes ox{0%,100%{transform:translateX(calc(var(--r) * -1))}50%{transform:translateX(var(--r))}}
@keyframes oy{0%,100%{transform:translateY(0)}25%{transform:translateY(calc(var(--q) * -1))}75%{transform:translateY(var(--q))}}
@keyframes oy2{0%,100%{transform:translateY(calc(var(--q) * -1))}50%{transform:translateY(var(--q))}}
@keyframes oz{0%,100%{transform:scale(var(--z0))}50%{transform:scale(var(--z1))}}
@keyframes of{0%,100%{transform:scaleX(0)}1.5%,48.5%{transform:scaleX(1)}50%{transform:scaleX(0)}51.5%,98.5%{transform:scaleX(-1)}}
@keyframes ob{0%,50%,100%{transform:scaleX(1)}1.5%,48.5%,51.5%,98.5%{transform:scaleX(0)}}
@keyframes or{0%,50%,100%{transform:translateX(0)}1.5%,48.5%{transform:translateX(-20px)}51.5%,98.5%{transform:translateX(20px)}}
@keyframes turnb{0%,100%{transform:scaleX(0)}50%{transform:scaleX(1)}}
@keyframes wfade{0%,60%{transform:scaleX(1);opacity:1}100%{transform:scaleX(.2);opacity:0}}
@keyframes wflow{to{stroke-dashoffset:-19}}
@keyframes grass{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
@keyframes vhide{0%,99.9%{opacity:1}100%{opacity:0}}
@keyframes vshow{0%,99.9%{opacity:0}100%{opacity:1}}
@keyframes mhops{0%,70%{transform:translateY(0)}75%{transform:translateY(-2.6px)}80%{transform:translateY(0)}85%{transform:translateY(-2.6px)}90%,100%{transform:translateY(0)}}
@keyframes mstep{0%,100%{transform:translateY(0)}50%{transform:translateY(-.8px)}}
@keyframes mblink{0%,17%,19%,46%,48%,51%,53%,82%,84%,100%{transform:scaleY(1)}18%,47%,52%,83%{transform:scaleY(.12)}}
@keyframes mwave{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes mbreathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.05)}}
@keyframes mzz{0%{opacity:0;transform:translate(0,0)}25%{opacity:1}100%{opacity:0;transform:translate(5px,-9px)}}
@keyframes flick{0%,100%{transform:scale(1,1)}40%{transform:scale(.86,1.2)}70%{transform:scale(1.1,.88)}}
@keyframes blink{0%,60%,100%{opacity:.15}30%{opacity:1}}
@keyframes burst{0%{transform:scale(.05);opacity:1}70%{opacity:1}100%{transform:scale(1);opacity:0}}
@keyframes rise{0%{transform:translateY(420px);opacity:1}100%{transform:translateY(0);opacity:0}}
@keyframes fwr{0%,100%{opacity:0}25%{opacity:.45}}
@keyframes ffX{from{transform:translateX(0)}to{transform:translateX(440px)}}
@keyframes ffY{0%{transform:translateY(22px);animation-timing-function:ease-out}50%{transform:translateY(-46px);animation-timing-function:ease-in}100%{transform:translateY(22px)}}
@keyframes ffR{from{transform:rotate(-30deg)}to{transform:rotate(30deg)}}
@keyframes ffs{0%{opacity:0;transform:scale(.3)}15%{opacity:.8;transform:scale(1)}100%{opacity:0;transform:scale(1.9)}}
.drift{${loop('drift', 220, 'steps(1760)')}}
.drift2{${loop('drift', 340, 'steps(1700)')}}
.wv{${loop('wv', 24, 'linear')}}
.swell{${loop('swell', 6, 'ease-in-out')}}
.gcol>*{${loop('shimmer', 3.4, 'ease-in-out')}}
.spark{transform-box:fill-box;transform-origin:center;${loop('sparkle', 5, 'ease-in-out')}}
.palm{transform-box:view-box;${loop('sway', 7, 'ease-in-out')}}
.gulls{${loop('fly', 58, 'linear')}}
.wing{transform-box:fill-box;transform-origin:center;${loop('flap', 0.9, 'ease-in-out')}}
.star{${loop('twinkle', 4, 'ease-in-out')}}
.shoot{${loop('shoot', 46, 'linear')}}
.bx{animation:ox var(--u) ease-in-out calc(var(--b,0) * -1s) infinite}
.by{animation:oy var(--u) ease-in-out calc(var(--b,0) * -1s) infinite}
.bv{animation:oy2 var(--v) ease-in-out calc(var(--c,0) * -1s) infinite}
.bz{animation:oz var(--v) ease-in-out calc(var(--c,0) * -1s) infinite}
.bf{animation:of var(--u) linear calc(var(--b,0) * -1s) infinite}
.bw{animation:ob var(--u) linear calc(var(--b,0) * -1s) infinite}
.br{animation:or var(--u) linear calc(var(--b,0) * -1s) infinite}
.way,.cut{animation-duration:var(--e);animation-timing-function:linear;animation-delay:calc(var(--a,0) * -1s);animation-iteration-count:1;animation-fill-mode:both}
.cut{animation-timing-function:step-end}
.turn{animation:turn 1s linear calc(var(--a,0) * -1s) 1 both}
.turnb{animation:turnb 1s linear calc(var(--a,0) * -1s) 1 both}
.hS{transform-box:fill-box;transform-origin:right center;animation:hoistS ${HOIST}}
.hO{animation:hoistO ${HOIST}}
.hF{animation:hoistF ${HOIST}}
.hL{animation:hoistL ${HOIST}}
.hG{animation:hoistG ${HOIST}}
.fwave{transform-box:fill-box;transform-origin:right center;${loop('flagwave', 1.9, 'ease-in-out')}}
.wake{fill:none;stroke:#fff;stroke-width:1.6;stroke-linecap:round;opacity:.6;stroke-dasharray:14 5;animation:wflow .9s linear infinite}
.wk>g{transform-box:fill-box;transform-origin:right center}
.bf .wk>g{opacity:0}
.boat{${loop('bob', 3, 'ease-in-out')}}
.foamline{stroke-dasharray:60 60;${loop('lap', 9, 'linear')}}
.halo{${loop('breathe', 8, 'ease-in-out')}}
.raysA{${loop('spin', 400, 'steps(4000)')}}
.raysB{${loop('spin', 560, 'steps(5600)')};animation-direction:reverse}
.swR{${loop('swimR', 200, 'linear')}}
.swL{${loop('swimL', 200, 'linear')}}
.dipL{${loop('dipL', 200, 'ease-in-out')}}
.dipR{${loop('dipR', 200, 'ease-in-out')}}
.wander{${loop('wander', 11, 'ease-in-out')}}
.wig{${loop('wig', 1.3, 'ease-in-out')}}
.flipA{${loop('flipA', 2.6, 'ease-in-out')}}
.flipB{${loop('flipB', 2.6, 'ease-in-out')}}
.wingf{${loop('wingflap', 3.2, 'ease-in-out')}}
.lpX{${loop('leapX', LEAP_EVERY, 'linear')}}
.lpY{${loop('leapY', LEAP_EVERY, 'linear')}}
.lpR{${loop('leapR', LEAP_EVERY, 'linear')}}
.spA{transform-box:fill-box;transform-origin:center;${loop('splashA', LEAP_EVERY, 'linear')}}
.pod{${loop('pod', LEAP_EVERY * 3, 'linear')}}
.spB{transform-box:fill-box;transform-origin:center;${loop('splashB', LEAP_EVERY, 'linear')}}
.mstep{${loop('mstep', 0.5, 'ease-in-out')}}
.mblink{transform-box:fill-box;transform-origin:center;${loop('mblink', 11, 'linear')}}
.mwave{${loop('mwave', 0.45, 'ease-in-out')}}
.mbreathe{transform-box:fill-box;transform-origin:center bottom;${loop('mbreathe', 3.4, 'ease-in-out')}}
.mzz{opacity:0;${loop('mzz', 3.2, 'ease-out')}}
.flame{transform-box:fill-box;transform-origin:center bottom;${loop('flick', 0.7, 'ease-in-out')}}
.fire{opacity:0}
.mbob{${loop('mstep', 2.2, 'ease-in-out')}}
.grass{${loop('grass', 5, 'ease-in-out')}}
.working .gcol>*{animation-duration:1.7s}
.working .spark{animation-duration:2.4s}
.beacon{${loop('blink', 1.6, 'ease-in-out')}}
.lamp{${loop('twinkle', 3, 'ease-in-out')}}
.fw{transform-box:fill-box;transform-origin:center;opacity:0;animation:burst 1.8s ease-out 4}
.trail{opacity:0;animation:rise .7s ease-in 4}
.fwr{opacity:0;animation:fwr 1.8s ease-out 4}
.ffX{animation:ffX 3s linear 1 both}
.ffY{animation:ffY 1.5s linear 2 both}
.ffR{animation:ffR 1.5s linear 2 both}
.ffs{fill:none;stroke:#fff;stroke-width:1.6;opacity:0;transform-box:fill-box;transform-origin:center;animation:ffs .9s ease-out 1}
`

// The fleet's hulls and every boat's bow-on view are drawn once, in the
// defs, and placed with <use>; a crew boat's sail takes its colour from --s.
const CREW_HULL = `<path d="M-26 0H30Q25 9 17 10H-17Q-23 9 -26 0Z" fill="#f6f1e6"/><path d="M-24.5 3.5H27.5" stroke="var(--s)" stroke-width="2.4"/>
<line x1="-3" y1="0" x2="-3" y2="-57" stroke="#5a3b22" stroke-width="1.8"/>
<path d="M-1 -56Q23 -34 27 -5H-1Z" fill="var(--s)"/><path d="M-1 -33Q12 -30 21 -22L24 -14Q12 -22 -1 -24Z" fill="#fff" opacity=".6"/>`
// A fishing boat's lantern is lit, and glows, only after dark.
const SHELL_HULL = `<g transform="scale(-1 1)"><path d="M-30 0Q-34 -10 -42 -17Q-30 -9 -22 -7H22Q30 -7 40 -15Q35 0 26 8H-22Q-28 6 -30 0Z" fill="#5a4632"/><path d="M-27 -1H31" stroke="#e8dcc0" stroke-width="1.6"/>
<rect x="-12" y="-17" width="20" height="10" rx="2" fill="#e8dcc0"/><line x1="16" y1="-7" x2="16" y2="-32" stroke="#3d2f20" stroke-width="2"/>
<g class="navlamp"><circle class="lamp" cx="16" cy="-36" r="13" fill="#ffd76a" opacity=".35"/></g><circle class="lit" cx="16" cy="-36" r="4.6"/></g>`
// Seen bow on, as it comes about: a short deep hull, the mast upright, and
// the sails edge on.
const LEAD_BOW = `<path d="M-12 0H12Q11 10 0 13Q-11 10 -12 0Z" fill="#7a4f2c"/><path d="M-11.4 3.5H11.4" stroke="#f4e3c1" stroke-width="1.6"/>
<line x1="0" y1="0" x2="0" y2="-88" stroke="#5a3b22" stroke-width="2"/><path d="M-1 -72Q-9 -38 -6 -6H-1Z" fill="#fdfdf8"/><path d="M1 -60Q8 -32 6 -6H1Z" fill="#f2c14e"/>`
const CREW_BOW = `<path d="M-8 0H8Q7 8 0 10Q-7 8 -8 0Z" fill="#f6f1e6"/><path d="M-7.6 3.5H7.6" stroke="var(--s)" stroke-width="2.4"/>
<line x1="0" y1="0" x2="0" y2="-57" stroke="#5a3b22" stroke-width="1.8"/><path d="M1 -56Q8 -30 6 -5H1Z" fill="var(--s)"/>`
const SHELL_BOW = `<path d="M-10 -7H10Q9 4 0 8Q-9 4 -10 -7Z" fill="#5a4632"/><rect x="-7" y="-17" width="14" height="10" rx="2" fill="#e8dcc0"/>
<line x1="0" y1="-17" x2="0" y2="-32" stroke="#3d2f20" stroke-width="2"/><g class="navlamp"><circle class="lamp" cx="0" cy="-36" r="13" fill="#ffd76a" opacity=".35"/></g><circle class="lit" cx="0" cy="-36" r="4.6"/>`
// A palm's crown at full size about the top of its trunk: fronds feathered
// into leaflets that sweep towards each tip, and its coconuts. Every palm
// draws a scaled clone of it.
const CROWN = (() => {
  const fronds: [number, number, string][] = [
    [-150, 30, 'fa'], [-120, -40, 'fb'], [-50, -90, 'fa'], [20, -100, 'fb'], [100, -60, 'fa'], [150, 10, 'fb'], [80, 60, 'fc'], [-90, 70, 'fc'],
  ]
  const leaves = fronds
    .map(([ex, ey, cls]) => {
      const droop = 34
      const mx = ex * 0.5
      const my = ey * 0.5 - droop
      const wd = Math.hypot(ex, ey) * 0.17
      const at = (t: number): { x: number; y: number; nx: number; ny: number } => {
        const dx = 2 * (1 - t) * mx + 2 * t * (ex - mx)
        const dy = 2 * (1 - t) * my + 2 * t * (ey - my)
        const d = Math.hypot(dx, dy) || 1
        return { x: 2 * (1 - t) * t * mx + t * t * ex, y: 2 * (1 - t) * t * my + t * t * ey, nx: -dy / d, ny: dx / d }
      }
      const pt = (t: number, side: number, w: number): string => {
        const p = at(Math.min(1, t))
        const width = wd * Math.sin(Math.PI * Math.min(1, t)) ** 0.6 * w * side
        return `${Math.round(p.x + p.nx * width)} ${Math.round(p.y + p.ny * width)}`
      }
      const steps = Array.from({ length: 12 }, (_, i) => (i + 0.5) / 13)
      const upper = steps.map(t => `L${pt(t, 1, 0.45)}L${pt(t + 0.1, 1, 1.1)}`).join('')
      const lower = [...steps].reverse().map(t => `L${pt(t + 0.1, -1, 0.9)}L${pt(t, -1, 0.4)}`).join('')
      return `<path d="M0 0${upper}L${ex} ${ey}${lower}Z" class="${cls}"/><path d="M0 0Q${f(mx)} ${f(my + droop * 0.15)} ${ex} ${ey}" fill="none" class="rib" stroke-width="1.3"/>`
    })
    .join('')
  return `<g id="crown">${leaves}<circle cx="-6" cy="8" r="7" fill="#6b4c2f"/><circle cx="7" cy="9" r="7" fill="#5c4027"/><circle cx="0" cy="14" r="6" fill="#6b4c2f"/></g>`
})()

// A leafy shrub standing on (0, 0), in flower.
const SHRUB = `<g id="shrub"><ellipse cy="1" rx="31" ry="4" class="sh"/><g class="bush"><circle cx="-18" cy="-10" r="13"/><circle cx="0" cy="-17" r="16"/><circle cx="17" cy="-10" r="12"/><circle cx="8" cy="-4" r="10"/><circle cx="-8" cy="-4" r="10"/></g>
<g class="bush2"><circle cx="-15" cy="-15" r="8"/><circle cx="1" cy="-24" r="9"/><circle cx="15" cy="-14" r="6"/></g><path class="leaf" d="M-29 -9l-5 -2M-24 -20l-4 -4M-9 -32l-1 -5M7 -33l3 -4M23 -19l5 -3M29 -6l5 0"/>
<g class="flw"><circle cx="-12" cy="-9" r="2.6"/><circle cx="9" cy="-22" r="2.4"/><circle cx="19" cy="-6" r="2.2"/><circle cx="-3" cy="-1" r="2"/></g><g class="flc"><circle cx="-12" cy="-9" r=".9"/><circle cx="9" cy="-22" r=".9"/><circle cx="19" cy="-6" r=".8"/><circle cx="-3" cy="-1" r=".7"/></g></g>`

// A tuft of beach grass rooted at (0, 0).
const TUFT = '<path id="tuft" class="grass" d="M0 0q-3 -7 -9 -10M0 0q-1 -9 -3 -15M0 0q1 -8 4 -14M0 0q3 -6 9 -8"/>'

// Each dinghy and fishing boat is a clone of these, its shadow on the water
// drawn with its hull, and its wake apart, for a wake only shows under way.
const BOAT_DEFS = `<g id="cH"><ellipse cx="0" cy="13" rx="27" ry="2.6" fill="#000" opacity=".12"/>${CREW_HULL}</g><g id="sH"><ellipse cx="0" cy="9" rx="36" ry="3" fill="#000" opacity=".14"/>${SHELL_HULL}</g><path id="cW" class="wake" d="M-28 7q-12 0 -26 4M-25 11q-9 2 -19 6"/><path id="sW" class="wake" d="M-40 4q-16 0 -34 5M-36 9q-12 2 -26 8"/><g id="lB">${LEAD_BOW}</g><g id="cB">${CREW_BOW}</g><g id="sB">${SHELL_BOW}</g>`

const DEFS = `<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="sky0"/><stop offset=".5" class="sky1"/><stop offset=".85" class="sky2"/><stop offset="1" class="sky3"/></linearGradient>
<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="sea0"/><stop offset=".18" class="sea1"/><stop offset=".45" class="sea2"/><stop offset=".75" class="sea3"/><stop offset="1" class="sea4"/></linearGradient>
<radialGradient id="halo"><stop offset="0" class="halo0"/><stop offset=".45" class="halo1" stop-opacity=".95"/><stop offset=".8" class="halo2" stop-opacity=".45"/><stop offset="1" class="halo2" stop-opacity="0"/></radialGradient>
<radialGradient id="sand" cx=".5" cy=".4" r=".6"><stop offset="0" class="sand0"/><stop offset=".7" class="sand1"/><stop offset="1" class="sand2"/></radialGradient>
<linearGradient id="roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="roof0"/><stop offset="1" class="roof1"/></linearGradient>
<linearGradient id="cloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="cl0"/><stop offset="1" class="cl1"/></linearGradient>
<radialGradient id="sund"><stop offset="0" class="sund0"/><stop offset=".72" class="sund0"/><stop offset="1" class="sund1"/></radialGradient>
<radialGradient id="bloom"><stop offset="0" class="glow0" stop-opacity=".5"/><stop offset=".08" class="glow0" stop-opacity=".36"/><stop offset=".18" class="glow0" stop-opacity=".2"/><stop offset=".32" class="glow0" stop-opacity=".1"/><stop offset=".5" class="glow0" stop-opacity=".05"/><stop offset=".72" class="glow0" stop-opacity=".02"/><stop offset="1" class="glow0" stop-opacity="0"/></radialGradient>
<radialGradient id="corona"><stop offset="0" stop-color="#fffdf0" stop-opacity=".8"/><stop offset=".3" stop-color="#fffdf0" stop-opacity=".5"/><stop offset=".5" stop-color="#fffdf0" stop-opacity=".18"/><stop offset=".75" stop-color="#fffdf0" stop-opacity=".05"/><stop offset="1" stop-color="#fffdf0" stop-opacity="0"/></radialGradient>
<radialGradient id="ray" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="660"><stop offset="0" stop-color="#fff8dc" stop-opacity="0"/><stop offset=".1" stop-color="#fff8dc" stop-opacity=".3"/><stop offset=".4" stop-color="#fff8dc" stop-opacity=".09"/><stop offset="1" stop-color="#fff8dc" stop-opacity="0"/></radialGradient>
<radialGradient id="moonglow"><stop offset="0" stop-color="#dfe9ff" stop-opacity=".5"/><stop offset=".3" stop-color="#dfe9ff" stop-opacity=".16"/><stop offset="1" stop-color="#dfe9ff" stop-opacity="0"/></radialGradient>
<linearGradient id="column" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="col0" stop-opacity=".38"/><stop offset=".5" class="col0" stop-opacity=".13"/><stop offset="1" class="col0" stop-opacity="0"/></linearGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#ffffff" stop-opacity=".35"/></linearGradient>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
<filter id="blur6" x="-30%" y="-10%" width="160%" height="120%"><feGaussianBlur stdDeviation="9"/></filter>
<clipPath id="surf"><rect x="-300" y="-400" width="1000" height="400"/></clipPath>
<clipPath id="hung"><path clip-rule="evenodd" d="M-2000 -2000H4000V3000H-2000ZM${ISLE - 75} 610Q${ISLE - 24} 668 ${ISLE + 23} 616L${ISLE + 23} 622Q${ISLE - 24} 690 ${ISLE - 75} 616Z"/></clipPath>
${BOAT_DEFS}${CROWN}${SHRUB}${TUFT}
<pattern id="grain" width="19" height="13" patternUnits="userSpaceOnUse"><g class="grain"><circle cx="3" cy="4" r=".7"/><circle cx="12" cy="9" r=".6"/><circle cx="16" cy="2" r=".5"/></g></pattern>
<mask id="crescent"><rect x="-60" y="-60" width="120" height="120" fill="#fff"/><circle cx="21" cy="-12" r="41" fill="#000"/></mask>
</defs>`

// Sun rays: thin wedges fading outward, in the sun's own coordinates.
function rays(count: number, salt: number, width: number): string {
  let d = ''
  for (let k = 0; k < count; k++) {
    const a = ((k + rnd(k, salt) * 0.7) / count) * Math.PI * 2
    const half = ((0.5 + rnd(k, salt + 1) * 1.6) * width * Math.PI) / 180
    const len = 300 + rnd(k, salt + 2) * 340
    d += `M0 0L${f(Math.cos(a - half) * len)} ${f(Math.sin(a - half) * len)}L${f(Math.cos(a + half) * len)} ${f(Math.sin(a + half) * len)}Z`
  }
  return `<path d="${d}" fill="url(#ray)"/>`
}

// The light path on the water: glints packed near the horizon, spreading out
// toward the viewer.
function glitter(): string {
  let out = ''
  for (let i = 0; i < 64; i++) {
    const v = Math.pow(rnd(i, 1), 1.5)
    const y = HORIZON + 5 + v * 400
    const half = 22 + (y - HORIZON) * 0.4
    const x = SUN_X + (rnd(i, 2) + rnd(i, 3) - 1) * half
    const rx = (4 + rnd(i, 4) * 12) * (0.55 + v * 1.5)
    out += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(0.9 + v * 2)}" style="--d:${f(rnd(i, 5) * 3.4)}"/>`
  }
  return out
}

// One row of wave crests. A tile holds three uneven crests, a pattern repeats
// it along the row, and the row slides by exactly one tile, so the loop has
// no seam.
function waveRow(i: number, y: number, period: number, amp: number, alpha: number, speed: number): string {
  const starts = [0.04 + rnd(i, 3) * 0.06, 0.38 + rnd(i, 4) * 0.08, 0.68 + rnd(i, 5) * 0.06]
  const sizes = [0.2 + rnd(i, 6) * 0.1, 0.13 + rnd(i, 7) * 0.08, 0.16 + rnd(i, 8) * 0.07]
  const top = Math.ceil(amp) + 1
  let d = ''
  for (let k = 0; k < 3; k++) {
    const w = 2 * Math.round((sizes[k]! * period) / 2)
    const a = amp * (1 - k * 0.18)
    d += `M${Math.round(starts[k]! * period)} ${top}q${w / 2} ${f(-a)} ${w} 0q${-w / 2} ${f(-a * 0.15)} ${-w} 0Z`
  }
  return `<pattern id="wr${i}" width="${period}" height="${top + 1}" y="${y - top}" patternUnits="userSpaceOnUse"><path class="crest" d="${d}"/></pattern><g class="wv" style="--p:${-period}px;animation-duration:${f(period / speed)}s;--d:${i * 7}"><rect class="swell" style="--d:${f(i * 1.3)}" opacity="${alpha}" fill="url(#wr${i})" x="${-period}" y="${y - top}" width="${W + 2 * period}" height="${top + 1}"/></g>`
}

function waves(): string {
  const rows: [number, number, number, number, number][] = [
    [22, 150, 2.6, 0.3, 5],
    [44, 180, 3, 0.33, 7],
    [72, 230, 3.6, 0.36, 9],
    [108, 290, 4.4, 0.4, 12],
    [152, 360, 5.4, 0.42, 15],
    [206, 440, 6.6, 0.45, 19],
    [272, 530, 8, 0.45, 24],
    [352, 630, 9.5, 0.42, 30],
    [448, 740, 11, 0.38, 37],
  ]
  return rows.map(([dy, period, amp, alpha, speed], i) => waveRow(i, HORIZON + dy, period, amp, alpha, speed)).join('')
}

function cloud(x: number, y: number, s: number): string {
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="url(#cloud)" filter="url(#soft)" opacity=".92">
<ellipse cx="0" cy="0" rx="110" ry="24"/><ellipse cx="-48" cy="-14" rx="52" ry="30"/>
<ellipse cx="22" cy="-26" rx="64" ry="42"/><ellipse cx="86" cy="-8" rx="46" ry="26"/><ellipse cx="-96" cy="-2" rx="34" ry="16"/></g>`
}

function stars(): string {
  const pts: [number, number][] = [
    [120, 60], [260, 140], [410, 50], [560, 170], [700, 80], [860, 40], [980, 150],
    [1120, 70], [1300, 120], [1460, 60], [1540, 190], [340, 260], [760, 240], [1200, 250],
    [60, 300], [620, 320], [1000, 330], [1400, 300], [480, 110], [900, 250], [1380, 210], [200, 220],
  ]
  return `<g class="stars">${pts
    .map(([x, y], i) => `<circle class="star" cx="${x}" cy="${y}" r="${f(1.1 + (i % 3) * 0.6)}" fill="#fff" style="--d:${f((i * 0.37) % 4)}"/>`)
    .join('')}<g transform="translate(760 90)"><path class="shoot" d="M0 0l46 -20" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0"/></g></g>`
}

function farIsland(x: number, w: number): string {
  const y = HORIZON
  let palms = ''
  for (let i = 0; i < 3; i++) {
    const px = x - w * 0.3 + i * w * 0.3
    palms += `<path d="M${px} ${y - 6} q2 -10 4 -18" stroke="#3f6f5a" stroke-width="1.6" fill="none"/><path d="M${px + 4} ${y - 24} q-8 0 -12 5 M${px + 4} ${y - 24} q8 -1 12 5 M${px + 4} ${y - 24} q-2 -6 -8 -8" stroke="#3f8f7a" stroke-width="2" fill="none"/>`
  }
  return `<g opacity=".8"><ellipse cx="${x}" cy="${y + 1}" rx="${w * 0.62}" ry="4" class="farsand"/>
<path d="M${x - w / 2} ${y} q${w / 2} -22 ${w} 0 Z" class="far"/>${palms}</g>`
}

// Coral pieces, each standing on the point it is given.
function dome(cx: number, cy: number, r: number, cls: string): string {
  return `<path class="${cls}" d="M${cx - r} ${cy}A${r} ${f(r * 0.85)} 0 0 1 ${cx + r} ${cy}Q${cx} ${f(cy + r * 0.25)} ${cx - r} ${cy}Z"/>
<path class="kl" stroke-width="1.4" d="M${f(cx - r * 0.62)} ${f(cy - r * 0.18)}A${f(r * 0.62)} ${f(r * 0.5)} 0 0 1 ${f(cx + r * 0.62)} ${f(cy - r * 0.18)}M${f(cx - r * 0.3)} ${f(cy - r * 0.05)}A${f(r * 0.3)} ${f(r * 0.28)} 0 0 1 ${f(cx + r * 0.3)} ${f(cy - r * 0.05)}"/>`
}

function branch(cx: number, cy: number, h: number, cls: string): string {
  const p = (dx: number, dy: number) => `${f(cx + dx * h)} ${f(cy - dy * h)}`
  return `<path class="${cls}" stroke-width="${f(h * 0.11)}" stroke-linecap="round" d="M${p(0, 0)}L${p(0, 0.45)}M${p(0, 0.4)}Q${p(-0.1, 0.75)} ${p(-0.28, 1)}M${p(0, 0.4)}Q${p(0.12, 0.7)} ${p(0.3, 0.92)}M${p(-0.07, 0.62)}Q${p(-0.3, 0.66)} ${p(-0.42, 0.8)}M${p(0.1, 0.6)}Q${p(0.32, 0.58)} ${p(0.46, 0.7)}M${p(0, 0.2)}Q${p(0.2, 0.3)} ${p(0.3, 0.45)}M${p(0, 0.25)}Q${p(-0.2, 0.32)} ${p(-0.3, 0.5)}"/>`
}

function fan(cx: number, cy: number, r: number, cls: string): string {
  const p = (dx: number, dy: number) => `${f(cx + dx * r)} ${f(cy - dy * r)}`
  return `<path class="${cls}" opacity=".88" d="M${p(0, 0)}C${p(-0.9, 0.3)} ${p(-0.8, 1.15)} ${p(0, 1.2)}C${p(0.8, 1.15)} ${p(0.9, 0.3)} ${p(0, 0)}Z"/>
<path class="kl" stroke-width="1.2" d="M${p(0, 0)}L${p(0, 1.1)}M${p(0, 0)}L${p(-0.42, 0.98)}M${p(0, 0)}L${p(0.42, 0.98)}M${p(0, 0)}L${p(-0.66, 0.62)}M${p(0, 0)}L${p(0.66, 0.62)}"/>`
}

function table(cx: number, cy: number, w: number, cls: string): string {
  return `<path class="${cls}" d="M${f(cx - w * 0.12)} ${f(cy + w * 0.34)}L${f(cx - w * 0.22)} ${cy}H${f(cx + w * 0.22)}L${f(cx + w * 0.12)} ${f(cy + w * 0.34)}Z"/>
<ellipse class="${cls}" cx="${cx}" cy="${cy}" rx="${w}" ry="${f(w * 0.2)}"/><ellipse cx="${cx}" cy="${f(cy - w * 0.04)}" rx="${f(w * 0.78)}" ry="${f(w * 0.1)}" fill="#fff" opacity=".22"/>`
}

function tubes(cx: number, cy: number, cls: string): string {
  return `<g class="${cls}"><rect x="${cx - 11}" y="${cy - 22}" width="8" height="24" rx="4"/><rect x="${cx - 2}" y="${cy - 30}" width="9" height="32" rx="4.5"/><rect x="${cx + 8}" y="${cy - 18}" width="7" height="20" rx="3.5"/></g>
<g fill="#000" opacity=".25"><ellipse cx="${cx - 7}" cy="${cy - 21}" rx="2.6" ry="1.3"/><ellipse cx="${cx + 2.5}" cy="${cy - 29}" rx="3" ry="1.5"/><ellipse cx="${cx + 11.5}" cy="${cy - 17}" rx="2.3" ry="1.2"/></g>`
}

function seagrass(cx: number, cy: number, h: number, phase: number): string {
  return `<g class="grass" style="transform-origin:${cx}px ${cy}px;--d:${phase}"><path class="sg" stroke-width="3" stroke-linecap="round" d="M${cx} ${cy}q-6 ${f(-h * 0.5)} 2 ${-h}M${cx + 5} ${cy}q8 ${f(-h * 0.4)} 2 ${f(-h * 0.8)}M${cx - 5} ${cy}q-10 ${f(-h * 0.4)} -6 ${f(-h * 0.7)}"/></g>`
}

// A coral head seen through the shallows, with small fish that keep circling
// it: three behind the front corals, four in front.
function coralReef(x: number, y: number, s: number, isMirrored: boolean, salt: number): string {
  const fish = (i: number, cx: number, cy: number, range: number, rise: number, cls: string, size: number): string =>
    `<g transform="translate(${cx} ${cy})" style="--r:${range}px;--q:${rise}px;--u:${f(7 + rnd(i, salt) * 6)}s;--d:${f(rnd(i, salt + 1) * 13)}"><g class="ox"><g class="oy"><g class="of"><path class="${cls}" transform="scale(${size})" d="M6 0Q1 -4 -5 0Q1 4 6 0ZM-4 0l-5 -3.5v7Z"/></g></g></g></g>`
  return `<g transform="translate(${x} ${y}) scale(${isMirrored ? -s : s} ${s})" opacity=".94">
<ellipse class="rbase" cx="0" cy="12" rx="132" ry="24"/>
${fan(-54, 2, 36, 'k3')}${table(50, -8, 40, 'k5')}${branch(6, 0, 54, 's1')}
${fish(0, -10, -34, 46, 7, 'rf2', 1)}${fish(1, 40, -40, 34, 6, 'rf3', 0.9)}${fish(2, -60, -48, 28, 5, 'rf1', 0.8)}
${dome(-88, 14, 25, 'k2')}${dome(80, 16, 21, 'k1')}${branch(-22, 16, 34, 's6')}${tubes(36, 18, 'k4')}${dome(8, 22, 13, 'k5')}
${seagrass(-116, 16, 30, 1)}${seagrass(108, 18, 26, 2.4)}
${fish(3, -30, -4, 60, 8, 'rf1', 1.1)}${fish(4, 30, 4, 52, 6, 'rf4', 1)}${fish(5, 0, -18, 70, 10, 'rf3', 0.9)}${fish(6, -70, 0, 30, 5, 'rf2', 0.9)}
</g>`
}

// A water villa standing on the boardwalk: its deck is level with the walk,
// a strip of veranda with a rail on the left, and a ladder down into the sea
// at the right. `x` is its middle and `y` the top of the walk.
function bungalow(x: number, y: number, s: number): string {
  let strands = ''
  for (let i = -5; i <= 5; i++) {
    strands += `M0 -80L${i * 12} -32`
  }
  return `<g transform="translate(${x} ${y}) scale(${s})">
<path class="post" stroke-width="4" d="M-67 6v24M-24 6v26M24 6v26M67 6v24"/>
<rect x="-72" width="144" height="7" rx="1.5" class="deck"/>
<path class="post" stroke-width="1.6" fill="none" d="M-72 0v-13h24v13M-60 -13v13"/>
<rect x="-46" y="-38" width="92" height="38" class="wall"/><rect x="18" y="-38" width="28" height="38" class="wallshade"/>
<rect x="-34" y="-29" width="22" height="16" rx="2" class="lit"/><rect x="-4" y="-31" width="16" height="31" rx="2" class="lit"/>
<path d="M-70 -34L0 -84L70 -34Q0 -26 -70 -34Z" fill="url(#roof)"/><path d="${strands}" fill="none" stroke="#8a6234" opacity=".45"/>
<path class="post" stroke-width="2" d="M48 3v38M60 3v38M48 13h12M48 23h12M48 33h12"/>
</g>`
}

// A palm rooted at (x, y), `s` times the crown's size, its top `lean` to the
// side; `flip` mirrors its crown so no two palms look alike.
function palm(x: number, y: number, s: number, lean: number, phase: number, flip = false): string {
  const tx = x + lean * s
  const ty = y - 190 * s
  let rings = ''
  for (let i = 1; i < 9; i++) {
    const t = i / 9
    const rx = x + lean * s * t * t
    const ry = y - 190 * s * t
    rings += `M${f(rx - 7 * s)} ${f(ry)}L${f(rx + 7 * s)} ${f(ry + 3 * s)}`
  }
  const bend = x + lean * s * 0.2
  return `<ellipse cx="${x + 4}" cy="${y + 2}" rx="${f(18 * s)}" ry="3" class="sh"/><g class="palm" style="transform-origin:${x}px ${y}px;--d:${phase}">
<path d="M${f(x - 9 * s)} ${y}Q${f(bend)} ${f(y - 100 * s)} ${f(tx - 5 * s)} ${f(ty)}L${f(tx + 5 * s)} ${f(ty)}Q${f(bend + 14 * s)} ${f(y - 100 * s)} ${f(x + 9 * s)} ${y}Z" class="trunk"/><path d="M${f(x + 3 * s)} ${y}Q${f(bend + 9 * s)} ${f(y - 100 * s)} ${f(tx + 2 * s)} ${f(ty)}L${f(tx + 5 * s)} ${f(ty)}Q${f(bend + 14 * s)} ${f(y - 100 * s)} ${f(x + 9 * s)} ${y}Z" class="bark"/><path d="${rings}" class="ring" stroke-width="${f(1.4 * s)}"/>
<use href="#crown" transform="translate(${f(tx)} ${f(ty)}) scale(${flip ? -s : s} ${s})"/></g>`
}

// Where tufts grow: along the back of the sand, where they stand against the
// water behind, and about the shrubs.
const TUFTS: [number, number, number][] = [
  [1232, 676, 0.8], [1256, 667, 1], [1338, 656, 0.9], [1352, 655, 0.7], [1488, 653, 1], [1503, 652, 0.75], [1626, 651, 0.9], [1306, 705, 0.8], [1476, 702, 0.7],
]

function sparkles(): string {
  let out = ''
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(rnd(i, 11) * W)
    const y = HORIZON + 30 + Math.floor(rnd(i, 12) * (H - HORIZON - 60))
    const r = 2 + (i % 3)
    out += `<path class="spark glint" d="M${x} ${y - r * 2} L${x + r * 0.5} ${y} L${x} ${y + r * 2} L${x - r * 0.5} ${y} Z M${x - r * 2} ${y} L${x} ${y + r * 0.5} L${x + r * 2} ${y} L${x} ${y - r * 0.5} Z" style="--d:${f(rnd(i, 13) * 5)}"/>`
  }
  return out
}

// The three kinds of boat, each drawn heading right around the middle of its
// waterline: the main agent's two-sailed lead boat, a subagent's dinghy under one
// bright sail, and a fishing boat with its lamp lit for a background shell.
const FLAG_TINT: Record<Signal, string> = { none: '#1d4f91', permission: '#ff8f1f', question: '#8b6cff', plan: '#ff5fa8', error: '#e5352b' }
const LAMP_TINT: Record<Signal, string> = { ...FLAG_TINT, none: '#ffe9a6' }

// The lead boat carries the mascot while the agent works, and tells the person
// the agent needs them: its pennant, which streams aft in the wind of the
// boat's way, grows into a flag in the signal's colour
// and a patch of that colour spreads on the water under it; by night its
// masthead lamp takes the colour too. One signal gives way to the next over
// HOIST_S. The attributes hold the settled look, and the animations run from
// the look before it.
function leadBoat(flag: Flag, wake = ''): string {
  const { from, to } = flag
  const size = (signal: Signal): number => (signal === 'none' ? 1 : 2.6)
  const shown = (signal: Signal): number => (signal === 'none' ? 0 : 1)
  // The patch on the water keeps the signal's colour while it fades in or out.
  const patch = (signal: Signal, other: Signal): string => FLAG_TINT[signal === 'none' ? other : signal]
  const vars = [
    `--h:${f(Math.min(flag.age, HOIST_S))}`,
    `--f0:${FLAG_TINT[from]};--f1:${FLAG_TINT[to]}`,
    `--l0:${LAMP_TINT[from]};--l1:${LAMP_TINT[to]}`,
    `--g0:${patch(from, to)};--g1:${patch(to, from)}`,
    `--s0:${size(from)};--s1:${size(to)}`,
    `--o0:${shown(from)};--o1:${shown(to)}`,
  ].join(';')
  const glow = [[84, 17, 0.13], [60, 12, 0.16], [38, 8, 0.2]]
    .map(([rx, ry, alpha]) => `<ellipse class="hG" cx="0" cy="10" rx="${rx}" ry="${ry}" fill="${patch(to, from)}" opacity="${alpha}"/>`)
    .join('')
  return `<g style="${vars}"><g class="hO" opacity="${shown(to)}">${glow}</g>
<ellipse cx="0" cy="16" rx="34" ry="3" fill="#000" opacity=".12"/><g class="wk"><g ${wake}><path class="wake" d="M-38 8q-16 0 -34 5M-34 13q-12 2 -26 8"/></g></g>
<path d="M-36 0L36 0Q30 12 22 13L-22 13Q-30 12 -36 0Z" fill="#7a4f2c"/><path d="M-34 3.5H34" stroke="#f4e3c1" stroke-width="1.6"/>
<line x1="0" y1="0" x2="0" y2="-88" stroke="#5a3b22" stroke-width="2"/>
<path d="M-2 -72Q-30 -36 -38 -6L-2 -6Z" fill="#fdfdf8"/><path d="M2 -60Q22 -32 30 -6L2 -6Z" fill="#f2c14e"/>
<g class="fwave"><g class="hS" transform="translate(-1 -82) scale(${size(to)}) translate(1 82)"><path class="hF" d="M-1 -87H-16L-12 -82L-16 -77H-1Z" fill="${FLAG_TINT[to]}"/></g></g>
<g class="navlamp"><g class="hO" opacity="${shown(to)}"><g class="beacon"><circle class="hL" cx="0" cy="-91" r="17" fill="${LAMP_TINT[to]}" opacity=".4"/></g></g>
<circle class="hL" cx="0" cy="-91" r="9" fill="${LAMP_TINT[to]}" opacity=".3"/><circle class="hL" cx="0" cy="-91" r="4.4" fill="${LAMP_TINT[to]}"/></g></g>`
}

const CREW_SAILS = ['#ef6f5e', '#2bb8a6', '#8b7bff', '#ff9f43', '#3d9be9']

function crewBoat(sail: string, wake: string): string {
  return `<g class="wk"><g ${wake}><use href="#cW"/></g></g><use href="#cH" style="--s:${sail}"/>`
}

const shellBoat = (wake: string): string => `<g class="wk"><g ${wake}><use href="#sW"/></g></g><use href="#sH"/>`

function sailOf(boat: Boat): string {
  return CREW_SAILS[boat.slot % CREW_SAILS.length] ?? '#ef6f5e'
}

// A boat of `boat`'s kind seen bow on, at the scale of its route; `turning`
// holds the attributes that widen it as the boat comes about.
function bowOf(boat: Boat, scale: number, turning: string): string {
  const view = boat.kind === 'lead' ? '#lB' : boat.kind === 'crew' ? `#cB" style="--s:${sailOf(boat)}` : '#sB'
  return `<g ${turning}><g transform="scale(${scale})"><g class="boat"><use href="${view}"/></g></g></g>`
}

// The mascot at the stern of the lead boat, at the scale of its route. It is
// not turned with the boat: as the boat comes about it keeps facing out and
// the deck swings round under it (`shift` holds the attributes that move it
// from one end of the deck to the other). `captain` holds the attributes that
// time its coming aboard or going ashore.
function crewOf(flag: Flag, scale: number, captain: string, shift: string): string {
  return `<g transform="scale(${scale})"><g class="boat"><g ${captain}><g ${shift}><g transform="scale(1.7)">${rider(flag)}</g></g></g></g></g>`
}

// A boat of `boat`'s kind. `wake` holds the attributes of its wake: out on a
// circuit the wake is hidden unless they say otherwise.
function hullOf(boat: Boat, flag: Flag, wake = ''): string {
  return boat.kind === 'lead' ? leadBoat(flag, wake) : boat.kind === 'crew' ? crewBoat(sailOf(boat), wake) : shellBoat(wake)
}

// The times across `span` at which a boat's way in or out is keyed. The way
// is sampled densely, then thinned to the fewest keys that keep every sample
// within `tolerance` of the straight runs between them. Each scene keys a way
// alike, so a redraw takes a boat up where the scene before left it, and a
// straight stretch costs two keys however long it is.
const KEY_STEP_S = 0.1
function keyTimes(span: number, valuesAt: (at: number) => readonly number[], tolerance: number): number[] {
  const count = Math.max(1, Math.ceil(span / KEY_STEP_S))
  const times = Array.from({ length: count + 1 }, (_, i) => (i / count) * span)
  const values = times.map(valuesAt)
  const kept = [0, count]
  const thin = (a: number, b: number): void => {
    const [from, to] = [values[a] ?? [], values[b] ?? []]
    let worst = tolerance
    let at = -1
    for (let i = a + 1; i < b; i++) {
      const s = (i - a) / (b - a)
      const off = Math.max(0, ...(values[i] ?? []).map((v, d) => Math.abs(v - ((from[d] ?? 0) + ((to[d] ?? 0) - (from[d] ?? 0)) * s))))
      if (off > worst) {
        worst = off
        at = i
      }
    }
    if (at >= 0) {
      kept.push(at)
      thin(a, at)
      thin(at, b)
    }
  }
  thin(0, count)
  return kept.sort((x, y) => x - y).map(i => times[i] ?? 0)
}

// How far keys may stray from a boat's way, in px: further in a plain scene,
// which must stay small.
function toleranceFor(isPlain: boolean): number {
  return isPlain ? 2.5 : 1
}

// How clearly a boat shows through the haze over the horizon at height `y`.
function clearAt(y: number): number {
  return Math.max(0, Math.min(1, (y - HORIZON_Y - 4) / 36))
}

// Keyframes that carry a group through `stops`, each `p` of the way through.
function keyframes(name: string, stops: readonly { p: number; x: number; y: number }[]): string {
  return `@keyframes ${name}{${stops.map(s => `${f(s.p * 100)}%{transform:translate(${Math.round(s.x)}px,${Math.round(s.y)}px)}`).join('')}}`
}

// Keyframes that carry a group sideways from `a` to `b` on `curve`.
function glide(name: string, a: number, b: number, curve: readonly number[]): string {
  return `@keyframes ${name}{0%{transform:translateX(${Math.round(a)}px);animation-timing-function:cubic-bezier(${curve.join()})}100%{transform:translateX(${Math.round(b)}px)}}`
}

// Keyframes that size a boat to how far off it is at each step, relative to
// the size it was drawn at, and, for a boat out on the open sea, let it come
// up out of the haze at the horizon and sink back into it. None when the
// boat keeps one depth.
function sizing(name: string, stops: readonly { p: number; k: number; y: number }[]): string {
  const fading = stops.some(s => clearAt(s.y) < 1)
  if (!fading && stops.every(s => Math.abs(s.k - 1) < 0.02)) {
    return ''
  }
  const seen = (y: number): string => (fading ? `;opacity:${f(clearAt(y))}` : '')
  return `@keyframes ${name}{${stops.map(s => `${f(s.p * 100)}%{transform:scale(${Math.round(s.k * 1000) / 1000})${seen(s.y)}}`).join('')}}`
}

// A boat's size and haze as its key values: a hundredth of its size is about
// half a pixel on a dinghy, and a fortieth of its haze about as plain.
function sizeKeys(k: number, y: number): number[] {
  return [k * 60, clearAt(y) * 40]
}

// One boat at `seconds` on the clock, and the keyframes of its own it needs.
// Its motion is a function of its age, so a redraw finds it where it was. Out
// on its circuit it rounds the ellipse and comes about at each end; while it
// is on its way in, what separates that way from the circuit is added on top
// and runs down to nothing. Called home, it turns from where it was and
// follows its way out.
function vessel(boat: Boat, seconds: number, flag: Flag, tolerance: number): { svg: string; css: string } {
  const route = routeOf(boat)
  const hull = `<g class="boat">${hullOf(boat, flag)}</g>`
  const bob = `--d:${f(boat.slot * 0.7)}`
  const name = `${boat.kind}${boat.slot}`
  if (boat.gone !== undefined) {
    const gone = boat.gone
    const span = leaveSeconds(boat)
    // Sideways it glides on one curve; up and down it follows its lane.
    const from = fixAt(boat, (gone - boat.born) / 1000)
    const straight = route.isFar
    const placeAt = (t: number): Point => whereabouts(boat, gone + t * 1000)
    const times = keyTimes(span, t => { const p = placeAt(t); return [straight ? p.x : 0, p.y, ...sizeKeys(depthScale(p.y) / depthScale(from.y), p.y)] }, tolerance)
    const way = times.map(t => ({ p: t / span, ...placeAt(t) }))
    const end = placeAt(span)
    const heading = boat.from === 'L' ? 1 : -1
    const a = f(seconds - gone / 1000)
    // It comes about from however far round its circuit had turned it: the
    // turn is joined where its side view is as wide, and faces as, it was.
    const lap = ((((gone - boat.born) / 1000 + lapStart(boat)) / route.seconds) % 1 + 1) % 1
    const facing = facingAt(LAP_FACING, lap) * heading
    const into = `style="--a:${f(seconds - gone / 1000 + (facing + 1) / 2)}"`
    const turned = facing > 0.999 ? hull : `<g class="turn" ${into}>${hull}</g>${bowOf(boat, 1, `class="turnb" ${into}`)}`
    // Out to sea it heads for the horizon on a straight line that the eye
    // foreshortens, so its sideways travel keeps step with its lane's.
    const sized = sizing(`${name}os`, way.map(w => ({ p: w.p, k: depthScale(w.y) / depthScale(from.y), y: w.y })))
    // The groups inside the outermost take its timing, which they inherit.
    const shrink = sized === '' ? turned : `<g class="way" style="animation-name:${name}os">${turned}</g>`
    return {
      css: glide(`${name}ox`, from.x, straight ? from.x : end.x, LEAVE_X) + keyframes(`${name}out`, way.map(w => ({ p: w.p, x: straight ? w.x - from.x : 0, y: w.y }))) + sized,
      svg: `<g class="way" transform="translate(${f(from.x)} 0)" style="animation-name:${name}ox;--e:${span}s;--a:${a}"><g class="way" transform="translate(0 ${f(from.y)})" style="animation-name:${name}out;${bob}">
<g transform="scale(${f3(heading * sizeOn(boat, from.y))} ${f3(sizeOn(boat, from.y))})">${shrink}</g></g></g>`,
    }
  }
  const age = seconds - boat.born / 1000
  const span = enterSeconds(boat)
  // On its way in from the edge its wake trails it, and dies away as it
  // settles onto its circuit.
  // On its way in, every group inside the outermost takes that one's timing,
  // which it inherits.
  const fading = age < span ? 'class="way" style="animation-name:wfade"' : ''
  const isComing = age < span
  // What separates its way in from the circuit: sideways, the run from the
  // edge to where it joins, glided on one curve, and the circuit's own drift
  // over that time (or, out at sea, its whole sideways way); up and down, its
  // lane's; and how much nearer or further off than its circuit it is.
  const join = lapAt(boat, span)
  const apartAt = (at: number): { x: number; y: number; k: number; seen: number } => {
    const fix = fixAt(boat, at)
    const round = lapAt(boat, at)
    return { x: (route.isFar ? fix.x : join.x) - round.x, y: fix.y - round.y, k: depthScale(fix.y) / depthScale(round.y), seen: fix.y }
  }
  const times = isComing ? keyTimes(span, at => { const a = apartAt(at); return [a.x, a.y, ...sizeKeys(a.k, a.seen)] }, tolerance) : []
  const apart = times.map(at => ({ p: at / span, ...apartAt(at) }))
  const sized = sizing(`${name}is`, apart.map(a => ({ p: a.p, k: a.k, y: a.seen })))
  // A roaming boat drifts near and far on its own beat, sized as it goes.
  const roaming = route.drift !== undefined
  const size = roaming ? 1 : route.scale
  const boat0 = `<g class="bf"><g transform="scale(${size})"><g class="boat">${hullOf(boat, flag, fading)}</g></g></g>${bowOf(boat, size, 'class="bw"')}`
  const grown = sized === '' ? boat0 : `<g class="way" style="animation-name:${name}is">${boat0}</g>`
  const drift = roaming ? `;--v:${route.drift}s;--c:${f(age + lapStart(boat) + route.driftFrom * (route.drift ?? 0))};--z0:${sizesOf(boat)[0]};--z1:${sizesOf(boat)[1]}` : ''
  const lap = `<g style="--u:${route.seconds}s;--b:${f(age + lapStart(boat))};--r:${route.rx}px;--q:${route.ry}px;${bob}${drift}" transform="translate(${route.cx} ${route.cy})">
<g class="bx">${roaming ? `<g class="bv"><g class="bz">${grown}</g></g>` : `<g class="by">${grown}</g>`}</g></g>`
  if (!isComing) {
    return { svg: lap, css: '' }
  }
  const edge = fixAt(boat, 0)
  const a = `--e:${span}s;--a:${f(age)}`
  return {
    css: (route.isFar ? '' : glide(`${name}ix`, edge.x - join.x, 0, ENTER_X)) + keyframes(`${name}in`, apart) + sized,
    svg: route.isFar
      ? `<g class="way" style="animation-name:${name}in;${a}">${lap}</g>`
      : `<g class="way" style="animation-name:${name}ix;${a}"><g class="way" style="animation-name:${name}in">${lap}</g></g>`,
  }
}

// The boats on the water, each painted on the far side of the island or the
// near side. Every circuit keeps clear of the island, so a boat is on the far
// side only while it rounds the island behind it on its way in or out, level
// with it; for that trip it is drawn twice, a copy on each side, each shown in
// its turn.
function fleets(boats: readonly Boat[], seconds: number, flag: Flag, isPlain: boolean): { css: string; far: Part[]; near: Part[] } {
  const far: Part[] = []
  const near: Part[] = []
  let css = ''
  boats.forEach((boat, index) => {
    const drawn = vessel(boat, seconds, flag, toleranceFor(isPlain))
    const one = { css: drawn.css, svg: `<g id="v${index}" data-b="${boat.kind}${boat.slot}">${drawn.svg}</g>`, copy: `<use href="#v${index}"/>` }
    const roam = roamSpan(isPlain)
    const depth = depthIn(boat, seconds, AHEAD_S, roam)
    const motion = { depthIn: (later: number): number => depthIn(boat, seconds, later, roam), xIn: (later: number): number => whereabouts(boat, (seconds + later) * 1000).x, moving: movingFor(boat, seconds, roam), ...FLEET_REACH }
    css += one.css
    if (!sailsBehind(boat)) {
      near.push({ svg: one.svg, copy: one.copy, depth, ...motion })
      return
    }
    const isLeaving = boat.gone !== undefined
    const start = (isLeaving ? (boat.gone ?? 0) : boat.born) / 1000
    const span = isLeaving ? leaveSeconds(boat) : enterSeconds(boat)
    const age = seconds - start
    if (age >= span) {
      near.push({ svg: one.svg, copy: one.copy, depth, ...motion })
      return
    }
    // The second, from `start`, the boat comes level with the island or
    // leaves it astern.
    const isLevel = (at: number): boolean => whereabouts(boat, (start + at) * 1000).x > ISLAND_EDGE
    let turn = span
    for (let at = 0; at <= span; at += 0.1) {
      if (isLevel(at) !== isLevel(0)) {
        turn = at
        break
      }
    }
    const behind: Span[] = isLevel(0) ? [[0, turn]] : [[turn, span]]
    const name = `${boat.kind}${boat.slot}`
    const endsBehind = isLeaving && isLevel(span)
    css += `${shownIn(`${name}f`, behind, span, endsBehind ? 1 : 0)}${shownIn(`${name}n`, outside(behind, span), span, endsBehind ? 0 : 1)}`
    const shown = { far: stepped(`${name}f`, span, age), near: stepped(`${name}n`, span, age) }
    far.push({ svg: `<g ${shown.far}>${one.svg}</g>`, copy: `<g ${shown.far}>${one.copy}</g>`, depth, ...motion })
    near.push({ svg: `<g ${shown.near}>${one.copy}</g>`, copy: `<g ${shown.near}>${one.copy}</g>`, depth, ...motion })
  })
  const byDepth = (a: Part, b: Part): number => a.depth - b.depth
  const behind = stack(far.sort(byDepth), 'zf')
  return { css: css + behind.css, far: behind.parts, near }
}

// Boats painted far to near for as long as the scene lasts. Boats on their
// circuits keep one order; boats on their way in or out take their places
// among them, and among each other, by how near they are. That arrangement
// only matters between boats close enough to overlap, so the time is cut
// where two such boats change places in depth, or come close together, and
// each moving boat is drawn once for each stretch in which its place differs
// from the one before, shown only then.
// Two boats close enough that one may hide part of the other: less than
// their hulls' widths apart across the view, and less than a sail's height
// apart in depth. A dinghy or fishing boat reaches about as far as one at
// its largest; the lead boat is bigger.
const FLEET_REACH = { wide: 90, tall: 70 }
const LEAD_REACH = { wide: 130, tall: 130 }
function isClose(a: Part, b: Part, later: number): boolean {
  return Math.abs(a.xIn(later) - b.xIn(later)) < (a.wide + b.wide) / 2 && Math.abs(a.depthIn(later) - b.depthIn(later)) < Math.max(a.tall, b.tall)
}
function stack(parts: readonly Part[], prefix: string): { parts: Part[]; css: string } {
  const still = parts.filter(part => part.moving <= 0)
  const movers = parts.filter(part => part.moving > 0)
  const horizon = Math.max(0, ...movers.map(part => part.moving))
  const placesAt = (later: number): [number, number][] => {
    const slots = movers.map(part => still.filter(other => other.depth < part.depthIn(later)).length)
    return movers.map((part, m) => [slots[m] ?? 0, movers.filter((other, k) => k !== m && slots[k] === slots[m] && (other.depthIn(later) < part.depthIn(later) || (other.depthIn(later) === part.depthIn(later) && k < m))).length])
  }
  // Each moving boat against every other boat: whether it is the nearer, and
  // whether the two are close.
  const pairsAt = (later: number): string =>
    movers
      .map((part, m) =>
        parts
          .filter(other => other !== part)
          .map(other => (isClose(part, other, later) ? (part.depthIn(later) > other.depthIn(later) ? 'n' : 'f') : '-'))
          .join('') + m,
      )
      .join()
  const cuts = [0]
  let last = pairsAt(0)
  for (let later = 0.1; later <= horizon + 0.05; later += 0.1) {
    const now = pairsAt(later)
    // A cut is needed where a close pair changes places, or a pair comes
    // close; two boats drawing apart need none.
    const isChanged = [...now].some((mark, k) => mark !== '-' && mark !== last[k])
    if (isChanged) {
      cuts.push(later)
    }
    last = now
  }
  // A stretch is cut wherever a pair comes close or a close pair trades
  // places, so every pair that is close at any time in a stretch is close,
  // and in that order, at its start: the order there holds for it all.
  const stretches = cuts.map((from, j) => {
    const to = cuts[j + 1] ?? horizon
    return { from, to, places: placesAt(from) }
  })
  const buckets: { rank: number; from: number; part: Part }[][] = still.map(() => [])
  buckets.push([])
  let css = ''
  movers.forEach((part, m) => {
    // Its own stretches: runs of stretches over which its place holds.
    const runs: { from: number; to: number; place: [number, number] }[] = []
    for (const stretch of stretches) {
      const place = stretch.places[m] ?? [0, 0]
      const run = runs[runs.length - 1]
      if (run !== undefined && run.place[0] === place[0] && run.place[1] === place[1]) {
        run.to = stretch.to
      } else {
        runs.push({ from: stretch.from, to: stretch.to, place })
      }
    }
    runs.forEach((run, j) => {
      const isLast = j === runs.length - 1
      let placed = part
      if (runs.length > 1) {
        const name = `${prefix}${m}t${j}`
        // Every gate in this stack shares one timing, set by its class.
        const gate = `class="cut ${prefix}" style="animation-name:${name}"`
        css += shownIn(name, [[run.from, isLast ? horizon : run.to]], horizon, isLast ? 1 : 0)
        placed = { ...part, svg: `<g ${gate}>${j === 0 ? part.svg : part.copy}</g>`, copy: `<g ${gate}>${part.copy}</g>` }
      }
      buckets[run.place[0]]?.push({ rank: run.place[1], from: run.from, part: placed })
    })
  })
  if (css !== '') {
    css += `.${prefix}{--e:${f(Math.max(0.1, horizon))}s;--a:0}`
  }
  const out: Part[] = []
  buckets.forEach((bucket, k) => {
    out.push(...bucket.sort((a, b) => a.rank - b.rank || a.from - b.from).map(entry => entry.part))
    const here = still[k]
    if (here !== undefined) {
      out.push(here)
    }
  })
  return { parts: out, css }
}

// Where the island begins, for a boat passing behind it: the jetty's tip,
// less half a boat.
const ISLAND_EDGE = JETTY.tip - 40

// A boat drawn with how near it sails, so that boats can be painted far to
// near: `depth` now, `depthIn` some seconds from now, and for how many more
// seconds that changes.
//
// A boat that must be painted in more than one place is drawn in full once,
// under an id, and placed again with <use>: `copy` places it again.
type Part = { svg: string; copy: string; depth: number; depthIn: (later: number) => number; xIn: (later: number) => number; moving: number; wide: number; tall: number }

// How near the viewer a boat sails, as the height of its waterline. Out on
// its circuit it keeps to a narrow band, and that band's middle stands for it;
// on its way in or out it crosses others, and where it will be a moment from
// now stands for it until the scene is drawn again.
const AHEAD_S = 1.5

function depthIn(boat: Boat, seconds: number, later: number, roam: number): number {
  return movingFor(boat, seconds, roam) > later ? whereabouts(boat, (seconds + later) * 1000).y : routeOf(boat).cy
}

// For how many more seconds a boat's depth keeps changing in this scene: on
// its way in or out, or for as long as the scene works out a roaming boat's
// place.
function movingFor(boat: Boat, seconds: number, roam: number): number {
  if (boat.gone !== undefined) {
    return boat.gone / 1000 + leaveSeconds(boat) - seconds
  }
  const coming = Math.max(0, boat.born / 1000 + enterSeconds(boat) - seconds)
  return roams(boat) ? Math.max(coming, roam) : coming
}

// How far ahead a scene works out roaming boats' order: less far in a plain
// scene, which must stay small, and is drawn again sooner.
export function roamSpan(isPlain: boolean): number {
  return isPlain ? PLAIN_ROAM_S : ROAM_S
}
const PLAIN_ROAM_S = 20

// Slow rings on the water while the conversation is being compacted.
const WHIRLPOOL = `<g transform="translate(860 562)" fill="none">${[58, 38, 18]
  .map((rx, i) => `<ellipse class="foam foamline" rx="${rx}" ry="${f(rx * 0.26)}" stroke-width="${3 - i * 0.5}" opacity=".8" style="--d:${i * 3}"/>`)
  .join('')}</g>`

// Sea life, each drawn facing right around its own origin.
const TURTLE = `<ellipse class="shade" cx="-10" cy="34" rx="46" ry="25"/>
<g opacity=".9"><g class="tsk"><path class="flipA" style="transform-origin:16px -16px" d="M20 -15C30 -26 38 -42 34 -58C24 -50 12 -36 6 -20Z"/><path class="flipB" style="transform-origin:16px 16px" d="M20 15C30 26 38 42 34 58C24 50 12 36 6 20Z"/>
<path d="M-26 -14C-36 -20 -46 -22 -52 -16C-46 -10 -36 -8 -28 -8ZM-26 14C-36 20 -46 22 -52 16C-46 10 -36 8 -28 8ZM-34 -2L-46 0L-34 2ZM26 -7C34 -9 44 -8 48 0C44 8 34 9 26 7Z"/></g>
<circle class="teye" cx="42" cy="-3.8" r="1.4"/><circle class="teye" cx="42" cy="3.8" r="1.4"/>
<path class="tsh" d="M30 0C30 -16 14 -24 -4 -24C-22 -24 -34 -12 -36 0C-34 12 -22 24 -4 24C14 24 30 16 30 0Z"/>
<path class="tsl" d="M21 0C21 -10 10 -16 -3 -16C-16 -16 -25 -8 -27 0C-25 8 -16 16 -3 16C10 16 21 10 21 0Z"/>
<path class="tsc" fill="none" stroke-width="1.3" stroke-linejoin="round" opacity=".7" d="M20 0L8 -8L-8 -8L-18 0L-8 8L8 8ZM8 -8L12 -22M-8 -8L-14 -22M8 8L12 22M-8 8L-14 22M20 0H30M-18 0H-36M0 -8V8"/></g>`

// Seen from above, nose to the right: swept wings, and a broad head whose two
// short lobes flank the mouth.
const MANTA_BODY = 'M47 -10C44 -15 38 -16 32 -18C18 -26 4 -46 -12 -80C-12 -58 -20 -34 -36 -12C-40 -6 -40 6 -36 12C-20 34 -12 58 -12 80C4 46 18 26 32 18C38 16 44 15 47 10C45 8 42 8 40 7Q35 0 40 -7C42 -8 45 -8 47 -10Z'

const MANTA = `<path class="shade" transform="translate(-14 44)" d="${MANTA_BODY}"/>
<g opacity=".82"><path class="mb" d="M-37 -1.5L-96 0L-37 1.5Z"/><g class="wingf"><path class="mb" d="${MANTA_BODY}"/><path class="mm" d="M22 -10C14 -21 4 -27 -8 -28C-2 -18 8 -11 22 -7ZM22 10C14 21 4 27 -8 28C-2 18 8 11 22 7Z"/></g></g>`

const FIN = `<path class="fin" d="M13 0Q5 -19 -9 -26Q-7 -11 -13 0Z"/><path d="M-13 1q-24 1 -52 7M-11 3q-20 6 -40 14" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>`

const DOLPHIN = `<path class="dol" d="M52 2Q46 -4 34 -8C14 -22 -24 -18 -46 -4L-62 -14Q-58 -2 -60 12L-46 2C-26 14 8 16 30 8Q44 8 52 2ZM0 -17Q-6 -34 -18 -36Q-12 -24 -14 -15ZM16 8Q10 22 0 24Q6 14 6 8Z"/><path class="dolb" d="M30 8C8 16 -26 14 -46 2C-24 8 8 10 30 5Z"/>`

function school(cls: string, count: number, salt: number): string {
  let out = ''
  for (let i = 0; i < count; i++) {
    const x = rnd(i, salt) * 200 - 100
    const y = rnd(i, salt + 1) * 80 - 40
    const s = 1.1 + rnd(i, salt + 2) * 0.7
    out += `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s)})"><path class="wig" style="--d:${f(rnd(i, salt + 3) * 1.3)}" d="M11 0Q3 -6 -8 0Q3 6 11 0ZM-7 0l-8 -5v10Z"/></g>`
  }
  return `<g class="${cls}" opacity=".88">${out}</g>`
}

// Crosses the whole view once per cycle, then stays out of sight for the rest
// of it, so the sea is mostly empty and each visitor is an event. The sand
// island fills the right of the lanes at `y`, so a swimmer that would run into
// it is given a `dip`: that much lower on the island's side of the view.
function swimmer(dir: 'R' | 'L', y: number, seconds: number, phase: number, squash: number, body: string, dip = 0): string {
  const flip = dir === 'L' ? ' scale(-1 1)' : ''
  const inner = `<g class="wander"><g transform="scale(1 ${squash})${flip}">${body}</g></g>`
  const path = dip === 0 ? inner : `<g class="dip${dir}" style="--dip:${dip}px;animation-duration:${seconds}s">${inner}</g>`
  return `<g class="sw${dir}" style="animation-duration:${seconds}s;--d:${phase}"><g transform="translate(0 ${y})">${path}</g></g>`
}

function leaper(x: number, s: number, phase: number): string {
  return `<g transform="translate(${x} 0)" style="--d:${phase}"><g class="lpX"><g class="lpY"><g class="lpR"><g transform="scale(${s})">${DOLPHIN}</g></g></g></g></g>`
}

// Two dolphins leaping together at one spot. A leap comes round every
// LEAP_EVERY seconds, and each pod is in sight for only one round in three, a
// different one from the others, so where and when the next leap comes varies.
function pod(x: number, y: number, s: number, phase: number, turn: number): string {
  const ring = 'fill="none" stroke="#fff" stroke-width="1.6"'
  // The round in sight starts a little into it, after the last splash has faded.
  const sight = phase - LEAP_EVERY * 0.1 + LEAP_EVERY * turn
  return `<g class="pod" style="--d:${f(sight)}"><g transform="translate(${x} ${y}) scale(${s})" style="--d:${phase}">
<g clip-path="url(#surf)">${leaper(0, 0.5, phase)}${leaper(-44, 0.42, phase - 0.7)}</g>
<ellipse class="spA" cx="15" cy="0" rx="16" ry="3.5" ${ring}/><ellipse class="spB" cx="75" cy="0" rx="16" ry="3.5" ${ring}/></g></g>`
}

function seaLife(): string {
  return `<g>
${pod(640, HORIZON + 46, 1, 0, 0)}${pod(700, HORIZON + 96, 1.5, 37, 2)}${pod(960, HORIZON + 68, 1.25, 20, 1)}
${swimmer('L', HORIZON + 112, 270, 150, 1, FIN)}
${swimmer('R', 740, 118, 20, 0.85, school('fishA', 9, 21), 66)}
${swimmer('L', 850, 152, 96, 0.85, school('fishB', 7, 31))}
${swimmer('R', 812, 230, 170, 0.7, `<g transform="scale(1.2)">${TURTLE}</g>`)}
${swimmer('L', 712, 196, 60, 0.7, `<g transform="scale(0.9)">${MANTA}</g>`, 128)}
</g>`
}

function star5(cx: number, cy: number, r: number): string {
  let d = ''
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2
    const rr = k % 2 === 0 ? r : r * 0.42
    d += `${k === 0 ? 'M' : 'L'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr * 0.7)}`
  }
  return `<path d="${d}Z" fill="#f08a4b"/>`
}

// Claude's mascot, drawn on a grid of square cells with its feet on the origin:
// a block of a body, two stub arms, four legs, and a face.
const CLAY = '#c97b5e'
const INK = '#1f1614'
const M_BODY = 'M-7.5 -13h15v10h-15z'
const M_ARM_L = 'M-9.5 -9h2v2h-2z'
const M_ARM_R = 'M7.5 -9h2v2h-2z'
const M_ARM_UP = 'M7.5 -12.5h2v2h-2z'
const M_LEGS_A = 'M-6.5 -3h1v3h-1zM2.5 -3h1v3h-1z'
const M_LEGS_B = 'M-3.5 -3h1v3h-1zM5.5 -3h1v3h-1z'
const M_BLUSH = '<path d="M-6.5 -7h2v1h-2zM4.5 -7h2v1h-2z" fill="#e29a8f"/>'
const M_SHUT = `<path d="M-5.2 -9h2.4v.7h-2.4zM2.8 -9h2.4v.7h-2.4z" fill="${INK}"/>`

function clay(d: string): string {
  return `<path d="${d}" fill="${CLAY}"/>`
}

function inked(d: string): string {
  return `<path d="${d}" fill="${INK}"/>`
}

function drawn(d: string): string {
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width=".9"/>`
}

// The looks its face takes besides looking straight ahead: smiling eyes, a
// wink, a glance to the right and to the left, a glance up, and wide eyes.
const M_LOOKS = [
  drawn('M-5.1 -8.3L-4 -9.9L-2.9 -8.3M2.9 -8.3L4 -9.9L5.1 -8.3'),
  `${inked('M-4.5 -10h1v2h-1z')}${drawn('M4.7 -10.4L3.3 -9L4.7 -7.6')}`,
  inked('M-3.5 -10h1v2h-1zM4.5 -10h1v2h-1z'),
  inked('M-5.5 -10h1v2h-1zM2.5 -10h1v2h-1z'),
  inked('M-4.5 -11.2h1v2h-1zM3.5 -11.2h1v2h-1z'),
  inked('M-4.9 -10.6h1.8v2.8h-1.8zM3.1 -10.6h1.8v2.8h-1.8z'),
]
const GLANCE_RIGHT = 2
const GLANCE_LEFT = 3

// Its face, awake: every look is there, and the trip's own keyframes show one
// at a time.
const M_FACE = `${M_BLUSH}<g class="fk0"><g class="mblink">${inked('M-4.5 -10h1v2h-1zM3.5 -10h1v2h-1z')}</g></g>${M_LOOKS.map((look, i) => `<g class="fk${i + 1}" opacity="0">${look}</g>`).join('')}`

const M_STEPPING = `<g class="mstep">${clay(M_LEGS_A)}</g><g class="mstep" style="--d:.25">${clay(M_LEGS_B)}</g>`

// What it fishes with: a rod over its left shoulder and a float on the water
// beyond the jetty.
const M_ROD = `<g class="lrod" opacity="0"><path d="M-8.5 -7.5L-21 -19" stroke="#7a5a3a" stroke-width=".7" fill="none"/><path d="M-21 -19L-25 3.6" stroke="#fff" stroke-width=".25" opacity=".8" fill="none"/>
<ellipse cx="-25" cy="5" rx="3.4" ry=".9" fill="none" stroke="#fff" stroke-width=".3" opacity=".6"/><g class="mbob"><circle cx="-25" cy="4.2" r="1.1" fill="#ef4f3f"/><path d="M-26.1 4.2a1.1 1.1 0 0 0 2.2 0z" fill="#fff"/></g></g>`
// What it wears on the lounger, and what it holds at the bar.
// The mascot seen from the side, facing left, as it lies on the lounger:
// thinner than it is wide, one arm on its near side, two legs, and its
// sunglasses' near lens and arm.
const M_SIDE = `${clay('M-4 -13h8v10h-8zM-3 -3h1v3h-1zM2 -3h1v3h-1z')}<path d="M-1 -9h2v2h-2z" fill="#a9654b"/><path d="M-3.5 -7h2v1h-2z" fill="#e29a8f"/>${inked('M-4.3 -10.5h3.4v2.7h-3.4zM-.9 -10h3v.6h-3z')}`
const M_DRINK = `<g class="lsip" opacity="0"><circle cx="10.6" cy="-8.4" r="2" fill="#6b4c2f"/><path d="M11 -10.2v-2.4l-2 -1.2" stroke="#fff" stroke-width=".5" fill="none" stroke-linejoin="round"/></g>`
// Its face asleep, and what drifts up from it then. The face lies down with
// the rest of it; the letters stay upright.
const M_ASLEEP = `<g class="lnap" opacity="0">${M_BLUSH}${M_SHUT}</g>`
const M_SNORE = `<g class="lnap" opacity="0">${[0, 1.6].map(d => `<path class="mzz" style="--d:${d}" d="M9 -19h2.6l-2.6 2.6h2.6" fill="none" stroke="#fff" stroke-width=".7"/>`).join('')}</g>`
// How it lies in the hammock: on its side, head to the right, sunk into the
// cloth.
const M_LYING = 'translate(-6.5px,-8px) rotate(90deg)'
// How it lies on the lounger, seen from the side: on its back along the
// cushion, feet to the left and head raised on the backrest.
const M_RECLINE = 'translate(-12.6px,-3.7px) rotate(74deg)'

// A stretch of a run, in seconds from its start.
type Span = readonly [number, number]

function pct(part: number, whole: number): string {
  return `${Math.round((Math.max(0, Math.min(part, whole)) / Math.max(0.1, whole)) * 10000) / 100}%`
}

function joined(spans: readonly Span[]): [number, number][] {
  const out: [number, number][] = []
  for (const [from, to] of [...spans].sort((a, b) => a[0] - b[0])) {
    const last = out[out.length - 1]
    if (last !== undefined && from <= last[1] + 0.01) {
      last[1] = Math.max(last[1], to)
    } else {
      out.push([from, to])
    }
  }
  return out
}

// What a `whole`-second run has left outside `spans`.
function outside(spans: readonly Span[], whole: number): Span[] {
  const out: Span[] = []
  let at = 0
  for (const [from, to] of joined(spans)) {
    if (from > at) {
      out.push([at, from])
    }
    at = Math.max(at, to)
  }
  return at < whole ? [...out, [at, whole]] : out
}

// Keyframes, stepped from one to the next, that show a part only during
// `spans` of a `whole`-second run. `after` is how a run played once leaves it.
function shownIn(name: string, spans: readonly Span[], whole: number, after?: 0 | 1): string {
  const runs = joined(spans)
  let frames = `0%{opacity:${runs[0] !== undefined && runs[0][0] <= 0 ? 1 : 0}}`
  for (const [from, to] of runs) {
    frames += `${from > 0 ? `${pct(from, whole)}{opacity:1}` : ''}${to < whole ? `${pct(to, whole)}{opacity:0}` : ''}`
  }
  return `@keyframes ${name}{${frames}${after === undefined ? '' : `100%{opacity:${after}}`}}`
}

// The CSS that takes its face through its looks: mostly straight ahead, with
// a glance, a smile or a wink between. The rhythm is drawn from `rand`, so no
// two trips share one.
function faceCss(rand: () => number): string {
  const looks: Span[][] = M_LOOKS.map(() => [])
  const calm: Span[] = []
  let t = 0
  const hold = (into: Span[] | undefined, seconds: number): void => {
    const until = Math.round((t + seconds) * 10) / 10
    into?.push([t, until])
    t = until
  }
  while (t < 64) {
    hold(calm, 2.5 + rand() * 6)
    if (rand() < 0.22) {
      // A look round: one way, then the other.
      const first = rand() < 0.5 ? GLANCE_RIGHT : GLANCE_LEFT
      hold(looks[first], 0.8 + rand())
      hold(looks[first === GLANCE_RIGHT ? GLANCE_LEFT : GLANCE_RIGHT], 0.8 + rand())
    } else {
      hold(looks[Math.floor(rand() * M_LOOKS.length)], 1 + rand() * 2.2)
    }
  }
  const rule = (i: number, spans: readonly Span[]): string => `${shownIn(`fk${i}`, spans, t)}.fk${i}{animation:fk${i} ${f(t)}s step-end ${PHASE} infinite}`
  return rule(0, calm) + looks.map((spans, i) => rule(i + 1, spans)).join('')
}

// The CSS of the small things it does while it stands about: a hop or two, a
// wave, a lean to one side, a twirl, a bob. Each falls somewhere in `spans` of
// a `whole`-second run, drawn from `rand`; `greets` opens the first span with
// a wave and two hops, and `pause` is the longest it stands still between
// two of them. Class `name` moves the figure, `name`w shows its waving arm and
// `name`n the arm at rest.
function anticsCss(
  name: string,
  clock: (timing: string) => string,
  spans: readonly Span[],
  whole: number,
  rand: () => number,
  greets: boolean,
  pause: number,
  acts: Span[] = [],
): string {
  const still = [0, whole]
  const waves: Span[] = []
  let poses = ''
  const pose = (at: number, transform: string): void => {
    poses += `${pct(at, whole)}{transform:${transform}}`
  }
  const hopAt = (at: number): number => {
    still.push(at, at + 0.44)
    pose(at + 0.22, 'translateY(-3px)')
    return 0.44
  }
  // Each with the longest it can take, so that one is started only where it
  // fits.
  const kinds: readonly { needs: number; run: (at: number) => number }[] = [
    { needs: 0.5, run: hopAt },
    { needs: 0.9, run: at => hopAt(at) + hopAt(at + 0.44) },
    {
      needs: 3.6,
      run: at => {
        const seconds = 2 + rand() * 1.6
        waves.push([at, at + seconds])
        return seconds
      },
    },
    {
      needs: 3.2,
      run: at => {
        const lean = `rotate(${rand() < 0.5 ? -7 : 7}deg)`
        const seconds = 1.6 + rand() * 1.6
        still.push(at, at + seconds)
        pose(at + 0.4, lean)
        pose(at + seconds - 0.4, lean)
        return seconds
      },
    },
    {
      needs: 0.9,
      run: at => {
        still.push(at, at + 0.9)
        pose(at + 0.45, 'scaleX(-1)')
        return 0.9
      },
    },
    {
      needs: 0.6,
      run: at => {
        still.push(at, at + 0.3, at + 0.6)
        pose(at + 0.15, 'scaleY(.84)')
        pose(at + 0.45, 'scaleY(.84)')
        return 0.6
      },
    },
  ]
  spans.forEach(([from, to], i) => {
    let at = from + 0.4 + rand() * 2.5
    if (greets && i === 0) {
      waves.push([from + 0.3, from + 3.4])
      hopAt(from + 0.6)
      hopAt(from + 1.5)
      at = from + 4.5 + rand() * 2
    }
    while (at + 0.6 < to) {
      const act = kinds[Math.floor(rand() * kinds.length)]
      if (act !== undefined && at + act.needs < to) {
        const from = at
        at += act.run(at)
        acts.push([from, at])
      }
      at += 2 + rand() * (pause - 2)
    }
  })
  const rest = [...new Set(still.map(at => pct(at, whole)))].join()
  return `@keyframes ${name}{${rest}{transform:none}${poses}}.${name}{animation:${name} ${clock('ease-in-out')}}
${shownIn(`${name}w`, waves, whole)}.${name}w{animation:${name}w ${clock('step-end')}}${shownIn(`${name}n`, outside(waves, whole), whole)}.${name}n{animation:${name}n ${clock('step-end')}}`
}

// The mascot as it rides the lead boat, doing what the trip's own keyframes
// have it do. Hailing the person, it also waves and hops without a pause, in a
// beat that starts as the hailing does; once that stops, a hop under way
// comes down rather than vanishing.
function rider(flag: Flag): string {
  const isHailing = flag.to !== 'none'
  const hailed = flag.hailed ?? flag.age
  let hop = ''
  if (isHailing) {
    hop = `style="animation:mhops ${HAIL_S}s ease-in-out ${f(-hailed)}s infinite"`
  } else if (flag.from !== 'none') {
    const into = Math.max(0, hailed - flag.age) % HAIL_S
    if (into > HAIL_S * 0.7) {
      hop = `style="animation:mhops ${HAIL_S}s ease-in-out ${f(-(into + flag.age))}s 1 both"`
    }
  }
  const arm = isHailing
    ? `<g class="mwave">${clay(M_ARM_UP)}</g>`
    : `<g class="can">${clay(M_ARM_R)}</g><g class="caw" opacity="0"><g class="mwave">${clay(M_ARM_UP)}</g></g>`
  return `<g class="ca"><g ${hop}>${clay(M_BODY + M_ARM_L + M_LEGS_A + M_LEGS_B)}${arm}${M_FACE}</g></g>`
}

// The mascot on its way to or from the boat, at the scale it has on the sand.
// `gait` and `rest` hold the attributes that show its stepping legs on the
// stretches it walks and its legs at rest on the others.
// `lie` holds the attributes that turn it upright from lying down, where it
// sets out from the hammock or the lounger.
// Getting off the lounger it starts side on: `turn` then holds the attributes
// of its front and its side as it turns to face the front.
function walker(gait: string, rest: string, lie = '', turn?: { front: string; side: string }): string {
  const figure = `${clay(M_BODY + M_ARM_L + M_ARM_R)}<g ${rest}>${clay(M_LEGS_A + M_LEGS_B)}</g><g ${gait} opacity="0">${M_STEPPING}</g>${M_FACE}`
  const body = turn === undefined ? figure : `<g ${turn.front} transform="scale(0 1)">${figure}</g><g ${turn.side}>${M_SIDE}</g>`
  return `<g transform="scale(2.4)"><g ${lie}>${body}</g></g>`
}

// The mascot living its day on the island: one figure whose stepping legs,
// rod, shades, drink and sleeping face each show for their part of that day,
// and which lies on its side while it naps.
function islander(): string {
  return `<g transform="scale(2.4)"><g class="la"><g class="llie"><g class="lfr">${M_ROD}${clay(M_BODY + M_ARM_L)}<g class="lan">${clay(M_ARM_R)}</g><g class="law" opacity="0"><g class="mwave">${clay(M_ARM_UP)}</g></g>
<g class="lrest">${clay(M_LEGS_A + M_LEGS_B)}</g><g class="lgait" opacity="0">${M_STEPPING}</g>
<g class="lawake">${M_FACE}</g>${M_ASLEEP}${M_DRINK}</g><g class="lsd" transform="scale(0 1)">${M_SIDE}</g></g>${M_SNORE}</g></g>`
}

// The CSS of the mascot's day: where it is, which of its parts show while it
// does each thing, and what it gets up to while it stands about.
function dayCss(day: Day, rand: () => number, greets: boolean, isPlain: boolean): string {
  const { steps, span } = day
  const clock = (timing: string): string => `${f(span)}s ${timing} calc(var(--n,0) * -1s) infinite`
  const during = (test: (doing: Doing) => boolean): Span[] => {
    const spans: Span[] = []
    let from = 0
    for (const step of steps) {
      if (test(step.doing)) {
        spans.push([from, step.until])
      }
      from = step.until
    }
    return spans
  }
  const part = (name: string, test: (doing: Doing) => boolean): string => `${shownIn(name, during(test), span)}.${name}{animation:${name} ${clock('step-end')}}`
  const place = steps.map(step => `${pct(step.until, span)}{transform:translate(${step.x}px,${step.y}px)}`).join('')
  const idle = during(doing => doing === 'stand').filter(([from, to]) => to - from >= 3)
  // It turns onto its side as it climbs into the hammock or onto the lounger,
  // and upright again as it climbs out.
  // Onto the lounger it first turns side on, then lies back; off it, it sits
  // up and then turns to face the front again.
  const poses: Record<string, number[]> = { none: [0, span], [M_LYING]: [], [M_RECLINE]: [] }
  const facing: { front: [number, number][]; side: [number, number][] } = { front: [], side: [] }
  steps.forEach((step, i) => {
    const pose = step.doing === 'nap' ? M_LYING : step.doing === 'sun' ? M_RECLINE : undefined
    const a = steps[i - 2]?.until ?? 0
    const b = steps[i - 1]?.until ?? 0
    const d = steps[i + 1]?.until ?? span
    if (pose === M_RECLINE) {
      const on = b - a
      const off = d - step.until
      poses.none?.push(a + 0.4 * on, step.until + 0.6 * off)
      facing.front.push([a, 1], [a + 0.2 * on, 0], [step.until + 0.8 * off, 0], [d, 1])
      facing.side.push([a + 0.2 * on, 0], [a + 0.4 * on, 1], [step.until + 0.6 * off, 1], [step.until + 0.8 * off, 0])
    } else if (pose !== undefined) {
      poses.none?.push(a, d)
    }
    if (pose !== undefined) {
      poses[pose]?.push(b, step.until)
    }
  })
  const turned = (name: string, stops: [number, number][]): string =>
    stops.length === 0 ? '' : `@keyframes ${name}{${stops.map(([at, x]) => `${pct(at, span)}{transform:scaleX(${x})}`).join('')}}.${name}{animation:${name} ${clock('ease-in-out')}}`
  const stops = (times: readonly number[]): string => [...new Set(times.map(at => pct(at, span)))].join()
  const held = Object.entries(poses).filter(([, times]) => times.length > 0)
  const lies = held.length < 2 ? '' : `@keyframes llie{${held.map(([pose, times]) => `${stops(times)}{transform:${pose}}`).join('')}}.llie{animation:llie ${clock('ease-in-out')}}`
  // It stands in front of the lounger as it climbs on from the front, and
  // behind it everywhere else.
  const before: Span[] = []
  steps.reduce<Point>((last, step, i) => {
    if (isByLounger(step) || isByLounger(last)) {
      before.push([steps[i - 1]?.until ?? 0, step.until])
    }
    return step
  }, HOME)
  const front = `${shownIn('lfront', outside(before, span), span)}.lfront{animation:lfront ${clock('step-end')}}`
  return `${front}@keyframes lpos{0%{transform:translate(${HOME.x}px,${HOME.y}px)}${place}}.lpos{animation:lpos ${clock('ease-in-out')}}
${part('lgait', doing => doing === 'walk')}${part('lrest', doing => doing !== 'walk')}${part('lrod', doing => doing === 'fish')}${part('lnap', doing => doing === 'nap')}${part('lawake', doing => doing !== 'nap')}${part('lsip', doing => doing === 'sip')}
${lies}${turned('lfr', facing.front)}${turned('lsd', facing.side)}${isPlain ? '' : anticsCss('la', clock, idle, span, rand, greets, 7)}`
}

// The attributes of a group that plays keyframes `name` once over `span`
// seconds, `t` seconds in, and then stays as the keyframes left it: `once`
// runs smoothly from one keyframe to the next, `stepped` jumps. Their classes
// set each animation property by name: in the `animation` shorthand a leading
// `none` reads as the fill mode, and the group would spring back at the end.
function once(name: string, span: number, t: number): string {
  return `class="way" style="animation-name:${name};--e:${f(Math.max(0.1, span))}s;--a:${f(t)}"`
}

function stepped(name: string, span: number, t: number): string {
  return `class="cut" style="animation-name:${name};--e:${f(Math.max(0.1, span))}s;--a:${f(t)}"`
}

// Keyframes that carry a group along `legs` over `span` seconds:
// `${name}x` moves it sideways and `${name}y` up and down, for two nested
// groups. A straight stretch is two keyframes paced by its own curve, and so
// is the sideways travel of a stretch that glides; the rest is a string of
// short straight steps.
function track(name: string, legs: readonly Leg[], span: number): string {
  type Stop = { at: number; v: number; ease: string }
  const across: Stop[] = []
  const down: Stop[] = []
  const bezier = (curve: readonly number[]): string => `cubic-bezier(${curve.join()})`
  for (const leg of legs) {
    const sideways = leg.curve ?? leg.glide
    if (sideways !== undefined) {
      across.push({ at: leg.from, v: leg.at(0).x, ease: bezier(sideways) }, { at: leg.to, v: leg.at(1).x, ease: '' })
    }
    if (leg.curve !== undefined) {
      down.push({ at: leg.from, v: leg.at(0).y, ease: bezier(leg.curve) }, { at: leg.to, v: leg.at(1).y, ease: '' })
    }
    if (sideways === undefined || leg.curve === undefined) {
      const parts = Math.max(6, Math.min(14, Math.round((leg.to - leg.from) / 0.4)))
      for (let i = 0; i <= parts; i++) {
        const at = leg.from + (i / parts) * (leg.to - leg.from)
        const p = leg.at(i / parts)
        if (sideways === undefined) {
          across.push({ at, v: p.x, ease: '' })
        }
        down.push({ at, v: p.y, ease: '' })
      }
    }
  }
  const frames = (axis: 'X' | 'Y', stops: readonly Stop[]): string => {
    const first = stops[0]
    const last = stops[stops.length - 1]
    if (first === undefined || last === undefined) {
      return ''
    }
    const all = [{ ...first, at: 0, ease: '' }, ...stops, { ...last, at: span }]
    let out = ''
    all.forEach((stop, i) => {
      const next = all[i + 1]
      // Where one stretch ends as the next begins, the next one's pace holds.
      if (next === undefined || pct(next.at, span) !== pct(stop.at, span)) {
        out += `${pct(stop.at, span)}{transform:translate${axis}(${Math.round(stop.v)}px)${stop.ease === '' ? '' : `;animation-timing-function:${stop.ease}`}}`
      }
    })
    return `@keyframes ${name}${axis.toLowerCase()}{${out}}`
  }
  return frames('X', across) + frames('Y', down)
}

// The attributes of the two nested groups that carry something along a
// track `name` laid over `span` seconds, `t` seconds in, from `now`.
function tracked(name: string, span: number, t: number, now: Point, inner: string): string {
  return `<g ${once(`${name}x`, span, t)} transform="translate(${f(now.x)} 0)"><g ${once(`${name}y`, span, t)} transform="translate(0 ${f(now.y)})">${inner}</g></g>`
}

// Keyframes that draw a boat's wake out as it gathers way along `legs` and
// in again as it slows. Only a leg to or from the edge of the view leaves a
// wake: about the lagoon the boat goes too slowly for one.
function wakeOf(name: string, legs: readonly Leg[], span: number): string {
  const FULL_SPEED = 90
  let frames = ''
  let last = ''
  for (const leg of legs) {
    const seconds = Math.max(0.001, leg.to - leg.from)
    const isEdge = [leg.at(0), leg.at(1)].some(p => p.x < 0 || p.x > W)
    for (const p of [0, 0.5, 1]) {
      const a = leg.at(Math.max(0, p - 0.02))
      const b = leg.at(Math.min(1, p + 0.02))
      const speed = Math.hypot(b.x - a.x, b.y - a.y) / ((Math.min(1, p + 0.02) - Math.max(0, p - 0.02)) * seconds)
      const way = isEdge ? Math.min(1, speed / FULL_SPEED) : 0
      const at = pct(leg.from + p * seconds, span)
      if (at !== last) {
        frames += `${at}{transform:scaleX(${f(0.15 + 0.85 * way)});opacity:${f(way)}}`
        last = at
      }
    }
  }
  return frames === '' ? '' : `@keyframes ${name}{${frames}}`
}

// Keyframes that turn a boat about wherever its course changes heading.
// Keyframes that follow the boat's facing through `points` ([seconds,
// scaleX]) as `as` turns each facing into a transform. The midpoint of each
// turn, where it is seen bow on, is kept as a keyframe of its own.
function facing(name: string, points: readonly [number, number][], span: number, as: (side: number) => string): string {
  const all: [number, number][] = []
  points.forEach(([at, side], i) => {
    const last = points[i - 1]
    if (last !== undefined && last[1] * side < 0) {
      all.push([last[0] + ((at - last[0]) * last[1]) / (last[1] - side), 0])
    }
    all.push([at, side])
  })
  const frames = all.map(([at, side]) => `${pct(at, span)}{transform:${as(side)}}`).join('')
  return `@keyframes ${name}{${frames}100%{transform:${as(all[all.length - 1]?.[1] ?? 1)}}}`
}

// How long the captain's antics run before they come round again.
const CAPTAIN_S = 84
const LEAD_BOAT: Boat = { kind: 'lead', slot: 0, from: 'R', pass: 'under', born: 0, gone: undefined }

// The lead boat and the mascot at `seconds` on the clock. On a fetch the boat
// comes in to the jetty, the mascot walks out along it and hops aboard, and
// the boat carries it to its circuit; on a landing the boat makes for the
// jetty, the mascot hops off and walks home to its day, and the boat goes out
// by an edge. `early` is the mascot drawn under the hammock and behind the
// boats, `late` the mascot drawn over the boats while it is on deck or
// hopping between deck and jetty. `isPlain` leaves out the antics, for a
// scene short of room.
function trip(voyage: Voyage, seconds: number, flag: Flag, isPlain: boolean): { boat: string; depth: (later: number) => number; x: (later: number) => number; sails: number; early: string; late: string; css: string } {
  const t = seconds - voyage.at / 1000
  const plan = planOf(voyage)
  const rand = scatter(voyage.at)
  const faces = faceCss(rand)
  const route = routeOf(LEAD_BOAT)
  const hull = (wake?: string): string => `<g transform="scale(${route.scale})"><g class="boat">${leadBoat(flag, wake)}</g></g>`
  // The boat on a course of its own, turning about as the course does.
  const turning = turns(plan.boat, voyage.facing)
  // How near the boat sails `later` seconds from now, for painting it among
  // the fleet: along its course, then on its circuit.
  const isCoursing = (at: number): boolean => plan.boat.length > 0 && at < (voyage.phase === 'fetch' ? plan.settled : plan.gone)
  const depth = (later: number): number =>
    isCoursing(t + later) ? along(plan.boat, t + later).y : voyage.phase === 'fetch' ? circuitAt(t + later - plan.settled).y : route.cy
  // And where across the view it is: along its course, round its circuit,
  // moored, or gone.
  const x = (later: number): number =>
    isCoursing(t + later) ? along(plan.boat, t + later).x : voyage.phase === 'fetch' ? circuitAt(t + later - plan.settled).x : t + later < plan.gone ? DOCK.x : -9999
  const sails = Math.max(0, (voyage.phase === 'fetch' ? plan.settled : plan.gone) - t)
  const under = (span: number, captain: string | undefined): { svg: string; css: string } => {
    const now = along(plan.boat, t)
    const side = facingAt(turning, t)
    const bow = bowOf(LEAD_BOAT, route.scale, `${once('vbb', span, t)} transform="scale(${f(1 - Math.abs(side))} 1)"`)
    const crew = captain === undefined ? '' : crewOf(flag, route.scale, captain, `${once('vbr', span, t)} transform="translate(${f(-20 * side)} 0)"`)
    return {
      css: `${track('vbp', plan.boat, span)}${facing('vbf', turning, span, s => `scaleX(${f(s)})`)}${facing('vbb', turning, span, s => `scaleX(${f(1 - Math.abs(s))})`)}${facing('vbr', turning, span, s => `translateX(${f(-20 * s)}px)`)}${wakeOf('vbw', plan.boat, span)}`,
      svg: tracked('vbp', span, t, now, `<g ${once('vbf', span, t)} transform="scale(${f(side)} 1)">${hull(once('vbw', span, t))}</g>${bow}${crew}`),
    }
  }
  // The mascot on foot along its course, its legs stepping only where it
  // walks. It is drawn twice: behind the boats while it is ashore, and in
  // front of them while it is on deck or hopping between deck and jetty.
  const onFoot = (span: number): { back: string; front: string; css: string } => {
    const now = along(plan.clawd, t)
    const strides = plan.clawd.filter(leg => leg.stride).map((leg): Span => [leg.from, leg.to])
    const isOnDeck = (leg: Leg): boolean => [leg.at(0), leg.at(1)].some(p => p.y >= DOCK.y - 2 && p.x < JETTY.tip)
    const deck = plan.clawd.filter(isOnDeck).map((leg): Span => [leg.from, leg.to])
    const last = plan.clawd[plan.clawd.length - 1]
    const ends: 0 | 1 = last !== undefined && isOnDeck(last) ? 1 : 0
    const isAtDeck = t >= span ? ends === 1 : deck.some(([from, to]) => t >= from && t < to)
    // Woken in the hammock or on the lounger, it sits up as it gets down, and
    // what of it hangs below the hammock's cloth stays cut away.
    const lying = lyingIn(voyage.clawd)
    const getsUp = lying === undefined ? undefined : plan.clawd[0]
    const pose = lying === 'hammock' ? M_LYING : M_RECLINE
    const lie = getsUp === undefined ? '' : once('vlie', span, t)
    const upAt = getsUp === undefined ? 0 : lying === 'lounger' ? getsUp.from + 0.6 * (getsUp.to - getsUp.from) : getsUp.to
    const sitsUp = getsUp === undefined ? '' : `@keyframes vlie{0%,${pct(getsUp.from, span)}{transform:${pose};animation-timing-function:ease-in-out}${pct(upAt, span)},100%{transform:none}}`
    const turnAt = getsUp === undefined ? 0 : getsUp.from + 0.8 * (getsUp.to - getsUp.from)
    const turnsFront = getsUp !== undefined && lying === 'lounger'
    const turnsCss = !turnsFront ? '' : `@keyframes vfr{0%,${pct(turnAt, span)}{transform:scaleX(0)}${pct(getsUp.to, span)},100%{transform:scaleX(1)}}@keyframes vsd{0%,${pct(upAt, span)}{transform:scaleX(1)}${pct(turnAt, span)},100%{transform:scaleX(0)}}`
    const turn = turnsFront ? { front: once('vfr', span, t), side: once('vsd', span, t) } : undefined
    const walking = tracked('vcp', span, t, now, walker(stepped('vgo', span, t), stepped('vst', span, t), lie, turn))
    const figure = lying === 'hammock' ? `<g clip-path="url(#hung)">${walking}</g>` : walking
    return {
      css: `${track('vcp', plan.clawd, span)}${sitsUp}${turnsCss}${shownIn('vgo', strides, span, 0)}${shownIn('vst', outside(strides, span), span, 1)}${shownIn('vdk', deck, span, ends)}${shownIn('vsh', outside(deck, span), span, ends === 1 ? 0 : 1)}`,
      back: `<g ${stepped('vsh', span, t)}${isAtDeck ? ' opacity="0"' : ''}>${figure}</g>`,
      front: `<g ${stepped('vdk', span, t)}${isAtDeck ? '' : ' opacity="0"'}>${figure}</g>`,
    }
  }
  // What it gets up to on deck runs on the wall clock and is the same from
  // one trip to the next, so it carries on unbroken as one trip gives way to
  // another.
  const acts: Span[] = []
  const antics = isPlain ? '' : anticsCss('ca', timing => `${CAPTAIN_S}s ${timing} ${PHASE} infinite`, [[0, CAPTAIN_S]], CAPTAIN_S, scatter(CAPTAIN_S), false, 11, acts)
  if (voyage.phase === 'fetch') {
    const circuit = `<g style="--u:${route.seconds}s;--b:${f(t - plan.settled + CIRCUIT_START)};--r:${route.rx}px;--q:${route.ry}px;--d:0" transform="translate(${route.cx} ${route.cy})">
<g class="bx"><g class="by"><g class="bf">${hull()}</g>${bowOf(LEAD_BOAT, route.scale, 'class="bw"')}${crewOf(flag, route.scale, '', 'class="br"')}</g></g></g>`
    if (t >= plan.settled) {
      return { boat: circuit, depth, x, sails: 0, early: '', late: '', css: faces + antics }
    }
    const isAboard = voyage.aboard || t >= plan.boards
    const course = under(plan.settled, isAboard ? '' : `${once('vshow', plan.boards, t)} opacity="0"`)
    const foot = isAboard ? { back: '', front: '', css: '' } : onFoot(plan.boards)
    return {
      depth,
      x,
      sails,
      boat: `<g ${once('vhide', plan.settled, t)}>${course.svg}</g><g ${once('vshow', plan.settled, t)} opacity="0">${circuit}</g>`,
      early: isAboard ? '' : `<g ${once('vhide', plan.boards, t)}>${foot.back}</g>`,
      late: isAboard ? '' : `<g ${once('vhide', plan.boards, t)}>${foot.front}</g>`,
      css: faces + antics + course.css + foot.css,
    }
  }
  const day = dayOf(voyage.at, voyage.drill)
  const isRiding = voyage.aboard && t < plan.lands
  const course = plan.boat.length > 0 && t < plan.gone ? under(plan.gone, isRiding ? once('vhide', plan.lands, t) : undefined) : { svg: '', css: '' }
  const isHome = t >= plan.settled
  const at = lifeAt(day, Math.max(0, t - plan.settled))
  // Its day starts as it gets home: until then the day's clock has not begun.
  // What of it would hang below the hammock's cloth is cut away.
  const life = `<g style="--n:${f(isHome ? (t - plan.settled) % day.span : t - plan.settled)}"><g clip-path="url(#hung)"><g class="lpos" transform="translate(${f(at.x)} ${f(at.y)})">${islander()}</g></g><g class="lfront">${LOUNGER_FRONT}</g></g>`
  // Brought home, it rests on deck: an antic it was in the middle of as the
  // trip began plays out, and no other starts.
  const inLoop = (wall: number): number => (wall % 100000) % CAPTAIN_S
  const began = inLoop(voyage.at / 1000)
  const now = inLoop(seconds)
  const act = acts.find(([from, to]) => began > from && began < to)
  const calms = act === undefined || now < began || now >= act[1] ? '' : ['ca', 'caw', 'can']
    .map(part => `.${part}{animation:${part} ${CAPTAIN_S}s ${part === 'ca' ? 'ease-in-out' : 'step-end'} ${f(-now)}s ${f(act[1] / CAPTAIN_S)} forwards}`)
    .join('')
  const css = faces + dayCss(day, rand, voyage.greet, isPlain) + course.css + (isRiding && calms !== '' ? antics + calms : '')
  if (isHome) {
    return { boat: course.svg, depth, x, sails, early: life, late: '', css }
  }
  const foot = onFoot(plan.settled)
  const ashore = (figure: string): string => `<g ${once('vhide', plan.settled, t)}>${isRiding ? `<g ${once('vshow', plan.lands, t)} opacity="0">${figure}</g>` : figure}</g>`
  return {
    depth,
    x,
    sails,
    boat: course.svg,
    early: `<g ${once('vshow', plan.settled, t)} opacity="0">${life}</g>${ashore(foot.back)}`,
    late: ashore(foot.front),
    css: css + foot.css,
  }
}

// A little crab on the wet sand at the front of the beach. It scuttles
// sideways from one spot to the next, rests a while, and now and then waves
// its claws. Its wanderings are one long, irregular round that takes its phase
// from the wall clock, so it is always somewhere on the sand and a redraw
// finds it where it was.
const CRAB_HOME = { x: 1522, y: 747 }
const CRAB = (() => {
  const [lo, hi] = [1480, 1566]
  const pace = 16
  type Stretch = { from: number; to: number; x: number; walks: boolean; waves: boolean }
  const stretches: Stretch[] = []
  let t = 0
  let x = CRAB_HOME.x
  for (let i = 0; i < 9; i++) {
    const rest = 3 + rnd(i, 401) * 10
    stretches.push({ from: t, to: t + rest, x, walks: false, waves: rnd(i, 409) < 0.45 })
    t += rest
    let next = i === 8 ? CRAB_HOME.x : lo + rnd(i, 403) * (hi - lo)
    if (i < 8 && Math.abs(next - x) < 16) {
      next = x + (x < (lo + hi) / 2 ? 1 : -1) * (16 + rnd(i, 407) * 30)
    }
    const walk = Math.abs(next - x) / pace + 0.3
    stretches.push({ from: t, to: t + walk, x: next, walks: true, waves: false })
    t += walk
    x = next
  }
  const whole = Math.round(t * 10) / 10
  const at = (sec: number): string => f((sec / whole) * 100)
  // Sideways, eased into and out of each scuttle: the round's easing applies
  // between each pair of keys, and a rest holds still between its two.
  let across = ''
  let gait = ''
  let still = ''
  let claws = `0%{transform:rotate(0)}`
  let before = CRAB_HOME.x
  for (const run of stretches) {
    if (run.walks) {
      across += `${at(run.from)}%{transform:translateX(${Math.round(before - CRAB_HOME.x)}px)}${at(run.to)}%{transform:translateX(${Math.round(run.x - CRAB_HOME.x)}px)}`
      gait += `${at(run.from)}%{opacity:1}${at(run.to)}%{opacity:0}`
      still += `${at(run.from)}%{opacity:0}${at(run.to)}%{opacity:1}`
    } else if (run.waves && run.to - run.from > 3) {
      const mid = run.from + (run.to - run.from) * 0.4
      claws += `${at(mid)}%{transform:rotate(0)}${at(mid + 0.35)}%{transform:rotate(-38deg)}${at(mid + 0.7)}%{transform:rotate(-24deg)}${at(mid + 1)}%{transform:rotate(-38deg)}${at(mid + 1.4)}%{transform:rotate(0)}`
    }
    before = run.x
  }
  const css = `@keyframes crx{0%{transform:translateX(0)}${across}100%{transform:translateX(0)}}@keyframes crg{0%{opacity:0}${gait}}@keyframes crs{0%{opacity:1}${still}}@keyframes crc{${claws}100%{transform:rotate(0)}}
@keyframes crk{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg)}}
.crx{${loop('crx', whole, 'ease-in-out')}}.crg{${loop('crg', whole, 'step-end')}}.crs{${loop('crs', whole, 'step-end')}}.crc{${loop('crc', whole, 'ease-in-out')}}.crk{${loop('crk', 0.3, 'linear')}}`
  const side = '<path class="crl" d="M-4 -3l-5 -2l-2 4M-3 -2l-5 1l-1 4M-2 -1l-3 3l1 3"/>'
  const legs = `${side}<g transform="scale(-1 1)">${side}</g>`
  const claw = '<g transform="translate(-5 -6)"><g class="crc"><path class="crl" d="M0 0l-4 -4"/><path class="crb" d="M-4 -4q-5 -1 -4 -6q2 2 4 1q0 -3 2 -3q1 4 -2 8z"/></g></g>'
  const svg = `<g transform="translate(${CRAB_HOME.x} ${CRAB_HOME.y})"><ellipse cy="1" rx="9" ry="1.6" class="sh"/><g class="crx">
<g class="crs">${legs}</g><g class="crg"><g transform="translate(0 -3)"><g class="crk"><g transform="translate(0 3)">${side}</g></g><g class="crk" style="--d:.15"><g transform="translate(0 3)"><g transform="scale(-1 1)">${side}</g></g></g></g></g>
<path class="crl" d="M-2 -7v-4M2 -7v-4"/><ellipse cy="-5" rx="7" ry="4.2" class="crb"/><circle cx="-2" cy="-11.5" r="1.2" fill="#2a1a12"/><circle cx="2" cy="-11.5" r="1.2" fill="#2a1a12"/>
${claw}<g transform="scale(-1 1)">${claw}</g></g></g>`
  return { svg, css }
})()

// The beach: a long spit of sand from its tip on the left out past the right
// edge of the view. `grow` widens the outline, for the wet sand and the foam
// round it.
function beach(grow: number): string {
  const tip = BEACH_TIP - grow
  const k = Math.round(grow * 0.75)
  return `M${tip} 698C${tip} ${668 - k} 1280 ${648 - k} ${ISLE} ${648 - k}C1470 ${648 - k} 1560 ${642 - k} 1700 ${644 - k}V${752 + k}C1560 ${752 + k} 1470 ${746 + k} ${ISLE} ${746 + k}C1280 ${746 + k} ${tip} ${728 + k} ${tip} 698Z`
}

// The jetty off the beach's tip, with a mooring post and a lantern at its
// outer end.
const JETTY_ART = `<g class="post" stroke-width="3">${[8, 44, 80].map(dx => `<line x1="${JETTY.tip + dx}" y1="${JETTY.y}" x2="${JETTY.tip + dx}" y2="${JETTY.y + 20}"/>`).join('')}<line x1="${JETTY.tip + 2}" y1="${JETTY.y - 15}" x2="${JETTY.tip + 2}" y2="${JETTY.y + 18}" stroke-width="4"/></g>
<rect x="${JETTY.tip}" y="${JETTY.y - 3}" width="${JETTY.root - JETTY.tip}" height="6" rx="1" class="deck"/>
<path class="post" stroke-width="1" opacity=".5" d="${[22, 44, 66, 88].map(dx => `M${JETTY.tip + dx} ${JETTY.y - 3}v6`).join('')}"/>
<circle cx="${JETTY.tip + 2}" cy="${JETTY.y - 19}" r="3.6" fill="#5a3b22"/><circle class="lit" cx="${JETTY.tip + 2}" cy="${JETTY.y - 19}" r="3"/>`

// A sun lounger and the pole of the parasol over it. The scene draws it
// twice: behind the mascot, and again in front of it while it walks behind.
const lounger = (top: number): string => `<line class="post" stroke-width="2.5" x1="${LOUNGER.x + 16}" y1="${LOUNGER.y - top}" x2="${LOUNGER.x + 16}" y2="${LOUNGER.y + 4}"/>
<path class="post" stroke-width="2" d="M${LOUNGER.x - 32} ${LOUNGER.y}v8M${LOUNGER.x - 2} ${LOUNGER.y - 3}v11"/>
<path d="M${LOUNGER.x - 38} ${LOUNGER.y + 1}L${LOUNGER.x} ${LOUNGER.y - 3}L${LOUNGER.x + 12} ${LOUNGER.y - 14}" fill="none" stroke="#ef6f5e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`

// The lounger under a thatched parasol.
const LOUNGER_ART = `${lounger(50)}
<path d="M${LOUNGER.x - 26} ${LOUNGER.y - 44}Q${LOUNGER.x + 16} ${LOUNGER.y - 86} ${LOUNGER.x + 58} ${LOUNGER.y - 44}Q${LOUNGER.x + 16} ${LOUNGER.y - 54} ${LOUNGER.x - 26} ${LOUNGER.y - 44}Z" fill="url(#roof)"/>`
const LOUNGER_FRONT = lounger(40)

// A thatched bar at the edge of the view, its lamp lit after dark.
const BAR_ART = `<g transform="translate(${BAR.x} ${BAR.y})"><g class="post" stroke-width="4"><line x1="-32" y1="-52" x2="-32" y2="14"/><line x1="32" y1="-52" x2="32" y2="14"/></g>
<rect x="-40" y="-14" width="80" height="28" class="wall"/><rect x="-44" y="-19" width="88" height="6" rx="1" class="deck"/>
<circle cx="-26" cy="-23" r="4" fill="#6b4c2f"/><circle cx="-15" cy="-23" r="4" fill="#3fa35e"/><rect x="6" y="-29" width="4" height="10" fill="#2bb8a6"/>
<path d="M-56 -48L0 -86L56 -48Q0 -40 -56 -48Z" fill="url(#roof)"/><circle class="lit" cx="0" cy="-36" r="4"/></g>`

// Logs on the sand, alight after dark.
const FIRE_ART = `<g transform="translate(${FIRE.x} ${FIRE.y})"><path d="M-10 2L10 -2M-10 -2L10 2" stroke="#6b4c2f" stroke-width="3.2" stroke-linecap="round"/>
<g class="fire"><circle cy="-8" r="34" fill="#ff9f43" opacity=".12"/><circle cy="-8" r="19" fill="#ff9f43" opacity=".16"/>
<path class="flame" d="M0 -18Q8 -8 5 -2Q0 2 -5 -2Q-8 -8 0 -18Z" fill="#ff8f1f"/><path class="flame" style="--d:.3" d="M0 -10Q4 -5 2.5 -1.5Q0 .5 -2.5 -1.5Q-4 -5 0 -10Z" fill="#ffe08a"/></g></g>`

const FLYER = `<path class="ffw" d="M4 -2Q-4 -18 -16 -20Q-8 -10 -4 -1ZM4 2Q-2 12 -12 14Q-6 7 -4 1Z"/><path class="ff" d="M16 0Q6 -5 -10 -1L-18 -7L-15 0L-18 6L-10 1Q6 5 16 0Z"/>`

// A shoal of flying fish: each skips twice across the water, once, as the
// scene is drawn.
function flyingFish(): string {
  const shoal: [number, number, number, number][] = [
    [300, 640, 0.9, 0], [420, 705, 1.15, 0.3], [560, 618, 0.8, 0.55], [600, 750, 1.25, 0.85], [700, 660, 0.95, 1.15], [640, 590, 0.7, 1.45],
  ]
  return shoal
    .map(([x, y, s, d]) => {
      const at = `style="animation-delay:${d}s"`
      const rings = [14, 220, 426]
        .map((cx, k) => `<ellipse class="ffs" cx="${cx}" cy="0" rx="14" ry="3.5" style="animation-delay:${f(d + 0.1 + k * 1.4)}s"/>`)
        .join('')
      return `<g transform="translate(${x} ${y}) scale(${s})"><g clip-path="url(#surf)"><g class="ffX" ${at}><g class="ffY" ${at}><g class="ffR" ${at}>${FLYER}</g></g></g></g>${rings}</g>`
    })
    .join('')
}

const BURSTS = [
  { x: 300, y: 170, c: '#ffd166', d: 0 },
  { x: 1150, y: 120, c: '#ef476f', d: 0.45 },
  { x: 720, y: 90, c: '#06d6a0', d: 0.9 },
  { x: 1450, y: 230, c: '#a78bfa', d: 1.3 },
  { x: 520, y: 260, c: '#ffffff', d: 1.6 },
]

// Each burst's glow on the water, drawn with the sea so the shore covers it,
// `age` seconds into the show.
function fireworkGlow(age: number): string {
  return BURSTS.map(
    ({ x, y, c, d }) =>
      `<ellipse class="fwr" cx="${x}" cy="${f(HORIZON + 30 + (HORIZON - y) * 0.4)}" rx="120" ry="13" fill="${c}" filter="url(#blur6)" style="animation-delay:${f(d + 0.6 - age)}s"/>`,
  ).join('')
}

// The bursts in the sky, `age` seconds into the show: a scene drawn again
// while they go on carries on from where the last one was.
function fireworks(age: number): string {
  return BURSTS
    .map(({ x, y, c, d }) => {
      let spokes = ''
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2
        const x2 = f(Math.cos(a) * 110)
        const y2 = f(Math.sin(a) * 110)
        spokes += `<line x1="${f(Math.cos(a) * 30)}" y1="${f(Math.sin(a) * 30)}" x2="${x2}" y2="${y2}"/><circle cx="${x2}" cy="${y2}" r="4"/>`
      }
      return `<g transform="translate(${x} ${y})">
<line class="trail" x1="0" y1="0" x2="0" y2="40" stroke="${c}" stroke-width="3" stroke-linecap="round" style="animation-delay:${f(d - age)}s"/>
<g class="fw" stroke="${c}" fill="${c}" stroke-width="3" stroke-linecap="round" style="animation-delay:${f(d + 0.6 - age)}s">${spokes}</g></g>`
    })
    .join('')
}

// Pins the scene to day or night when the theme forces a scheme; otherwise the
// frame's own prefers-color-scheme decides.
function styleFor(scheme: 'light' | 'dark' | undefined): string {
  const open = '@media (prefers-color-scheme: dark){'
  const start = STYLE.indexOf(open)
  let depth = 0
  let end = start
  for (; end < STYLE.length; end++) {
    if (STYLE[end] === '{') depth++
    else if (STYLE[end] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  if (scheme === undefined) return STYLE
  const night = STYLE.slice(start + open.length, end)
  const withoutMedia = STYLE.slice(0, start) + STYLE.slice(end + 1)
  return scheme === 'dark' ? withoutMedia + night : withoutMedia
}

// Everything the scene shows of the agent: the boats out on the water for the
// work still running, and the lead boat's flag for what it needs from the
// person.
export type SceneState = {
  mood: Mood
  // One boat per piece of work in flight: the main agent's turn, each
  // subagent's, each background shell. A boat called home is still here while
  // it sails off.
  boats: readonly Boat[]
  // What the lead boat flies for the person's attention.
  flag: Flag
  // The lead boat's trip with the mascot: out to its circuit while the agent
  // works, back to the island when the work is over.
  voyage: Voyage
  isCompacting: boolean
  // A prompt was just sent: the flying fish leap.
  isLeaping: boolean
  // How many seconds the fireworks have been going, while they are.
  fireworks: number | undefined
  scheme: 'light' | 'dark' | undefined
  // The wall clock the looping animations take their phase from.
  seconds: number
}

// What a surface takes as one scene, with room to spare.
export const ROOM = 127000

// The scene as an SVG. One that comes out too long for a surface is drawn
// again plainly: the boats' ways in fewer straight stretches, the mascot
// without its antics.
export function scene(state: SceneState): string {
  const full = draw(state, false)
  return full.length <= ROOM ? full : draw(state, true)
}

function draw(state: SceneState, isPlain: boolean): string {
  const { mood, fireworks: show, isLeaping, scheme, seconds } = state
  const pair = trip(state.voyage, seconds, state.flag, isPlain)
  const boats = fleets(state.boats, seconds, state.flag, isPlain)
  // The near boats and the lead boat among them, painted far to near.
  const lead: Part[] =
    pair.boat === ''
      ? []
      : [{ svg: `<g id="v99">${pair.boat}</g>`, copy: '<use href="#v99"/>', depth: pair.depth(AHEAD_S), depthIn: pair.depth, xIn: pair.x, moving: Math.max(pair.sails, ...boats.near.map(part => part.moving)), ...LEAD_REACH }]
  const around = stack([...boats.near, ...lead].sort((a, b) => a.depth - b.depth), 'zn')

  // The boardwalk and the water villas on it, level with each other.
  const pier = `<path class="post" stroke-width="7" stroke-linecap="round" d="M-20 566H600"/><path class="post" stroke-width="3" d="${[10, 170, 340, 500, 580].map(px => `M${px} 566v26`).join('')}"/>
${bungalow(90, 563, 0.95)}${bungalow(255, 563, 1)}${bungalow(420, 563, 0.95)}`
  const isle = ISLE

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<style>${styleFor(scheme)}${CRAB.css}${boats.css}${pair.css}${around.css}</style>
${DEFS}
<g class="${mood}" style="--t:${f(seconds % 100000)}">
<rect width="${W}" height="${HORIZON + 2}" fill="url(#sky)"/>
${stars()}
<g>
<g class="sunglow"><circle cx="${SUN_X}" cy="${SUN_Y}" r="520" fill="url(#bloom)"/>
<ellipse cx="${SUN_X}" cy="${HORIZON}" rx="640" ry="84" fill="url(#bloom)" opacity=".4"/>
<g class="halo"><g opacity=".45" transform="translate(${SUN_X} ${SUN_Y})"><g class="raysA">${rays(22, 41, 1)}<g opacity=".4">${rays(7, 53, 5)}</g></g><g class="raysB" opacity=".7">${rays(14, 47, 1)}</g></g></g>
<circle cx="${SUN_X}" cy="${SUN_Y}" r="150" fill="url(#corona)"/></g>
<circle class="sun" cx="${SUN_X}" cy="${SUN_Y}" r="46" fill="url(#sund)"/>
</g>
<circle class="moonglow" cx="${SUN_X}" cy="${SUN_Y - 12}" r="260" fill="url(#moonglow)"/>
<g class="moon" transform="translate(${SUN_X} ${SUN_Y - 12})"><circle r="46" fill="#f4f1e4" mask="url(#crescent)"/></g>
<g><g class="drift">${cloud(220, 150, 1)}${cloud(900, 110, 0.8)}${cloud(1500, 180, 1.1)}${cloud(220 + W, 150, 1)}${cloud(900 + W, 110, 0.8)}${cloud(1500 + W, 180, 1.1)}</g>
<g class="drift2">${cloud(600, 270, 0.55)}${cloud(1150, 330, 0.45)}${cloud(600 + W, 270, 0.55)}${cloud(1150 + W, 330, 0.45)}</g>
<rect y="${HORIZON - 60}" width="${W}" height="62" fill="url(#haze)" class="haze"/></g>
<rect y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="url(#sea)"/>
<g><rect y="${HORIZON}" width="${W}" height="1.6" fill="#fff" opacity=".3"/>
<ellipse class="sunglow" cx="${SUN_X}" cy="${HORIZON}" rx="430" ry="44" fill="url(#bloom)" opacity=".35"/>
${farIsland(760, 120)}${farIsland(1010, 70)}
${coralReef(400, 850, 1.1, false, 71)}${coralReef(920, 852, 1, true, 77)}${coralReef(668, 792, 0.6, false, 83)}
<ellipse cx="800" cy="790" rx="300" ry="44" fill="url(#halo)" opacity=".4"/>
<g class="glit"><path d="M${SUN_X - 24} ${HORIZON}L${SUN_X + 24} ${HORIZON}L${SUN_X + 190} ${HORIZON + 430}L${SUN_X - 190} ${HORIZON + 430}Z" class="colm" fill="url(#column)" filter="url(#blur6)"/>
<g class="gcol">${glitter()}</g></g>${show === undefined ? '' : fireworkGlow(show)}</g>
${seaLife()}
<g><g class="wvs">${waves()}</g>${state.isCompacting ? WHIRLPOOL : ''}</g>
<ellipse class="halo" cx="260" cy="570" rx="380" ry="70" fill="url(#halo)" opacity=".85"/>
<g opacity=".18" class="reflit" filter="url(#soft)" transform="translate(0 1184) scale(1 -1)"><use href="#pier"/></g>
<g id="pier">${pier}</g>
<ellipse class="halo" cx="${isle + 90}" cy="705" rx="540" ry="135" fill="url(#halo)"/>
<g>${boats.far.map(part => part.svg).join('')}</g>
<path d="${beach(44)}" class="shoal" opacity=".75" filter="url(#blur6)"/>
<path d="${beach(26)}" fill="none" class="foam foamline" stroke-width="2" opacity=".4" style="--d:4"/>
<path d="${beach(13)}" fill="none" class="foam foamline" stroke-width="3" opacity=".75"/>
<path d="${beach(7)}" class="wet"/><path d="${beach(0)}" fill="url(#sand)"/><path d="${beach(0)}" fill="url(#grain)" opacity=".5"/>
${JETTY_ART}
${TUFTS.map(([x, y, k]) => `<use href="#tuft" transform="translate(${x} ${y}) scale(${k})"/>`).join('')}
${star5(isle - 18, 743, 7)}${star5(isle + 178, 745, 6)}
${palm(isle + 192, 682, 0.8, 44, 4.1)}${palm(isle - 70, 686, 0.95, -30, 0)}${palm(isle + 20, 690, 1.15, 26, 2.2, true)}
<use href="#shrub" transform="translate(${isle - 89} 703)"/><use href="#shrub" transform="translate(${isle + 80} 700) scale(-.82 .82)"/>
<path d="M${isle + 77} 708q-10 -28 0 -58q10 30 0 58z" fill="#ff9f43"/><path d="M${isle + 77} 706v-54" stroke="#fff" stroke-width="1.6"/>
${BAR_ART}${LOUNGER_ART}
${pair.early}
<g><path class="ham" d="M${isle - 75} 610Q${isle - 24} 668 ${isle + 23} 616Q${isle - 24} 642 ${isle - 75} 610Z"/><path d="M${isle - 75} 610Q${isle - 24} 657 ${isle + 23} 616" fill="none" stroke="#ef6f5e" stroke-width="2.2"/></g>
${FIRE_ART}
<g>${around.parts.map(part => part.svg).join('')}${pair.late}</g>
${CRAB.svg}
<g>${sparkles()}
<g class="gulls"><g transform="translate(0 200)"><path class="gull wing" d="M0 0 q10 -10 20 0 q10 -10 20 0" fill="none" stroke-width="3"/></g>
<g transform="translate(70 230)"><path class="gull wing" d="M0 0 q8 -8 16 0 q8 -8 16 0" fill="none" stroke-width="2.5" style="--d:.3"/></g>
<g transform="translate(-40 250)"><path class="gull wing" d="M0 0 q6 -6 12 0 q6 -6 12 0" fill="none" stroke-width="2" style="--d:.55"/></g></g>
${isLeaping ? flyingFish() : ''}
${show === undefined ? '' : fireworks(show)}</g>
</g></svg>`
}
