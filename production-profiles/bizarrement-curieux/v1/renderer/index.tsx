import React from "react";
import {
  AbsoluteFill,
  Audio,
  Composition,
  OffthreadVideo,
  Sequence,
  interpolate,
  registerRoot,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";
import episodes from "./render-data.json";

const FPS = 30;
const DURATION = 900;
const WHITE = "#FFFFFF";
const SHADOW = "0 3px 5px rgba(0,0,0,.98), 0 0 22px rgba(0,0,0,.78)";
const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;

type Episode = (typeof episodes)[number];

const EditorialQuestionOpen: React.FC<{episode: Episode}> = ({episode}) => {
  const frame = useCurrentFrame();
  if (frame > 86) return null;
  const label = spring({frame, fps: FPS, config: {damping: 16, stiffness: 210}});
  const first = spring({frame: frame - 5, fps: FPS, config: {damping: 15, stiffness: 190}});
  const second = spring({frame: frame - 12, fps: FPS, config: {damping: 15, stiffness: 190}});
  const exit = interpolate(frame, [74, 86], [1, 0], clamp);
  const firstSize = episode.title[0].length > 20 ? 57 : 72;
  const secondSize = episode.title[1].length > 18 ? 66 : 82;
  return (
    <div style={{position: "absolute", top: 150, left: 78, width: 810, opacity: exit, textShadow: SHADOW}}>
      <div style={{display: "flex", alignItems: "center", gap: 15, opacity: label, transform: `translateY(${(1 - label) * -20}px)`}}>
        <div style={{width: 64, height: 5, background: episode.accent}} />
        <div style={{fontSize: 36, fontWeight: 850, color: WHITE}}>{episode.ui.formatLabel}</div>
      </div>
      <div style={{marginTop: 20, color: WHITE, fontSize: firstSize, lineHeight: 1.04, fontWeight: 900, opacity: first, transform: `translateX(${(1 - first) * -54}px)`}}>{episode.title[0]}</div>
      <div style={{marginTop: 5, color: episode.accent, fontSize: secondSize, lineHeight: 1.04, fontWeight: 900, opacity: second, transform: `translateX(${(1 - second) * -72}px)`}}>{episode.title[1]}</div>
    </div>
  );
};

const KeywordCallout: React.FC<{episode: Episode}> = ({episode}) => {
  const frame = useCurrentFrame();
  const item = episode.callouts.find(({start, end}) => frame >= start * FPS && frame < end * FPS);
  if (!item) return null;
  const local = frame - item.start * FPS;
  const total = (item.end - item.start) * FPS;
  const enter = spring({frame: local, fps: FPS, config: {damping: 17, stiffness: 220}});
  const exit = interpolate(local, [total - 7, total], [1, 0], clamp);
  const size = item.title.length > 22 ? 52 : item.title.length > 17 ? 58 : 68;
  return (
    <div style={{position: "absolute", top: 145, left: 78, width: 805, opacity: enter * exit, textShadow: SHADOW}}>
      <div style={{display: "flex", alignItems: "center", gap: 14}}>
        <div style={{height: 42, width: 5, background: episode.accent, transform: `scaleY(${enter})`}} />
        <div style={{fontSize: 32, color: episode.accent, fontWeight: 850}}>{item.eyebrow}</div>
      </div>
      <div style={{marginTop: 10, fontSize: size, lineHeight: 1.04, color: WHITE, fontWeight: 900, transform: `translateX(${(1 - enter) * -42}px)`}}>{item.title}</div>
    </div>
  );
};

const DynamicCaptions: React.FC<{episode: Episode}> = ({episode}) => {
  const frame = useCurrentFrame();
  const time = frame / FPS;
  const item = episode.captions.find((caption) => time >= caption.start && time < caption.end);
  if (!item) return null;
  const local = frame - item.start * FPS;
  const total = Math.max(1, (item.end - item.start) * FPS);
  const enter = spring({frame: local, fps: FPS, config: {damping: 16, stiffness: 240, mass: 0.65}});
  const exit = interpolate(local, [total - 2, total], [1, 0], clamp);
  const escaped = item.accent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = item.text.split(new RegExp(`(${escaped})`, "i"));
  return (
    <div style={{position: "absolute", left: 105, top: 1470, width: 790, minHeight: 168, display: "flex", justifyContent: "center", alignItems: "center", opacity: exit}}>
      <div style={{maxWidth: 790, padding: "13px 22px 16px", borderRadius: 8, background: "rgba(7,10,12,.56)", boxShadow: "0 8px 28px rgba(0,0,0,.22)", color: WHITE, fontSize: 58, lineHeight: 1.08, fontWeight: 820, textAlign: "center", transform: `scale(${0.96 + enter * 0.04})`}}>
        {parts.map((part, index) => part.toLocaleLowerCase(episode.locale) === item.accent.toLocaleLowerCase(episode.locale)
          ? <span key={index} style={{color: episode.accent}}>{part}</span>
          : <React.Fragment key={index}>{part}</React.Fragment>)}
      </div>
    </div>
  );
};

const EditorialOutro: React.FC<{episode: Episode}> = ({episode}) => {
  const frame = useCurrentFrame();
  const start = Math.max(24, episode.voiceEnd - 2.4) * FPS;
  if (frame < start) return null;
  const local = frame - start;
  const label = spring({frame: local, fps: FPS, config: {damping: 17, stiffness: 210}});
  const title = spring({frame: local - 9, fps: FPS, config: {damping: 14, stiffness: 190}});
  const signature = spring({frame: local - 62, fps: FPS, config: {damping: 18, stiffness: 180}});
  return (
    <div style={{position: "absolute", top: 180, left: 78, width: 820, textShadow: SHADOW}}>
      <div style={{fontSize: 34, color: WHITE, fontWeight: 800, opacity: label, transform: `translateY(${(1 - label) * -18}px)`}}>{episode.ui.outroLabel}</div>
      <div style={{fontSize: 96, color: episode.accent, lineHeight: 1, fontWeight: 950, marginTop: 12, opacity: title, transform: `translateX(${(1 - title) * -56}px)`}}>{episode.ui.outroAction}</div>
      <div style={{display: "flex", alignItems: "center", gap: 14, marginTop: 18, opacity: signature}}>
        <div style={{width: 52, height: 5, background: episode.accent}} />
        <div style={{fontSize: 32, color: WHITE, fontWeight: 850}}>{episode.ui.outroSignature}</div>
      </div>
    </div>
  );
};

const EpisodeVideo: React.FC<{episode: Episode}> = ({episode}) => {
  const frame = useCurrentFrame();
  const musicFade = interpolate(frame, [810, 894], [1, 0], clamp);
  return (
    <AbsoluteFill style={{backgroundColor: "#000", fontFamily: "Arial, Helvetica, sans-serif", overflow: "hidden"}}>
      <OffthreadVideo src={staticFile(`${episode.id}/base.mp4`)} muted />
      <Audio src={staticFile(`${episode.id}/voice.mp3`)} volume={1} />
      <Audio src={staticFile("music-bed.wav")} volume={0.42 * musicFade} />
      <Sequence from={Math.round(episode.jingleStart * FPS)}><Audio src={staticFile("jingle.wav")} volume={0.8} /></Sequence>
      <EditorialQuestionOpen episode={episode} />
      <KeywordCallout episode={episode} />
      <EditorialOutro episode={episode} />
      <DynamicCaptions episode={episode} />
    </AbsoluteFill>
  );
};

const Root: React.FC = () => <>{episodes.map((episode) => (
  <Composition key={episode.id} id={episode.id} component={EpisodeVideo} defaultProps={{episode}} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
))}</>;

registerRoot(Root);
