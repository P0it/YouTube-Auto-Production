import React from "react";
import { useCurrentFrame, interpolate, Img, OffthreadVideo } from "remotion";
import type { CinematicEffect } from "../lib/types";

interface SceneProps {
  src: string;
  type: "image" | "video";
  startFrame: number;
  durationFrames: number;
  effect?: CinematicEffect;
  /** Fade overlap length in frames for crossfade with neighbors. */
  fadeFrames?: number;
}

const DEFAULT_FADE = 12;

function effectTransform(
  effect: CinematicEffect,
  progress: number
): { scale: number; x: number; y: number } {
  const p = Math.max(0, Math.min(1, progress));
  switch (effect) {
    case "kenBurnsIn":
      return { scale: 1 + 0.12 * p, x: -2 * p, y: -1 * p };
    case "kenBurnsOut":
      return { scale: 1.12 - 0.12 * p, x: 2 * p, y: 1 * p };
    case "pushIn":
      return { scale: 1 + 0.08 * p, x: 0, y: 0 };
    case "pullOut":
      return { scale: 1.1 - 0.1 * p, x: 0, y: 0 };
    case "panLeft":
      return { scale: 1.08, x: -4 * p, y: 0 };
    case "panRight":
      return { scale: 1.08, x: 4 * p, y: 0 };
    case "static":
    default:
      return { scale: 1, x: 0, y: 0 };
  }
}

export const ImageScene: React.FC<SceneProps> = ({
  src,
  type,
  startFrame,
  durationFrames,
  effect = "kenBurnsIn",
  fadeFrames = DEFAULT_FADE,
}) => {
  const frame = useCurrentFrame();
  const endFrame = startFrame + durationFrames;

  if (frame < startFrame - 1 || frame > endFrame + 1) return null;

  const localFrame = frame - startFrame;
  const progress = localFrame / Math.max(durationFrames, 1);

  const { scale, x, y } = effectTransform(effect, progress);

  const opacity = interpolate(
    localFrame,
    [0, fadeFrames, durationFrames - fadeFrames, durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const transform = `translate(${x}%, ${y}%) scale(${scale})`;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        opacity,
        overflow: "hidden",
      }}
    >
      {type === "video" ? (
        <OffthreadVideo
          src={src}
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform,
          }}
        />
      ) : (
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform,
          }}
        />
      )}
    </div>
  );
};
