import { useEffect, useMemo, useState } from "react";
import {
  BookOpen, CalendarDays, Check, CheckCircle2, ChevronLeft, CircleAlert, Clipboard, Download, ExternalLink,
  FileVideo2, FlaskConical, Library, Lightbulb, Link, LoaderCircle, LockKeyhole, MoreHorizontal,
  Play, RefreshCw, Save, Search, Send, SlidersHorizontal, Smartphone, UsersRound, X, Youtube,
} from "lucide-react";
import type { Account, PublicationPlanItem, PublicationPlanStatus, VideoRecord } from "../../shared/contracts";
import * as api from "./api";

type FilterState = { query: string; locale: string; kind: string; status: string };
type View = "videos" | "calendar" | "accounts";
type ProjectGroup = { key: string; label: string; videos: VideoRecord[] };
const initialFilters: FilterState = { query: "", locale: "all", kind: "all", status: "all" };

export function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [publicationPlan, setPublicationPlan] = useState<PublicationPlanItem[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<VideoRecord>();
  const [view, setView] = useState<View>("videos");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [apiGuideOpen, setApiGuideOpen] = useState(false);
  const [youtubeGuideOpen, setYoutubeGuideOpen] = useState(false);

  useEffect(() => { void api.session().then(setAuthenticated); }, []);
  useEffect(() => { if (authenticated) void reload(); }, [authenticated]);

  async function reload(refresh = false) {
    setBusy(true);
    try {
      const [items, destinations, planned] = await Promise.all([
        refresh ? api.refreshVideos() : api.loadVideos(), api.loadAccounts(), api.loadPublicationPlan(),
      ]);
      setVideos(items); setAccounts(destinations); setPublicationPlan(planned);
      if (selected) setSelected(items.find((item) => item.id === selected.id));
    } catch (error) { setNotice(message(error)); }
    finally { setBusy(false); }
  }

  const visible = useMemo(() => videos.filter((video) => {
    const query = filters.query.trim().toLowerCase();
    if (query && !`${video.title} ${video.relativePath}`.toLowerCase().includes(query)) return false;
    if (filters.locale !== "all" && video.locale !== filters.locale) return false;
    if (filters.kind !== "all" && video.kind !== filters.kind) return false;
    if (filters.status === "approved" && video.humanStatus !== "approved") return false;
    if (filters.status === "ready" && !video.canPublish) return false;
    if (filters.status === "sent" && !video.publications.some((item) => item.status === "sent-to-inbox")) return false;
    return true;
  }), [videos, filters]);

  if (authenticated === null) return <LoadingScreen />;
  if (!authenticated) return <PairScreen onSuccess={() => setAuthenticated(true)} />;

  const selectView = (next: View) => { setView(next); setFiltersOpen(false); if (next !== "videos") setSelected(undefined); };
  return <div className="app-shell">
    <header className="app-toolbar">
      <button className="brand" type="button" onClick={() => selectView("videos")} aria-label="Ouvrir la médiathèque"><span className="brand-mark">SF</span><strong>Shortform Forge</strong></button>
      <nav className="view-switcher" aria-label="Navigation principale">
        <NavButton active={view === "videos"} icon={<Library />} label="Vidéos" onClick={() => selectView("videos")} />
        <NavButton active={view === "calendar"} icon={<CalendarDays />} label="Calendrier" onClick={() => selectView("calendar")} />
        <NavButton active={view === "accounts"} icon={<UsersRound />} label="Comptes" onClick={() => selectView("accounts")} />
      </nav>
      <div className="toolbar-actions">
        {view === "videos" && <label className="toolbar-search"><Search /><input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Rechercher" /></label>}
        {view === "videos" && <button className={`icon-button ${filtersOpen ? "active" : ""}`} title="Filtrer les vidéos" onClick={() => setFiltersOpen((value) => !value)}><SlidersHorizontal /></button>}
        <button className="icon-button refresh-button" title="Actualiser" onClick={() => void reload(true)} disabled={busy}><RefreshCw className={busy ? "spin" : ""} /></button>
      </div>
    </header>
    <div className={`workspace ${selected ? "with-inspector" : ""}`}>
      <main className="workspace-main">
        {view === "videos" && <MediaLibrary videos={visible} selectedId={selected?.id} filters={filters} filtersOpen={filtersOpen} onFiltersChange={setFilters} onOpen={setSelected} />}
        {view === "calendar" && <CalendarView items={publicationPlan} videos={videos} onOpen={setSelected} onChanged={(next) => setPublicationPlan((current) => current.map((item) => item.id === next.id ? next : item))} onNotice={setNotice} />}
        {view === "accounts" && <AccountsView accounts={accounts} onGuide={() => setApiGuideOpen(true)} onYouTubeGuide={() => setYoutubeGuideOpen(true)} onConnect={async (id) => { try { window.location.assign((await api.connectAccount(id)).url); } catch (error) { setNotice(message(error)); } }} />}
      </main>
      {selected && <VideoInspector video={selected} accounts={accounts} onClose={() => setSelected(undefined)} onChanged={(next) => { setVideos((current) => current.map((item) => item.id === next.id ? next : item)); setSelected(next); }} onNotice={setNotice} />}
    </div>
    {apiGuideOpen && <TikTokApiGuide onClose={() => setApiGuideOpen(false)} onNotice={setNotice} />}
    {youtubeGuideOpen && <YouTubeApiGuide onClose={() => setYoutubeGuideOpen(false)} onNotice={setNotice} />}
    {notice && <div className="toast" role="status"><CircleAlert /><span>{notice}</span><button title="Fermer" onClick={() => setNotice(undefined)}><X /></button></div>}
  </div>;
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) { return <button className={active ? "active" : ""} onClick={onClick}>{icon}<span>{label}</span></button>; }

function MediaLibrary({ videos, selectedId, filters, filtersOpen, onFiltersChange, onOpen }: { videos: VideoRecord[]; selectedId?: string; filters: FilterState; filtersOpen: boolean; onFiltersChange: (value: FilterState) => void; onOpen: (video: VideoRecord) => void }) {
  const needsReview = videos.filter((video) => video.humanStatus === "unreviewed");
  const groups = groupVideos(videos.filter((video) => video.humanStatus !== "unreviewed"));
  return <div className="media-library">
    <div className="page-heading"><div><h1>Vidéos</h1><p>{videos.length} élément{videos.length > 1 ? "s" : ""} dans la bibliothèque locale</p></div></div>
    {filtersOpen && <Filters value={filters} onChange={onFiltersChange} />}
    {needsReview.length > 0 && <VideoShelf title="À valider" videos={needsReview} selectedId={selectedId} onOpen={onOpen} />}
    {groups.map((group) => <VideoShelf key={group.key} title={group.label} videos={group.videos} selectedId={selectedId} onOpen={onOpen} />)}
    {videos.length === 0 && <EmptyState />}
  </div>;
}

function VideoShelf({ title, videos, selectedId, onOpen }: { title: string; videos: VideoRecord[]; selectedId?: string; onOpen: (video: VideoRecord) => void }) {
  return <section className="video-shelf"><header><h2>{title}</h2><span>{videos.length} vidéo{videos.length > 1 ? "s" : ""}</span></header><div className="media-grid">{videos.map((video) => <MediaCard key={video.id} video={video} selected={video.id === selectedId} onOpen={() => onOpen(video)} />)}</div></section>;
}

function MediaCard({ video, selected, onOpen }: { video: VideoRecord; selected: boolean; onOpen: () => void }) {
  return <button className={`media-card ${selected ? "selected" : ""}`} onClick={onOpen} aria-label={`Ouvrir ${video.title}`}>
    <span className="media-poster"><img src={video.thumbnailUrl} alt="" loading="lazy" /><span className="media-duration"><Play fill="currentColor" />{formatDuration(video.durationSeconds)}</span><span className={`media-state ${statusTone(video)}`} aria-hidden="true" /></span>
    <strong>{video.title}</strong><span className="media-meta"><span>{formatShortDate(video.modifiedAt)}</span><span>{localeLabel(video.locale)}</span><span>{video.kind === "poc" ? "POC" : "Production"}</span></span>
  </button>;
}

function CalendarView(props: Parameters<typeof LaunchCalendar>[0]) { return <div className="content-view"><div className="page-heading"><div><h1>Calendrier</h1><p>Planifier, publier et conserver les liens de chaque plateforme.</p></div></div><LaunchCalendar {...props} /></div>; }

function LaunchCalendar({ items, videos, onOpen, onChanged, onNotice }: { items: PublicationPlanItem[]; videos: VideoRecord[]; onOpen: (video: VideoRecord) => void; onChanged: (item: PublicationPlanItem) => void; onNotice: (value: string) => void }) {
  const grouped = items.reduce<Map<string, PublicationPlanItem[]>>((result, item) => { const day = item.scheduledAt.slice(0, 10); result.set(day, [...(result.get(day) ?? []), item]); return result; }, new Map());
  return <section className="calendar-panel"><div className="schedule-list">{[...grouped.entries()].map(([day, entries]) => <section className="schedule-day" key={day}><h2>{formatPlanDay(day)}</h2><div>{entries.map((item) => <PlanItem key={item.id} item={item} video={videos.find((candidate) => candidate.id === item.videoId)} onOpen={onOpen} onChanged={onChanged} onNotice={onNotice} />)}</div></section>)}</div>
    <div className="calendar-note"><div><strong>Automatisation à tester</strong><p>Buffer peut servir immédiatement. Postiz reste le POC prioritaire pour une planification multicanale auto-hébergée.</p></div><a href="https://postiz.com/" target="_blank" rel="noreferrer">Voir Postiz <ExternalLink /></a></div><PublicationPlaybook /></section>;
}

function PlanItem({ item, video, onOpen, onChanged, onNotice }: { item: PublicationPlanItem; video?: VideoRecord; onOpen: (video: VideoRecord) => void; onChanged: (item: PublicationPlanItem) => void; onNotice: (value: string) => void }) {
  const [urls, setUrls] = useState(item.urls); const [busy, setBusy] = useState(false); useEffect(() => setUrls(item.urls), [item]);
  async function save(status: PublicationPlanStatus, nextUrls = urls) { setBusy(true); try { onChanged(await api.savePublicationPlanItem(item.id, status, nextUrls)); onNotice("Planning mis à jour."); } catch (error) { onNotice(message(error)); } finally { setBusy(false); } }
  return <article className={`plan-item ${item.status}`}><div className="plan-time">{formatPlanTime(item.scheduledAt)}</div><div className="plan-copy"><span className="locale-token">{localeLabel(item.locale)}</span><div><strong>{item.title}</strong>{item.note && <small>{item.note}</small>}</div></div>
    <select aria-label={`Statut ${item.title}`} value={item.status} disabled={busy} onChange={(event) => void save(event.target.value as PublicationPlanStatus)}><option value="scheduled">À publier</option><option value="published">Publiée</option><option value="postponed">Reportée</option><option value="blocked">Bloquée</option></select>
    <button className="icon-button" title={video ? "Ouvrir la vidéo" : "Vidéo introuvable"} disabled={!video} onClick={() => video && onOpen(video)}><Play /></button>
    <details className="plan-links"><summary><Link /> Liens de publication</summary><div className="plan-link-grid">{(["tiktok", "youtube", "instagram"] as const).map((platform) => <label key={platform}>{platform === "youtube" ? "YouTube Shorts" : platform === "instagram" ? "Instagram Reels" : "TikTok"}<input type="url" value={urls[platform]} placeholder="https://…" onChange={(event) => setUrls({ ...urls, [platform]: event.target.value })} /></label>)}<button className="secondary-button" disabled={busy} onClick={() => void save(item.status)}><Save /> Enregistrer</button></div></details>
  </article>;
}

function PublicationPlaybook() { return <details className="publication-playbook"><summary><Lightbulb /><div><strong>Recommandations de publication</strong><span>Cadence, contrôle et mesure pour tous les projets</span></div></summary><div className="playbook-list">
  <p><strong>Cadence</strong><span>Commencer par une publication quotidienne et espacer les publications d’un même compte.</span></p><p><strong>Horaire</strong><span>Partir de l’heure locale de l’audience, puis utiliser les données après 10 à 15 publications.</span></p><p><strong>Export</strong><span>Conserver un master sans watermark et adapter les textes à chaque plateforme.</span></p><p><strong>Contrôle</strong><span>Vérifier cadrage, sous-titres, son, faits et droits avant la publication.</span></p><p><strong>Mesure</strong><span>Observer rétention, complétion, revisionnages, partages et abonnements à 2 h, 24 h et 72 h.</span></p>
  </div></details>; }

function AccountsView({ accounts, onConnect, onGuide, onYouTubeGuide }: { accounts: Account[]; onConnect: (id: string) => void; onGuide: () => void; onYouTubeGuide: () => void }) {
  return <div className="content-view accounts-view"><div className="page-heading"><div><h1>Comptes</h1><p>Connecter les destinations et consulter les guides d’automatisation.</p></div><button className="icon-button" title="Plus d’options"><MoreHorizontal /></button></div>
    <section className="account-section"><header><h2>Destinations TikTok</h2></header><div className="account-list">{accounts.map((account) => <article className="account-row" key={account.id}><div className="account-avatar">{localeLabel(account.locale)}</div><div className="account-copy"><strong>{account.label}</strong><small>{account.connected ? account.username ? `@${account.username}` : "Compte connecté" : account.configured ? "Connexion requise" : "API non configurée"}</small></div><span className={`connection-state ${account.connected ? "connected" : ""}`}>{account.connected ? "Connecté" : "Hors ligne"}</span><button className="secondary-button" disabled={!account.configured} onClick={() => onConnect(account.id)}>{account.connected ? "Reconnecter" : "Connecter"}</button></article>)}</div></section>
    <section className="guide-section"><header><h2>Guides d’automatisation</h2></header><button onClick={onGuide}><BookOpen /><span><strong>TikTok</strong><small>Configurer l’envoi de brouillons</small></span><ChevronLeft /></button><button onClick={onYouTubeGuide}><Youtube /><span><strong>YouTube</strong><small>Préparer la publication automatique</small></span><ChevronLeft /></button></section>
  </div>;
}

function PairScreen({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return <main className="pair-screen"><div className="pair-panel"><div className="pair-icon"><LockKeyhole /></div><h1>Appairer cet appareil</h1><p>Saisissez le code à six chiffres affiché dans le terminal du Mac.</p><form onSubmit={async (event) => { event.preventDefault(); setBusy(true); setError(""); try { await api.pair(code); onSuccess(); } catch (caught) { setError(message(caught)); } finally { setBusy(false); } }}><label>Code d’appairage<input autoFocus inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} aria-label="Code d'appairage" placeholder="000000" /></label><button className="primary-button" disabled={code.length !== 6 || busy}>{busy ? <LoaderCircle className="spin" /> : <Smartphone />} Appairer</button></form>{error && <p className="form-error">{error}</p>}<small>Accessible uniquement sur votre réseau local.</small></div></main>;
}

function TikTokApiGuide({ onClose, onNotice }: { onClose: () => void; onNotice: (value: string) => void }) {
  const port = window.location.port || "4173"; const redirectUri = `http://127.0.0.1:${port}/oauth/tiktok/callback/`;
  async function copy(value: string, label: string) { try { await navigator.clipboard.writeText(value); onNotice(`${label} copiée.`); } catch { onNotice("La copie a échoué. Sélectionnez le texte manuellement."); } }
  return <GuideShell title="Activer l’envoi TikTok" subtitle="L’envoi crée un brouillon. La publication finale reste manuelle dans TikTok." onClose={onClose}><ol className="setup-steps">
    <GuideStep number="1" title="Créer l’application"><p>Connectez-vous au portail TikTok for Developers et créez une application.</p><a href="https://developers.tiktok.com/" target="_blank" rel="noreferrer">Ouvrir le portail <ExternalLink /></a></GuideStep>
    <GuideStep number="2" title="Ajouter les produits"><p>Activez <strong>Login Kit</strong> puis <strong>Content Posting API</strong>.</p></GuideStep>
    <GuideStep number="3" title="Demander les permissions"><p>Conservez uniquement <code>user.info.basic</code> et <code>video.upload</code>.</p></GuideStep>
    <GuideStep number="4" title="Enregistrer la redirection"><p>Ajoutez exactement cette Redirect URI dans Login Kit.</p><div className="copy-value"><code>{redirectUri}</code><button className="icon-button" title="Copier l’URL" onClick={() => void copy(redirectUri, "URL de redirection")}><Clipboard /></button></div></GuideStep>
    <GuideStep number="5" title="Soumettre la revue"><p>Demandez l’approbation de <code>video.upload</code>.</p><a href="https://developers.tiktok.com/docs/en/content-posting-api-get-started-upload-content" target="_blank" rel="noreferrer">Guide officiel <ExternalLink /></a></GuideStep>
    <GuideStep number="6" title="Configurer le Mac"><p>Renseignez les identifiants dans le fichier local <code>.env</code>.</p><div className="env-list"><code>SF_TIKTOK_CLIENT_KEY</code><code>SF_TIKTOK_CLIENT_SECRET</code></div></GuideStep>
    <GuideStep number="7" title="Connecter les comptes"><p>Connectez le compte FR puis le compte EN. Les jetons restent dans le Trousseau macOS.</p></GuideStep>
  </ol></GuideShell>;
}

function YouTubeApiGuide({ onClose, onNotice }: { onClose: () => void; onNotice: (value: string) => void }) {
  const port = window.location.port || "4173"; const redirectUri = `http://127.0.0.1:${port}/oauth/youtube/callback/`;
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); onNotice("URL de redirection copiée."); } catch { onNotice("La copie a échoué. Sélectionnez le texte manuellement."); } }
  return <GuideShell title="Activer YouTube Data API" subtitle="Le connecteur n’est pas encore implémenté. Ce guide prépare les identifiants nécessaires." onClose={onClose}><ol className="setup-steps">
    <GuideStep number="1" title="Créer le projet Google Cloud"><p>Créez un projet dédié à Shortform Forge.</p><a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">Créer un projet <ExternalLink /></a></GuideStep>
    <GuideStep number="2" title="Activer YouTube Data API v3"><p>Activez uniquement YouTube Data API v3.</p></GuideStep>
    <GuideStep number="3" title="Configurer Google Auth"><p>Ajoutez les propriétaires des chaînes comme utilisateurs de test.</p></GuideStep>
    <GuideStep number="4" title="Créer le client OAuth"><p>Créez un client OAuth Web et prévoyez cette URI.</p><div className="copy-value"><code>{redirectUri}</code><button className="icon-button" title="Copier l’URL" onClick={() => void copy(redirectUri)}><Clipboard /></button></div></GuideStep>
    <GuideStep number="5" title="Demander le scope minimal"><p>Utilisez uniquement <code>https://www.googleapis.com/auth/youtube.upload</code>.</p></GuideStep>
    <GuideStep number="6" title="Préparer l’envoi programmé"><p>Le futur connecteur utilisera <code>videos.insert</code> et <code>status.publishAt</code>.</p></GuideStep>
    <GuideStep number="7" title="Passer l’audit YouTube"><p>L’audit est requis avant une publication publique automatique.</p><a href="https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits" target="_blank" rel="noreferrer">Audit et quotas <ExternalLink /></a></GuideStep>
    <GuideStep number="8" title="Conserver les identifiants"><div className="env-list"><code>SF_YOUTUBE_CLIENT_ID</code><code>SF_YOUTUBE_CLIENT_SECRET</code></div></GuideStep>
  </ol></GuideShell>;
}

