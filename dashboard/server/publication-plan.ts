import type { DashboardState, PublicationPlanItem, PublicationPlanStatus, PublicationLinks, VideoRecord } from "../shared/contracts.js";

interface PlanDefinition {
  id: string;
  locale: "fr-FR" | "en-US";
  scheduledAt: string;
  title: string;
  videoSlug: string;
  defaultStatus?: PublicationPlanStatus;
  note?: string;
}

const LAUNCH_PLAN: PlanDefinition[] = [
  { id: "launch-2026-09-07-fr", locale: "fr-FR", scheduledAt: "2026-09-07T19:00:00+02:00", title: "Oignon et larmes", videoSlug: "oignon-larmes" },
  { id: "launch-2026-09-07-en", locale: "en-US", scheduledAt: "2026-09-07T22:30:00+02:00", title: "Onion and tears", videoSlug: "onions-make-you-cry" },
  { id: "launch-2026-09-08-fr", locale: "fr-FR", scheduledAt: "2026-09-08T19:00:00+02:00", title: "Sang bleu de la pieuvre", videoSlug: "pieuvre-sang-bleu" },
  { id: "launch-2026-09-08-en", locale: "en-US", scheduledAt: "2026-09-08T22:30:00+02:00", title: "Octopus blue blood", videoSlug: "octopus-blue-blood" },
  { id: "launch-2026-09-09-fr", locale: "fr-FR", scheduledAt: "2026-09-09T19:00:00+02:00", title: "Goût sucré des chats", videoSlug: "chat-gout-sucre" },
  { id: "launch-2026-09-09-en", locale: "en-US", scheduledAt: "2026-09-09T22:30:00+02:00", title: "Cats and sweetness", videoSlug: "cats-sweet-taste" },
  { id: "launch-2026-09-10-fr", locale: "fr-FR", scheduledAt: "2026-09-10T19:00:00+02:00", title: "Pattes des canards", videoSlug: "canard-pattes-froides" },
  { id: "launch-2026-09-10-en", locale: "en-US", scheduledAt: "2026-09-10T22:30:00+02:00", title: "Ducks’ cold feet", videoSlug: "ducks-cold-feet" },
  { id: "launch-2026-09-11-fr", locale: "fr-FR", scheduledAt: "2026-09-11T19:00:00+02:00", title: "Wombat corrigé", videoSlug: "wombat-cubes", defaultStatus: "blocked", note: "Corriger le plan de singe avant publication. Le piment peut le remplacer côté FR." },
  { id: "launch-2026-09-11-en", locale: "en-US", scheduledAt: "2026-09-11T22:30:00+02:00", title: "Corrected wombat", videoSlug: "wombat-cube-poop", defaultStatus: "blocked", note: "Corriger le plan de singe avant publication. Reporter si aucune version corrigée n’est prête." },
];

const EMPTY_LINKS: PublicationLinks = { tiktok: "", youtube: "", instagram: "" };

export function publicationPlan(videos: VideoRecord[], state: DashboardState): PublicationPlanItem[] {
  return LAUNCH_PLAN.map((definition) => {
    const saved = state.publicationPlan?.[definition.id];
    const video = videos.find((candidate) => candidate.locale === definition.locale && candidate.relativePath.endsWith(`/${definition.videoSlug}.mp4`));
    return {
      id: definition.id,
      project: "Bizarrement Curieux",
      locale: definition.locale,
      scheduledAt: definition.scheduledAt,
      title: definition.title,
      videoSlug: definition.videoSlug,
      ...(video ? { videoId: video.id } : {}),
      status: saved?.status ?? definition.defaultStatus ?? "scheduled",
      urls: saved?.urls ?? EMPTY_LINKS,
      ...(definition.note ? { note: definition.note } : {}),
    };
  });
}

export const testing = { LAUNCH_PLAN };
