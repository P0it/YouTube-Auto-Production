import React from "react";
import { Audio } from "remotion";

interface AudioTrackProps {
  src: string;
  startFrom?: number;
  volume?: number;
}

export const AudioTrack: React.FC<AudioTrackProps> = ({
  src,
  startFrom = 0,
  volume = 1,
}) => {
  return <Audio src={src} startFrom={startFrom} volume={volume} />;
};
