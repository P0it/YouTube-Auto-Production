import { Composition } from "remotion";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="LongformVideo"
        component={() => <div>Longform Placeholder</div>}
        durationInFrames={30 * 60 * 10}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
