import React from "react";
import { useVideoConfig } from "remotion";
import { Subtitle } from "../components/Subtitle";
import { ImageScene } from "../components/ImageScene";
import { AudioTrack } from "../components/AudioTrack";
import type { SubtitleEntry, AssetMapping } from "../lib/types";

export interface ShortformVideoProps extends Record<string, unknown> {
  subtitles: SubtitleEntry[];
  assets: AssetMapping[];
  audioSrc: string;
}

export const ShortformVideo: React.FC<ShortformVideoProps> = ({
  subtitles,
  assets,
  audioSrc,
}) => {
  const { fps } = useVideoConfig();
  const msToFrame = (ms: number) => Math.round((ms / 1000) * fps);

  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: "#000", position: "relative" }}>
      {assets.map((asset, i) => (
        <ImageScene
          key={i}
          src={asset.assetPath}
          type={asset.type}
          startFrame={msToFrame(asset.startMs)}
          durationFrames={msToFrame(asset.endMs - asset.startMs)}
          effect={asset.effect}
        />
      ))}
      {subtitles.map((sub, i) => (
        <Subtitle
          key={i}
          text={sub.text}
          startFrame={msToFrame(sub.startMs)}
          endFrame={msToFrame(sub.endMs)}
          highlight={sub.highlight}
          style="center"
        />
      ))}
      <AudioTrack src={audioSrc} volume={1} />
    </div>
  );
};
