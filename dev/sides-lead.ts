import { AT_HOME, embark, planOf } from '../hooks/voyage'
let v = { ...AT_HOME, at: 0 }
let now = 600000
for (let i = 0; i < 4; i++) {
  v = embark(v, 'fetch', now, false)
  let p = planOf(v)
  const show = (legs: typeof p.boat) => legs.map(l => `${Math.round(l.at(0).x)},${Math.round(l.at(0).y)}->${Math.round(l.at(1).x)},${Math.round(l.at(1).y)} h${l.heading} ${l.from.toFixed(1)}-${l.to.toFixed(1)}`).join(' | ')
  console.log('fetch exit', v.exit, show(p.boat))
  now += 120000
  v = embark(v, 'land', now, true)
  p = planOf(v)
  console.log(' land exit', v.exit, show(p.boat), 'gone', p.gone.toFixed(1))
  now += 120000
}
