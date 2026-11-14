import { muster } from '../hooks/fleet'
let fleet = muster([], { lead: 0, crew: 1, shell: 0 }, 1000)
const out: string[] = []
for (let i = 0; i < 4; i++) {
  const boat = fleet.find(b => b.gone === undefined)
  out.push(`in ${boat?.from} -> out ${boat?.from === 'L' ? 'R' : 'L'}`)
  fleet = muster(fleet, { lead: 0, crew: 0, shell: 0 }, 100000 * (i + 1))
  fleet = muster(fleet, { lead: 0, crew: 1, shell: 0 }, 100000 * (i + 1) + 500000)
}
console.log(out.join(' | '))
