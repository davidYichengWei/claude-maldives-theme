import { muster, LEAVE_S } from '../hooks/fleet'
import type { Boat } from '../hooks/fleet'
const show = (f: readonly Boat[]) => f.map(b => `${b.kind}${b.slot}@${b.born}${b.gone === undefined ? '' : '>' + b.gone}`).join(' ')
let f: readonly Boat[] = []
f = muster(f, { lead: 1, crew: 0, shell: 3 }, 1000); console.log('t1  ', show(f))
f = muster(f, { lead: 1, crew: 2, shell: 1 }, 5000); console.log('t5  ', show(f))
f = muster(f, { lead: 1, crew: 2, shell: 2 }, 6000); console.log('t6  ', show(f))
f = muster(f, { lead: 0, crew: 9, shell: 2 }, 9000); console.log('t9  ', show(f))
f = muster(f, { lead: 1, crew: 5, shell: 2 }, 10000); console.log('t10 ', show(f))
f = muster(f, { lead: 1, crew: 5, shell: 2 }, 10000 + LEAVE_S * 1000); console.log('later', show(f))
f = muster(f, { lead: 0, crew: 0, shell: 0 }, 50000); f = muster(f, { lead: 1, crew: 0, shell: 0 }, 51000); f = muster(f, { lead: 0, crew: 0, shell: 0 }, 52000); f = muster(f, { lead: 1, crew: 0, shell: 0 }, 53000)
console.log('churn', show(f))
