import React from "react";
import { Composition } from "remotion";
import { LongformVideo } from "./compositions/LongformVideo";
import { ShortformVideo } from "./compositions/ShortformVideo";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="LongformVideo"
        component={LongformVideo}
        durationInFrames={30 * 60 * 10}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          subtitles: [],
          assets: [],
          audioSegments: [],
        }}
      />
      <Composition
        id="ShortformVideo"
        component={ShortformVideo}
        durationInFrames={30 * 60}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          subtitles: [],
          assets: [],
          audioSrc: "",
        }}
      />
    </>
  );
};