function GuideShell({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) { return <div className="guide-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><aside className="guide-panel" aria-label={title}><header className="guide-header"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" title="Fermer" onClick={onClose}><X /></button></header><div className="guide-scroll">{children}</div></aside></div>; }
function GuideStep({ number, title, children }: { number: string; title: string; children: React.ReactNode }) { return <li><span>{number}</span><div><h3>{title}</h3>{children}</div></li>; }

function Filters({ value, onChange }: { value: FilterState; onChange: (value: FilterState) => void }) { return <div className="filter-panel"><FilterSelect label="Langue" value={value.locale} onChange={(locale) => onChange({ ...value, locale })}><option value="all">Toutes</option><option value="fr-FR">Français</option><option value="en-US">Anglais</option><option value="unknown">À identifier</option></FilterSelect><FilterSelect label="Type" value={value.kind} onChange={(kind) => onChange({ ...value, kind })}><option value="all">Tous</option><option value="production">Productions</option><option value="poc">POC</option></FilterSelect><FilterSelect label="Statut" value={value.status} onChange={(status) => onChange({ ...value, status })}><option value="all">Tous</option><option value="ready">Prêtes</option><option value="approved">Approuvées</option><option value="sent">Envoyées</option></FilterSelect><button className="text-button" onClick={() => onChange({ ...initialFilters, query: value.query })}><X /> Réinitialiser</button></div>; }
function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) { return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>; }

