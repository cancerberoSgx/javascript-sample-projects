// Phone niceties for the play screen: sounds (synthesized with WebAudio, no files), vibration,
// keeping the screen awake and fullscreen. Every one of them is optional: browsers without the
// API just skip it.

import { useCallback, useEffect, useState } from "react";

// ---------- Sound ----------

const SOUND_KEY = "trivia.play.sound";
let soundOn = readSoundPref();
let audio: AudioContext | null = null;

function readSoundPref(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

/** Sound on/off for this device (off by default). Turning it on is a tap, which lets audio start. */
export function useSound(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(soundOn);
  const set = useCallback((value: boolean) => {
    soundOn = value;
    setOn(value);
    try {
      localStorage.setItem(SOUND_KEY, value ? "on" : "off");
    } catch {
      // storage unavailable: the choice lasts until reload
    }
    if (value) {
      ctx()?.resume();
      play("turn");
    }
  }, []);
  return [on, set];
}

function ctx(): AudioContext | null {
  if (!audio) {
    try {
      audio = new AudioContext();
    } catch {
      return null;
    }
  }
  return audio;
}

function tone(ac: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = "sine", gain = 0.18) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function clicks(ac: AudioContext, at: number, count: number, spacing: number) {
  const len = Math.floor(ac.sampleRate * 0.025);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  for (let i = 0; i < count; i++) {
    const src = ac.createBufferSource();
    const g = ac.createGain();
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800 + Math.random() * 1600;
    g.gain.value = 0.35 * (1 - i / count / 2);
    src.buffer = buf;
    src.connect(filter).connect(g).connect(ac.destination);
    src.start(at + i * spacing * (0.7 + Math.random() * 0.6));
  }
}

export type SoundName = "turn" | "roll" | "land" | "correct" | "wrong" | "tick" | "win";

export function play(name: SoundName) {
  if (!soundOn) return;
  const ac = ctx();
  if (!ac || ac.state === "closed") return;
  if (ac.state === "suspended") ac.resume();
  const t = ac.currentTime + 0.01;
  switch (name) {
    case "turn":
      tone(ac, 660, t, 0.18);
      tone(ac, 880, t + 0.12, 0.3);
      break;
    case "roll":
      clicks(ac, t, 9, 0.07);
      break;
    case "land":
      tone(ac, 180, t, 0.12, "triangle", 0.3);
      break;
    case "correct":
      tone(ac, 523, t, 0.14, "triangle");
      tone(ac, 659, t + 0.1, 0.14, "triangle");
      tone(ac, 784, t + 0.2, 0.35, "triangle");
      break;
    case "wrong":
      tone(ac, 220, t, 0.22, "sawtooth", 0.09);
      tone(ac, 165, t + 0.18, 0.4, "sawtooth", 0.09);
      break;
    case "tick":
      tone(ac, 1200, t, 0.05, "square", 0.05);
      break;
    case "win":
      [523, 659, 784, 1047].forEach((f, i) => tone(ac, f, t + i * 0.13, i === 3 ? 0.6 : 0.16, "triangle"));
      break;
  }
}

// ---------- Vibration ----------

/** A short buzz on phones that support it (Android; iOS Safari has no vibration API). */
export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // not allowed (e.g. before any tap on the page)
  }
}

// ---------- Screen wake lock ----------

/** Keeps the screen on while `active`, re-taking the lock when the page becomes visible again. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const take = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock.request("screen").then(
        (l) => {
          if (stopped) l.release().catch(() => {});
          else lock = l;
        },
        () => {}, // battery saver, or not allowed: the screen may sleep
      );
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", take);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

// ---------- Fullscreen ----------

/** Fullscreen for the whole page. Unsupported on iPhones (adding to the home screen is the way there). */
export function useFullscreen() {
  const supported = typeof document !== "undefined" && !!document.fullscreenEnabled;
  const [on, setOn] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const fn = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);
  const toggle = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  }, []);
  return { supported, on, toggle };
}
