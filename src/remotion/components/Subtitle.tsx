import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

interface SubtitleProps {
  text: string;
  startFrame: number;
  endFrame: number;
  highlight?: boolean;
  style?: "bottom" | "center";
}

export const Subtitle: React.FC<SubtitleProps> = ({
  text,
  startFrame,
  endFrame,
  highlight = false,
  style = "bottom",
}) => {
  const frame = useCurrentFrame();

  if (frame < startFrame || frame > endFrame) return null;

  const opacity = interpolate(
    frame,
    [startFrame, startFrame + 5, endFrame - 5, endFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: style === "bottom" ? 80 : "auto",
        top: style === "center" ? "50%" : "auto",
        transform: style === "center" ? "translateY(-50%)" : "none",
        width: "100%",
        textAlign: "center",
        opacity,
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontSize: 52,
          fontWeight: "bold",
          color: highlight ? "#FFD700" : "#FFFFFF",
          textShadow: "3px 3px 6px rgba(0,0,0,0.9)",
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: "8px 20px",
          borderRadius: 8,
          display: "inline-block",
        }}
      >
        {text}
      </span>
    </div>
  );
};