function VideoInspector({ video, accounts, onClose, onChanged, onNotice }: { video: VideoRecord; accounts: Account[]; onClose: () => void; onChanged: (video: VideoRecord) => void; onNotice: (value: string) => void }) {
  const [caption, setCaption] = useState(video.caption); const [hashtags, setHashtags] = useState(video.hashtags.join(" ")); const [busy, setBusy] = useState(false); const [accountId, setAccountId] = useState(accounts.find((account) => account.locale === video.locale)?.id ?? "");
  useEffect(() => { setCaption(video.caption); setHashtags(video.hashtags.join(" ")); setAccountId(accounts.find((account) => account.locale === video.locale)?.id ?? ""); }, [video, accounts]);
  async function action(work: () => Promise<VideoRecord>) { setBusy(true); try { onChanged(await work()); } catch (error) { onNotice(message(error)); } finally { setBusy(false); } }
  async function copyText(value: string, success: string) { try { await navigator.clipboard.writeText(value); onNotice(success); } catch { onNotice("La copie a échoué. Sélectionnez le texte manuellement."); } }
  const target = accounts.find((account) => account.id === accountId); const hashtagCopy = hashtags.split(/[\s,]+/).filter(Boolean).map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  return <aside className="video-inspector" aria-label={`Détails de ${video.title}`}><header className="inspector-header"><button className="icon-button mobile-back" title="Retour" onClick={onClose}><ChevronLeft /></button><div><h2>{video.title}</h2><p>{projectForVideo(video).label}</p></div><button className="icon-button desktop-close" title="Fermer" onClick={onClose}><X /></button></header><div className="inspector-scroll">
    <video controls playsInline poster={video.thumbnailUrl} src={video.mediaUrl} />
    <section className="inspector-section compact"><dl className="metadata-list"><div><dt>Type</dt><dd>{video.kind === "poc" ? "POC" : "Production"}</dd></div><div><dt>Langue</dt><dd>{localeLabel(video.locale)}</dd></div><div><dt>Durée</dt><dd>{formatDuration(video.durationSeconds)}</dd></div></dl></section>
    <section className="inspector-section"><div className="section-title"><h3>Contrôle qualité</h3><QaBadge video={video} /></div>{video.blockReasons.length > 0 ? <div className="warning-list">{video.blockReasons.map((reason) => <p key={reason}><CircleAlert />{reason}</p>)}</div> : <p className="success-message"><CheckCircle2 /> Prête pour la publication</p>}</section>
    <section className="inspector-section"><div className="section-title"><h3>Légende</h3><button className="text-button" onClick={() => void copyText(caption.trim(), "Légende copiée.")}><Clipboard /> Copier</button></div><textarea value={caption} maxLength={2200} onChange={(event) => setCaption(event.target.value)} /></section>
    <section className="inspector-section"><div className="section-title"><h3>Hashtags</h3><button className="text-button" onClick={() => void copyText(hashtagCopy, "Hashtags copiés.")}><Clipboard /> Copier</button></div><textarea className="hashtags-input" value={hashtags} onChange={(event) => setHashtags(event.target.value)} /><button className="secondary-button full" disabled={busy} onClick={() => void action(() => api.saveMetadata(video.id, caption, hashtags.split(/[\s,]+/).filter(Boolean)))}><Save /> Enregistrer les textes</button></section>
    {video.sources.length > 0 && <section className="inspector-section"><h3>Sources</h3><div className="source-list">{video.sources.map((source) => <a key={source} href={source} target="_blank" rel="noreferrer"><ExternalLink />{safeHost(source)}</a>)}</div></section>}
    <section className="inspector-section publish-section"><h3>Destination</h3><select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.filter((account) => account.locale === video.locale).map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select><a className="secondary-button full" href={video.downloadUrl} download><Download /> Télécharger</a><button className="primary-button full" disabled={busy || !video.canPublish || !target?.connected} onClick={async () => { setBusy(true); try { await api.publish(video.id, accountId); onNotice("Vidéo envoyée dans la boîte TikTok."); } catch (error) { setNoticeSafe(onNotice, error); } finally { setBusy(false); } }}><Send /> Envoyer dans TikTok</button><small>L’envoi crée un brouillon à finaliser dans TikTok.</small></section>
  </div><footer className="inspector-footer">{video.kind === "poc" && !video.promoted && <button className="secondary-button promote-button" disabled={busy} onClick={() => void action(() => api.promote(video.id))}><FlaskConical /> Promouvoir le POC</button>}<div className="review-actions"><button disabled={busy} className="reject-button" onClick={() => void action(() => api.review(video.id, false))}><X /> Rejeter</button><button disabled={busy || (video.kind === "poc" && !video.promoted)} className="approve-button" onClick={() => void action(() => api.review(video.id, true))}><Check /> Valider</button></div></footer></aside>;
}

