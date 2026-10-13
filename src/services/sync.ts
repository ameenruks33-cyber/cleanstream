import type { LibraryState } from '@/types'
import { mergeLibraries, parseLibrary, serializeLibrary } from '@/lib/userLibrary'
import { supabase } from '@/services/supabaseClient'

type RemoteRow = {
  user_id: string
  payload: LibraryState
  updated_at: string
}

export async function pullRemoteLibrary(userId: string): Promise<LibraryState | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('user_libraries')
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.warn('Could not load cloud library.')
    return null
  }
  if (!data) return null
  return parseLibrary(JSON.stringify((data as RemoteRow).payload))
}

export async function pushRemoteLibrary(userId: string, state: LibraryState): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('user_libraries').upsert({
    user_id: userId,
    payload: JSON.parse(serializeLibrary(state)),
    updated_at: new Date().toISOString(),
  })
  if (error) {
    console.warn('Could not sync library.')
  }
}

export async function mergeAndSync(userId: string, local: LibraryState): Promise<LibraryState> {
  const remote = await pullRemoteLibrary(userId)
  const merged = remote ? mergeLibraries(local, remote) : local
  await pushRemoteLibrary(userId, merged)
  return merged
}

export async function deleteRemoteLibrary(userId: string): Promise<void> {
  if (!supabase) return
  await supabase.from('user_libraries').delete().eq('user_id', userId)
}
