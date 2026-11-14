export type Mood = 'idle' | 'working' | 'waiting' | 'done' | 'error'

// What the agent is held on while the mood is `waiting`.
export type Need = 'permission' | 'question' | 'plan'

export type Point = { x: number; y: number }

declare module 'claude-code' {
  interface PluginState {
    maldives: {
      mood: Mood
      need: Need
      crew: number
      shells: number
      compacting: boolean
      fireworks: number
      leap: number
      // The lead boat's trip with the mascot, from the moment it began.
      voyage: { phase: 'fetch' | 'land'; at: number; boat: Point | null; clawd: Point; aboard: boolean; greet: boolean; drill?: 'fish' | 'nap' | 'sun' | 'sip' | 'fire' | 'tour'; exit?: 'L' | 'R' }
      // The other boats on the water, with the times each set out and was
      // called home.
      boats: { kind: 'lead' | 'crew' | 'shell'; slot: number; from: 'L' | 'R'; pass: 'over' | 'under'; born: number; gone: number | undefined }[]
    }
  }
}
