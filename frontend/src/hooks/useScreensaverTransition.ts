import { useLayoutEffect, useRef, useState } from "react";

const transitions = ["portal", "parallax", "stardust"] as const;
export type ScreensaverTransition = typeof transitions[number];

/** Symmetric initial odds; subsequent draws exclude only the previous entrance. */
export const chooseScreensaverTransition = (previous: ScreensaverTransition | null, random = Math.random): ScreensaverTransition => {
  const pool = transitions.filter(item => item !== previous);
  return pool[Math.floor(random() * pool.length)];
};

/** Separate from wallpaper selection; inactive (0) and rerenders never draw. */
export const useScreensaverTransition = (sequence: number) => {
  const lastSequence = useRef(0);
  const previous = useRef<ScreensaverTransition | null>(null);
  const [choice, setChoice] = useState<ScreensaverTransition>("portal");
  useLayoutEffect(() => {
    if (!sequence || lastSequence.current === sequence) return;
    lastSequence.current = sequence;
    const next = chooseScreensaverTransition(previous.current);
    previous.current = next;
    setChoice(next);
  }, [sequence]);
  return choice;
};
