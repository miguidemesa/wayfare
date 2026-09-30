import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import {
  linearTiming,
  springTiming,
  TransitionSeries,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { C } from "./brand";
import { Grain } from "./ui";
import { Opening } from "./scenes/Opening";
import { Suggest } from "./scenes/Suggest";
import { MapScene } from "./scenes/MapScene";
import { Budget } from "./scenes/Budget";
import { SideQuest } from "./scenes/SideQuest";
import { EndCard } from "./scenes/EndCard";

// 180 + 165 + 165 + 135 + 165 + 150, less 4 × 15 frames of overlap = 900: 30 s at 30 fps.
const push = springTiming({ config: { damping: 200 }, durationInFrames: 15 });
const blend = linearTiming({ durationInFrames: 15 });

export const WayfareAd: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.paper }}>
    <TransitionSeries>
      <TransitionSeries.Sequence name="Opening" durationInFrames={180}>
        <Opening />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-bottom" })}
        timing={push}
      />
      <TransitionSeries.Sequence name="Suggest" durationInFrames={165}>
        <Suggest />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={blend} />
      <TransitionSeries.Sequence
        name="Maps"
        durationInFrames={165}
        premountFor={60}
      >
        <MapScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={push}
      />
      <TransitionSeries.Sequence name="Budget" durationInFrames={135}>
        <Budget />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={blend} />
      <TransitionSeries.Sequence
        name="Side quest"
        durationInFrames={165}
        premountFor={60}
      >
        <SideQuest />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="End card" durationInFrames={150}>
        <EndCard />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Grain />
    {/* The score is generated to this cut by scripts/music.mjs. Levels land the mix
        near -14.5 LUFS (what YouTube and social normalise to) with peaks under 0 dBFS. */}
    <Audio src={staticFile("music.wav")} volume={0.95} />
    {/* Sound design: remotion.media's stock effects, on the cuts and the taps. */}
    <Audio src="https://remotion.media/whoosh.wav" from={2} volume={0.21} />
    <Audio src="https://remotion.media/whoosh.wav" from={78} volume={0.4} />
    <Audio src="https://remotion.media/page-turn.wav" from={164} volume={0.65} />
    <Audio
      src="https://remotion.media/mouse-click.wav"
      from={203}
      volume={0.4}
    />
    <Audio src="https://remotion.media/whoosh.wav" from={312} volume={0.29} />
    <Audio src="https://remotion.media/whoosh.wav" from={463} volume={0.36} />
    <Audio
      src="https://remotion.media/mouse-click.wav"
      from={655}
      volume={0.4}
    />
    <Audio src="https://remotion.media/ding.wav" from={685} volume={0.4} />
    <Audio src="https://remotion.media/whoosh.wav" from={719} volume={0.47} />
  </AbsoluteFill>
);
