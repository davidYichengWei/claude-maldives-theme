const { Resvg } = require('@resvg/resvg-js'); const fs = require('fs')
const nightify = s => { const i = s.indexOf('@media (prefers-color-scheme: dark){'); if (i < 0) return s; let d=0,j=i; for(;j<s.length;j++){ if(s[j]=='{')d++; else if(s[j]=='}'){d--; if(d==0)break;} } const inner=s.slice(s.indexOf('{',i)+1,j); return s.replace('</style>', inner+'</style>') }
const show = { 'd-fish': 'lrod', 'd-nap': 'lnap', 'd-sun': 'lsun', 'd-sip': 'lsip', 'd-walk': 'lgait' }
for (const file of fs.readdirSync('.').filter(n => /^fr-.*\.svg$/.test(n))) {
  const name = file.slice(3, -4)
  let s = fs.readFileSync(file, 'utf8')
  if (show[name]) s = s.replace(`class="${show[name]}" opacity="0"`, `class="${show[name]}"`)
  if (name === 'd-nap') s = s.replace('<g class="lawake">', '<g class="lawake" opacity="0">')
  s = s.replace(/<g class="sw[RL]" style="[^"]*">/g, '<g transform="translate(-900 0)">')
  fs.writeFileSync(`fr-${name}.png`, new Resvg(s, { fitTo: { mode: 'width', value: 3200 } }).render().asPng())
}
