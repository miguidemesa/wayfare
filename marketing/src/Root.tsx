import React from "react";
import { Composition, Folder } from "remotion";
import { WayfareAd } from "./WayfareAd";
import { Opening } from "./scenes/Opening";
import { Suggest } from "./scenes/Suggest";
import { MapScene } from "./scenes/MapScene";
import { Budget } from "./scenes/Budget";
import { SideQuest } from "./scenes/SideQuest";
import { EndCard } from "./scenes/EndCard";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="WayfareAd"
      component={WayfareAd}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
    {/* Each scene on its own timeline, like precomps in After Effects. */}
    <Folder name="WayfareAd-Scenes">
      <Composition
        id="Opening"
        component={Opening}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Suggest"
        component={Suggest}
        durationInFrames={165}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Maps"
        component={MapScene}
        durationInFrames={165}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Budget"
        component={Budget}
        durationInFrames={135}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="SideQuest"
        component={SideQuest}
        durationInFrames={165}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="EndCard"
        component={EndCard}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
    </Folder>
  </>
);
