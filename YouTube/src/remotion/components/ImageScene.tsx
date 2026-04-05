import React from "react";
import { useCurrentFrame, interpolate, Img } from "remotion";

interface ImageSceneProps {
  src: string;
  startFrame: number;
  durationFrames: number;
  animation?: "kenBurns" | "fadeIn" | "none";
}

export const ImageScene: React.FC<ImageSceneProps> = ({
  src,
  startFrame,
  durationFrames,
  animation = "kenBurns",
}) => {
  const frame = useCurrentFrame();
  const endFrame = startFrame + durationFrames;

  if (frame < startFrame || frame > endFrame) return null;

  const localFrame = frame - startFrame;
  const progress = localFrame / durationFrames;

  let scale = 1;
  let opacity = 1;

  if (animation === "kenBurns") {
    scale = interpolate(progress, [0, 1], [1, 1.15]);
  }

  if (animation === "fadeIn" || animation === "kenBurns") {
    opacity = interpolate(
      localFrame,
      [0, 15, durationFrames - 15, durationFrames],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
  }

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
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
};
