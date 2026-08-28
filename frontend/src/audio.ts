import { useSyncExternalStore } from "react";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

type State = { url: string | null; playing: boolean; loading: boolean };

let state: State = { url: null, playing: false, loading: false };
const listeners = new Set<() => void>();
let player: AudioPlayer | null = null;

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function ensurePlayer(): AudioPlayer {
  if (player) return player;
  player = createAudioPlayer();
  player.addListener("playbackStatusUpdate", (status: any) => {
    if (!status) return;
    if (status.didJustFinish) {
      emit({ playing: false, loading: false });
      return;
    }
    if (typeof status.playing === "boolean" && status.playing) {
      emit({ playing: true, loading: false });
    }
  });
  return player;
}

export async function playUrl(url: string): Promise<void> {
  try {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
  } catch {
    /* ignore */
  }
  const p = ensurePlayer();
  emit({ url, loading: true, playing: false });
  try {
    p.replace({ uri: url });
    p.play();
  } catch (e) {
    emit({ loading: false, playing: false });
    throw e;
  }
}

export function stopAudio(): void {
  try {
    player?.pause();
  } catch {
    /* ignore */
  }
  emit({ playing: false, loading: false });
}

function getSnapshot() {
  return state;
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useAudio() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...s, play: playUrl, stop: stopAudio };
}
