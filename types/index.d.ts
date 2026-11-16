export type Mood = 'idle' | 'working' | 'waiting' | 'done' | 'error'

// What the agent is held on while the mood is `waiting`.
export type Need = 'permission' | 'question' | 'plan'

export type Point = { x: number; y: number }

declare module 'claude-code' {
  interface PluginState {
    maldives: {
      // What the backdrop shows. A `/maldives` preview changes these alone.
      mood: Mood
      need: Need
      crew: number
      shells: number
      // What the agent is really doing, kept by its own events, for
      // `/maldives reset` to go back to.
      live: { mood: Mood; need: Need; crew: number; shells: number }
      compacting: boolean
      // When the fireworks went up (clock ms), or 0 when none are going.
      fireworks: number
      leap: number
      // The light/dark scheme in force, as the store keeps it; whether the
      // control panel above the prompt is shown, and which of its menus is open.
      scheme: 'light' | 'dark' | 'auto'
      // How opaque the app's panels are over the backdrop (0 to 1), and the
      // control panel's language, as the store keeps them.
      glass: number
      lang: 'en' | 'zh'
      controls: boolean
      menu: 'none' | 'appearance' | 'boats' | 'claude' | 'wildlife'
      // Swimmers, gulls and dolphins called up by hand: when (clock ms), and
      // which place beside its lane each keeps while it is out.
      visits: { kind: 'snappers' | 'bannerfish' | 'turtle' | 'manta' | 'ray' | 'whaleShark' | 'fin' | 'dolphins' | 'gulls'; at: number; slot: number }[]
      // The lead boat's trip with the mascot, from the moment it began.
      voyage: { phase: 'fetch' | 'land'; at: number; boat: Point | null; clawd: Point; aboard: boolean; greet: boolean; drill?: 'fish' | 'nap' | 'sun' | 'sip' | 'fire' | 'tour'; exit?: 'L' | 'R'; facing?: number; hop?: { a: Point; b: Point; p: number } }
      // The other boats on the water, with the times each set out and was
      // called home.
      boats: { kind: 'lead' | 'crew' | 'shell'; slot: number; from: 'L' | 'R'; pass: 'over' | 'under'; born: number; gone: number | undefined }[]
    }
  }
}
