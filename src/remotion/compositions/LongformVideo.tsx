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

  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: "#000", position: "relative" }}>
      {assets.map((asset, i) => (
        <ImageScene
          key={i}
          src={asset.assetPath}
          startFrame={msToFrame(asset.startMs)}
          durationFrames={msToFrame(asset.endMs - asset.startMs)}
          animation="kenBurns"
        />
      ))}
      {subtitles.map((sub, i) => (
        <Subtitle
          key={i}
          text={sub.text}
          startFrame={msToFrame(sub.startMs)}
          endFrame={msToFrame(sub.endMs)}
          highlight={sub.highlight}
        />
      ))}
      {audioSegments.map((seg, i) => (
        <Sequence key={i} from={0}>
          <AudioTrack src={seg.filePath} volume={1} />
        </Sequence>
      ))}
    </div>
  );
};
