import React from "react";
import { useVideoConfig, Sequence } from "remotion";
import { Subtitle } from "../components/Subtitle";
import { ImageScene } from "../components/ImageScene";
import { AudioTrack } from "../components/AudioTrack";
import type { SubtitleEntry, AssetMapping, AudioSegment } from "../lib/types";

export interface LongformVideoProps extends Record<string, unknown> {
  subtitles: SubtitleEntry[];
  assets: AssetMapping[];
  audioSegments: AudioSegment[];
}

export const LongformVideo: React.FC<LongformVideoProps> = ({
  subtitles,
  assets,
  audioSegments,
}) => {
  const { fps } = useVideoConfig();
  const msToFrame = (ms: number) => Math.round((ms / 1000) * fps);

  let audioCursorMs = 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0a0a",
        position: "relative",
      }}
    >
      {assets.map((asset, i) => (
        <ImageScene
          key={`asset-${i}`}
          src={asset.assetPath}
          type={asset.type}
          startFrame={msToFrame(asset.startMs)}
          durationFrames={msToFrame(asset.endMs - asset.startMs)}
          effect={asset.effect}
        />
      ))}

      {subtitles.map((sub, i) => (
        <Subtitle
          key={`sub-${i}`}
          text={sub.text}
          startFrame={msToFrame(sub.startMs)}
          endFrame={msToFrame(sub.endMs)}
          highlight={sub.highlight}
        />
      ))}

      {audioSegments.map((seg, i) => {
        const fromFrame = msToFrame(audioCursorMs);
        audioCursorMs += seg.durationMs;
        return (
          <Sequence key={`audio-${i}`} from={fromFrame}>
            <AudioTrack src={seg.filePath} volume={1} />
          </Sequence>
        );
      })}
    </div>
  );
};
