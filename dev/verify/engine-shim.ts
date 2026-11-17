// What hooks/register.tsx imports from 'claude-code' at run time, for the
// fake engine in engine.ts: its state lives in the engine, by atom key.
export type Atom<T> = { ref: { plugin: string; key: string }; initial: T }
type Holder = { read: <T>(atom: Atom<T>) => T; update: <T>(atom: Atom<T>, change: (value: T) => T) => T }

export function atom<T>(ref: { plugin: string; key: string }, initial: T): Atom<T> {
  return { ref, initial }
}

export async function read<T>($: { state: Holder }, atom: Atom<T>): Promise<T> {
  return $.state.read(atom)
}

export async function update<T>($: { state: Holder }, atom: Atom<T>, change: (value: T) => T): Promise<T> {
  return $.state.update(atom, change)
}
