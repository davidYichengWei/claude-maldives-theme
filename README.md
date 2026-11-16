# Maldives theme for Claude

An animated Maldives lagoon behind your conversations in the Claude desktop app. The scene follows what Claude is doing, and Clawd, the little pixel mascot, lives in it.

| Day | Night |
| --- | --- |
| ![The lagoon by day](docs/day.jpg) | ![The lagoon at night](docs/night.jpg) |

## What it does

- **While Claude works**, a sailboat fetches Clawd from the island jetty and roams the lagoon with Clawd on deck, from the near water off the villas out to the far water beyond them. On deck Clawd fishes over the side, looks out through a spyglass, hums to itself and hops, waves and leans in between.
- **When Claude waits on you** (a permission, a question or a plan to approve), the boat flies a flag and its lamp lights up, and Clawd waves.
- **When the turn is over**, the boat brings Clawd back to the jetty and sails off. Clawd walks home and lives its own day on the island: it fishes off the jetty, naps in the hammock, sunbathes on the lounger, has a drink at the bar and warms up by the fire, in an order that is never quite the same.
- **Background shells and subagents** show up as fishing boats and dinghies on the water.
- **Shipping work** (`git push`, `gh pr create`, or a tool that opens a pull or merge request) sets off fireworks.
- **Compacting** the conversation draws a slow whirlpool, and sending a prompt sets the fish leaping.
- **A coral reef** runs along the near shallows, full of life: clownfish in its anemones, a moray eel in the rocks, an octopus, a stingray, angelfish, butterflyfish, a parrotfish, a pufferfish, and schools of blue tangs, humbug damsels and clownfish swimming to and fro along it. Further out, coral heads dot the lagoon floor under slanting shafts of light, and now and then an eagle ray glides by.
- **Wildlife** comes and goes on its own: dolphins, a turtle, a manta, schools of bluestriped snappers and bannerfish, and now and then a whale shark gliding far out under the lagoon. A grey heron wades, fishes and drinks in the shallows off the beach and on the sand behind the palms, circling above the water villas a few times as it flies between them; a crab and a hermit crab wander the sand.
- **The horizon** shows the atoll in two groups with open sea between them: a large palm island sharing its lagoon with a sandbank and a resort's row of overwater villas, whose windows light up at night, and further right a middling island with a small one beside it. Every island sits on white sand that fades into a turquoise halo of shallows.
- The scene follows the app's light or dark appearance: sun and clouds by day; moon, stars, lit villas and glowing plankton along the shore and in the boats' wakes by night.

The backdrop is drawn by the Claude desktop app (and the mobile app). In a terminal the theme sets its colours only.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install maldives --marketplace davidYichengWei/claude-maldives-theme
```

Answer `y` to add the marketplace, then pick a scope (the user scope makes it apply to every session).

From a shell:

```bash
claude plugin install maldives --marketplace davidYichengWei/claude-maldives-theme
```

In the desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `davidYichengWei/claude-maldives-theme`, then **Add plugin**.

## Commands

`/maldives panel` shows or hides the **Control Panel** above the prompt. Its top row holds four menus, **Reset** (back to what Claude is really doing: its state, subagents and background shells) and **Close**; a menu opens its buttons on the rows below, and pressing it again closes them. **Appearance**: light, dark or auto; the panel's language, English or 中文; and the panel opacity, how opaque the app's panels are over the backdrop (0% to 80%, 10% unless chosen), so their text reads more easily. The language and opacity are kept for the next session. **Boats**: dinghies and fishing boats, − / + each. **Clawd**: Claude's state as Clawd shows it (idle, working or error; idle also stands for a finished turn), fireworks, what it waits on, and, while it is idle or done and Clawd is ashore, Clawd's pastime on the island, each named for where it is spent (fishing, hammock, lounger, bar, fire pit) so it reads right by day and by night. **Wildlife**: call up one more of a passer-by, under the water (snappers, bannerfish, turtle, manta, eagle ray), at the surface (whale shark, shark, a dolphin leap, and the flying fish, which leap as when a prompt is sent and are lit until they are back in the water) or in the sky (gulls); it crosses once beside the ones already out, which carry on. While any of a kind are out its button is lit and counts them (Turtle ×2); with three out it is dimmed until one has gone by. The current choice is highlighted: the scheme, Claude's state, what it waits on and Clawd's pastime.

`/maldives <what>` previews a state or changes the look. A preview only changes what the backdrop shows; Claude's next real event takes over again, or `reset` brings back what Claude is doing right away:

| Command | What it does |
| --- | --- |
| `idle`, `working`, `done`, `error` | Show that state |
| `permission`, `question`, `plan` | Show Claude waiting on you for that |
| `crew [0-5]`, `shells [0-5]` | Put that many dinghies or fishing boats on the water |
| `fireworks` | Fireworks over the lagoon |
| `island fish`, `nap`, `sun`, `sip`, `fire` | Send Clawd straight to that pastime on the island |
| `island tour` | A short turn at every pastime, about two minutes in all |
| `visit snappers`, `bannerfish`, `turtle`, `manta`, `ray`, `whaleShark`, `fin`, `dolphins`, `gulls` | Call up one more of that kind, as the Wildlife menu does |
| `light`, `dark`, `auto` | Force a light or dark scene, or follow the app again |
| `reset` | Drop the previews and show what Claude is really doing: its state, the subagents and background shells it has running |
| `panel` | Show or hide the Control Panel above the prompt |
| `debug` | Print what the backdrop is showing and when it was last drawn |

## Developing

The plugin is a Claude Code hooks module: `hooks/register.tsx` wires it to Claude's events, `hooks/scene.ts` draws the SVG scene, `hooks/voyage.ts` plans the boat trips and Clawd's day, and `hooks/fleet.ts` the other boats. `hooks/make-colors.js` is generated by Claude Code's theme tooling and is kept as it is.

`claude plugin test .` runs the Control Panel's tests in `test/`.

To run your working copy, add the folder as a marketplace and install from it; after an edit, `/reload-plugins` picks the change up:

```bash
claude plugin marketplace add /path/to/claude-maldives-theme
```

```bash
claude plugin install maldives@claude-maldives-theme
```

`claude plugin validate .` checks the manifest and the module. The scripts in `dev/` check the scene without the app (`npm install` there first):

| Script | What it checks |
| --- | --- |
| `npm run fuzz` | Hundreds of random trips build valid CSS |
| `npm run size` | The scene stays under the size the app accepts |
| `npm run states` | Every state renders; boat routes keep clear of the island and the jetty |
| `npm run frames` | Renders still frames of a trip and of Clawd's day to PNG |
| `npm run fleet`, `npm run sides` | Boats come and go, and alternate the edge they use |

## 中文说明

一个给 Claude 桌面 App 用的马尔代夫主题：背景是会动的泻湖，跟着 Claude 的状态变化。Claude 工作时，帆船把 Clawd 从岛上的码头接走，载着它在泻湖里四处巡游，从水屋前的近海一直开到远处的海面；Clawd 在船上会钓鱼、举望远镜看风景、哼歌；需要你确认时，船上挂旗、亮灯；工作结束后，船把 Clawd 送回码头，它在岛上过自己的一天，钓鱼、睡吊床、晒太阳、去吧台喝东西、烤火，每天的安排都不一样。安装和命令见上文。

## License

MIT