function QaBadge({ video }: { video: VideoRecord }) { const label = video.qaStatus === "pass" ? "QA réussie" : video.qaStatus === "fail" ? "QA échouée" : "QA à vérifier"; return <span className={`qa-state ${video.qaStatus}`}>{video.qaStatus === "pass" ? <Check /> : <CircleAlert />}{label}</span>; }
function LoadingScreen() { return <div className="loading-screen"><LoaderCircle className="spin" /><span>Ouverture de la médiathèque</span></div>; }
function EmptyState() { return <div className="empty-state"><FileVideo2 /><h2>Aucune vidéo</h2><p>Modifiez les filtres ou actualisez la bibliothèque.</p></div>; }
function groupVideos(videos: VideoRecord[]): ProjectGroup[] { const groups = new Map<string, ProjectGroup>(); for (const video of videos) { const project = projectForVideo(video); const group = groups.get(project.key) ?? { ...project, videos: [] }; group.videos.push(video); groups.set(project.key, group); } return [...groups.values()]; }
function projectForVideo(video: VideoRecord): Omit<ProjectGroup, "videos"> { const path = video.relativePath.toLowerCase(); if (path.includes("questions-insolites-fr") || path.includes("bizarrement-curieux")) return { key: "bizarrement-curieux", label: "Bizarrement Curieux" }; if (path.includes("curious-questions-en")) return { key: "oddly-curious", label: "Oddly Curious" }; if (path.includes("/benchmarks/")) return { key: "experiments", label: "Expérimentations" }; const parts = video.relativePath.split("/"); const root = parts.findIndex((part) => ["series", "production"].includes(part)); const slug = root >= 0 ? parts[root + 1] : undefined; return slug ? { key: slug, label: titleFromSlug(slug) } : { key: "other", label: "Autres vidéos" }; }
function statusTone(video: VideoRecord) { return video.canPublish ? "ready" : video.qaStatus === "fail" || video.humanStatus === "rejected" ? "blocked" : "pending"; }
function titleFromSlug(value: string) { return value.split(/[-_]/).filter(Boolean).map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" "); }
function formatDuration(value: number | null) { if (value === null) return "--:--"; return `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, "0")}`; }
function formatShortDate(value: string) { return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }
function localeLabel(locale: VideoRecord["locale"]) { return locale === "fr-FR" ? "FR" : locale === "en-US" ? "EN" : "?"; }
function formatPlanDay(day: string) { return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date(`${day}T12:00:00+02:00`)); }
function formatPlanTime(value: string) { return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(value)); }
function safeHost(value: string) { try { return new URL(value).hostname; } catch { return value; } }
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
function setNoticeSafe(notice: (value: string) => void, error: unknown) { notice(message(error)); }
