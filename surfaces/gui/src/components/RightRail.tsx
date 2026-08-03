import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
// Emits the asset URL only; the worker itself loads lazily with the pdfjs chunk.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  getArtifacts,
  getBrowserState,
  executeWorkspaceCommand,
  openBrowserUrl,
  readArtifact,
  revealArtifact,
  type ArtifactContent,
  type ArtifactInfo,
} from "../api";
import type { Item, TodoItem } from "../types";
import type { BrowserState } from "../api";
import { AccessSection } from "./AccessSection";
import { Icon } from "./Icon";
import { Markdown, OPEN_ARTIFACT_EVENT } from "./Markdown";
import { useI18n } from "../I18nProvider";

type Panel = "chat" | "browser" | "terminal" | "progress" | "artifacts";

// Quiet file-type icons for the artifact list (the colored kind pills read as noisy).
function kindIcon(kind: string): "file" | "fileCode" | "image" | "table" {
  if (kind === "image") return "image";
  if (kind === "html" || kind === "code") return "fileCode";
  if (kind === "csv" || kind === "sheet") return "table";
  return "file"; // markdown, text, pdf, everything else
}

// Fallback kind for an artifact: link whose path isn't in the list (yet) — mirrors the
// server's extension mapping closely enough for the viewer to pick a renderer.
function kindFromPath(path: string): string {
  const ext = (path.split(".").pop() || "").toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return "image";
  if (["html", "htm"].includes(ext)) return "html";
  if (ext === "md") return "markdown";
  if (ext === "csv") return "csv";
  if (ext === "pdf") return "pdf";
  if (["py", "js", "ts", "tsx", "jsx", "json", "sh", "css"].includes(ext)) return "code";
  return "text";
}

interface Props {
  active: boolean;
  sessionId: string;
  refreshKey: number;
  toolNames: string[];
  todo: TodoItem[];
  items?: Item[];
  running: boolean;
  // Fires when a full artifact preview opens/closes, so the app can auto-collapse the left nav
  // to give the preview (PDF/webpage/sheet) more room (#3).
  onPreviewChange?: (open: boolean) => void;
  // §32: the rail is the ONE session panel for every non-chat persona. Artifacts stays
  // cowork-only (deliverables; code-family gets "Files" later — slot reserved); the Access
  // section (the former Session-settings drawer) renders for all.
  showArtifacts?: boolean;
  personaId?: string;
  projectScoped?: boolean;
  workspace?: string;
  branch?: string | null;
  scratchPrimary?: boolean;
  openAccessKey?: number;
  onOpenIntegrations?: () => void;
}

export function RightRail({
  active,
  sessionId,
  refreshKey,
  toolNames,
  todo,
  items = [],
  running,
  onPreviewChange,
  showArtifacts = true,
  personaId,
  projectScoped,
  workspace,
  branch,
  scratchPrimary,
  openAccessKey = 0,
  onOpenIntegrations,
}: Props) {
  const { locale, t } = useI18n();
  const [panel, setPanel] = useState<Panel>("progress");
  const [open, setOpen] = useState<Record<"progress" | "artifacts", boolean>>({ progress: true, artifacts: true });
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([]);
  const [selected, setSelected] = useState<ArtifactInfo | null>(null);
  const [content, setContent] = useState<ArtifactContent | null>(null);
  const [browser, setBrowser] = useState<BrowserState | null>(null);

  const refreshArtifacts = () => getArtifacts(sessionId).then(setArtifacts).catch(() => setArtifacts([]));

  useEffect(() => {
    if (!active) return;
    if (showArtifacts) refreshArtifacts();
    getBrowserState().then(setBrowser).catch(() => setBrowser(null));
  }, [active, sessionId, refreshKey, showArtifacts]);

  // Switching conversations closes any open artifact — it belongs to the previous session's
  // workspace, which the new session can't (and shouldn't) read.
  useEffect(() => {
    setSelected(null);
    setContent(null);
  }, [sessionId]);

  useEffect(() => {
    setContent(null);
    if (!selected) return;
    readArtifact(sessionId, selected.path).then(setContent).catch(() => setContent(null));
  }, [selected?.path, sessionId]);

  // Notify the app when a preview opens/closes (drives the left-nav auto-collapse).
  useEffect(() => {
    onPreviewChange?.(!!selected);
  }, [!!selected, onPreviewChange]);

  const reloadSelected = () => {
    if (!selected) return Promise.resolve();
    setContent(null);
    return readArtifact(sessionId, selected.path).then(setContent).catch(() => setContent(null));
  };

  // §34 (UX-016): [Title](artifact:path) chips in the transcript open the viewer directly.
  // Resolve against the loaded list first; on a miss, refresh once (the file may be
  // seconds old), then fall back to a minimal record — readArtifact validates the path.
  useEffect(() => {
    if (!active) return;
    const minimal = (path: string): ArtifactInfo => ({
      path,
      name: path.split("/").pop() || path,
      kind: kindFromPath(path),
      size: 0,
      modified_at: 0,
    });
    const match = (list: ArtifactInfo[], path: string) =>
      list.find((a) => a.path === path || a.path.endsWith("/" + path) || a.name === path);
    const onOpen = (e: Event) => {
      const path = String((e as CustomEvent).detail?.path || "");
      if (!path) return;
      const found = match(artifacts, path);
      if (found) {
        setSelected(found);
        return;
      }
      getArtifacts(sessionId)
        .then((list) => {
          setArtifacts(list);
          setSelected(match(list, path) ?? minimal(path));
        })
        .catch(() => setSelected(minimal(path)));
    };
    window.addEventListener(OPEN_ARTIFACT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ARTIFACT_EVENT, onOpen);
  }, [active, sessionId, artifacts]);

  if (!active) return null;

  return (
    <aside className={"right-rail" + (selected ? " artifact-mode" : panel === "browser" ? " browser-mode" : "")}>
      {selected ? (
        <ArtifactViewer
          sessionId={sessionId}
          artifact={selected}
          content={content}
          onReload={reloadSelected}
          onBack={() => setSelected(null)}
          onOpenEntry={(path) =>
            setSelected({
              path,
              name: path.split("/").pop() || path,
              kind: kindFromPath(path),
              size: 0,
              modified_at: 0,
            })
          }
        />
      ) : (
        <>
          <RailTabs panel={panel} onChange={setPanel} artifactCount={artifacts.length} hasChatContext={items.some((item) => item.kind === "user" || item.kind === "assistant")} />
          {panel === "chat" && <SideChat items={items} />}
          {panel === "browser" && <BrowserPanel state={browser} onRefresh={() => getBrowserState().then(setBrowser).catch(() => {})} />}
          {panel === "terminal" && <TerminalPanel items={items} workspace={workspace} />}
          {panel === "progress" && <>
          <RailSection title={t("rail.progress")} open={open.progress} onToggle={() => setOpen({ ...open, progress: !open.progress })}>
            <ProgressSummary running={running} toolNames={toolNames} todo={todo} />
          </RailSection>

          {false && showArtifacts && (
          <RailSection
            title={`${t("rail.artifacts")}${artifacts.length ? ` (${artifacts.length})` : ""}`}
            open={open.artifacts}
            onToggle={() => setOpen({ ...open, artifacts: !open.artifacts })}
            action={
              <>
                {artifacts.length > 0 && (
                  <button
                    className="rail-mini-btn"
                    onClick={(e) => { e.stopPropagation(); revealArtifact(sessionId, artifacts[0].path, "reveal"); }}
                    title={t("rail.showFolder")}
                  >
                    <Icon name="folder" size={13} />
                  </button>
                )}
                <button className="rail-mini-btn" onClick={(e) => { e.stopPropagation(); refreshArtifacts(); }} title={t("rail.refresh")}><Icon name="refresh" size={13} /></button>
              </>
            }
          >
            {artifacts.length === 0 ? (
              <div className="rail-muted">{t("rail.noArtifacts")}</div>
            ) : (
              <div className="artifact-list">
                {artifacts.slice(0, 16).map((a) => (
                  <button className="artifact-row" key={a.path} onClick={() => setSelected(a)}>
                    <span className="artifact-ico" title={a.kind}>
                      <Icon name={kindIcon(a.kind)} size={17} />
                    </span>
                    <span className="artifact-name">
                      {a.name}
                      <span className="artifact-row-meta">{formatBytes(a.size)} · {formatTime(a.modified_at, locale)}</span>
                    </span>
                    <span className="artifact-open">{t("common.open")}</span>
                  </button>
                ))}
              </div>
            )}
          </RailSection>
          )}

          {/* §32: Access — the former Session-settings drawer, one section among peers.
              key: its data ownership resets with the conversation, like the old row did. */}
          </>}

          {panel === "artifacts" && showArtifacts && <ArtifactList artifacts={artifacts} sessionId={sessionId} refresh={refreshArtifacts} onSelect={setSelected} />}

          {panel === "progress" && <AccessSection
            key={sessionId}
            sessionId={sessionId}
            personaId={personaId}
            projectScoped={projectScoped}
            workspace={workspace}
            branch={branch}
            scratchPrimary={scratchPrimary}
            openKey={openAccessKey}
            onOpenIntegrations={onOpenIntegrations}
          />}
        </>
      )}
    </aside>
  );
}

function RailTabs({ panel, onChange, artifactCount, hasChatContext }: { panel: Panel; onChange: (panel: Panel) => void; artifactCount: number; hasChatContext: boolean }) {
  const { locale, t } = useI18n();
  const tabs: { key: Panel; label: string; icon: "chat" | "globe" | "code" | "clock" | "file" }[] = [
    { key: "chat", label: locale === "zh-CN" ? "侧边聊天" : "Side chat", icon: "chat" },
    { key: "browser", label: locale === "zh-CN" ? "浏览器" : "Browser", icon: "globe" },
    { key: "terminal", label: locale === "zh-CN" ? "终端" : "Terminal", icon: "code" },
    { key: "progress", label: t("rail.progress"), icon: "clock" },
    { key: "artifacts", label: `${t("rail.artifacts")}${artifactCount ? ` (${artifactCount})` : ""}`, icon: "file" },
  ];
  return <div className="rail-tabs" role="tablist">{tabs.filter((tab) => tab.key !== "chat" || hasChatContext).map((tab) => <button key={tab.key} role="tab" aria-selected={panel === tab.key} className={"rail-tab" + (panel === tab.key ? " active" : "")} onClick={() => onChange(tab.key)}><Icon name={tab.icon} size={14} /><span>{tab.label}</span></button>)}</div>;
}

function SideChat({ items }: { items: Item[] }) {
  const messages = items.filter((item) => item.kind === "user" || item.kind === "assistant").slice(-8);
  const [draft, setDraft] = useState("");
  const [sideMessages, setSideMessages] = useState<string[]>([]);
  if (!messages.length) return null;
  return <div className="rail-side-chat"><div className="rail-muted">主任务上下文（只读）</div>{messages.map((item, index) => <div className={"rail-chat-line " + item.kind} key={index}><span>{item.kind === "user" ? "你" : "Atlas"}</span><p>{item.text}</p></div>)}{sideMessages.map((text, index) => <div className="rail-chat-line user" key={`side-${index}`}><span>侧边聊天</span><p>{text}</p></div>)}<form className="rail-side-composer" onSubmit={(event) => { event.preventDefault(); if (!draft.trim()) return; setSideMessages((items) => [...items, draft.trim()]); setDraft(""); }}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="独立侧边聊天…" /><button className="btn sm" type="submit">发送</button></form></div>;
}

function BrowserPanel({ state, onRefresh }: { state: BrowserState | null; onRefresh: () => void }) {
  const [url, setUrl] = useState(state?.url || "");
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  if (!state) return <div className="rail-muted">正在加载浏览器状态…</div>;
  const open = async () => { if (!url.trim()) return; setOpening(true); setError(""); const result = await openBrowserUrl(url.trim()).catch((e) => ({ error: String(e) })); if (result.error) setError(result.error); setOpening(false); onRefresh(); };
  return <div className="rail-browser"><div className="browser-tabs"><span className="browser-tab-active"><Icon name="globe" size={13} />{state.title || "新标签页"}<span>×</span></span><span className="browser-tab-plus">＋</span></div><div className="browser-toolbar"><button className="rail-mini-btn" onClick={onRefresh}>‹</button><button className="rail-mini-btn" onClick={onRefresh}>›</button><button className="rail-mini-btn" onClick={onRefresh}>↻</button><form className="browser-address" onSubmit={(event) => { event.preventDefault(); void open(); }}><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="输入 URL" /></form><span className="browser-menu">⋮</span></div>{error && <div className="rail-error">{error}</div>}{state.screenshot_data_url ? <img className="browser-shot browser-page" src={state.screenshot_data_url} /> : <div className="browser-home"><Icon name="globe" size={40} /><strong>开始浏览</strong><span>输入 URL 以打开页面</span></div>}<button className="btn sm" disabled={opening} onClick={onRefresh}>{opening ? "正在打开…" : "刷新状态"}</button></div>;
}

function TerminalPanel({ items, workspace }: { items: Item[]; workspace?: string }) {
  const tools = items.filter((item) => item.kind === "tool").slice(-12);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<{ command: string; output: string; code?: number }[]>([]);
  const [running, setRunning] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); const next = command.trim(); if (!next || !workspace || running) return; setCommand(""); setRunning(true); const result: { ok?: boolean; output?: string; code?: number; error?: string } = await executeWorkspaceCommand(workspace, next).catch((error) => ({ ok: false, output: String(error), code: -1 })); setHistory((lines) => [...lines, { command: next, output: result.output || (result.ok ? "" : result.error || "命令执行失败"), code: result.code }]); setRunning(false); };
  return <div className="embedded-terminal"><div className="terminal-tabs"><span className="terminal-tab-active"><Icon name="code" size={13} />管理员: Windows PowerShell <span>×</span></span><span className="terminal-tab-plus">＋</span></div><div className="terminal-body"><div className="terminal-banner">Windows PowerShell<br />Copyright (C) Microsoft Corporation. All rights reserved.</div>{history.map((entry, index) => <div className="terminal-entry" key={`command-${index}`}><div className="terminal-command"><span>PS {workspace || ""}&gt;</span> {entry.command}</div>{entry.output && <pre className={entry.code ? "terminal-output error" : "terminal-output"}>{entry.output}</pre>}</div>)}{tools.map((item, index) => <div className="terminal-command terminal-tool" key={`tool-${index}`}><span>{item.status}</span> {item.name}{item.preview ? ` — ${item.preview}` : ""}</div>)}<form className="terminal-prompt" onSubmit={submit}><span>PS {workspace || ""}&gt;</span><input aria-label="终端命令" value={command} onChange={(event) => setCommand(event.target.value)} autoFocus disabled={running || !workspace} placeholder={running ? "正在执行…" : "输入命令"} /></form></div></div>;
}

function ArtifactList({ artifacts, sessionId, refresh, onSelect }: { artifacts: ArtifactInfo[]; sessionId: string; refresh: () => void; onSelect: (artifact: ArtifactInfo) => void }) {
  const { locale, t } = useI18n();
  if (!artifacts.length) return <div className="rail-muted">{t("rail.noArtifacts")}</div>;
  return <div className="artifact-list">{artifacts.slice(0, 16).map((artifact) => <button className="artifact-row" key={artifact.path} onClick={() => onSelect(artifact)}><span className="artifact-ico"><Icon name={kindIcon(artifact.kind)} size={17} /></span><span className="artifact-name">{artifact.name}<span className="artifact-row-meta">{formatBytes(artifact.size)} · {formatTime(artifact.modified_at, locale)}</span></span><span className="artifact-open">{t("common.open")}</span></button>)}<div className="rail-actions"><button className="btn sm" onClick={() => revealArtifact(sessionId, artifacts[0].path, "reveal")}>{t("rail.showFolder")}</button><button className="btn sm" onClick={refresh}>{t("rail.refresh")}</button></div></div>;
}

function ProgressSummary({ running, toolNames, todo }: { running: boolean; toolNames: string[]; todo: TodoItem[] }) {
  const { locale, t } = useI18n();
  const progressText = () =>
    t("rail.working", {
      details: toolNames.length
        ? t("rail.toolCalls", { count: toolNames.length })
        : locale === "zh-CN" ? "。" : ".",
    });
  if (todo.length) {
    return (
      <div className="rail-todo-list">
        {todo.map((item, index) => (
          <div className={"rail-todo " + item.status} key={index}>
            <span className="rail-todo-mark" />
            <span>{item.content}</span>
          </div>
        ))}
        {running && (
          <div className="rail-muted">
            {progressText()}
          </div>
        )}
      </div>
    );
  }
  if (running) {
    return (
      <div className="rail-muted">
        {progressText()}
      </div>
    );
  }
  return (
    <div className="rail-muted">
      {t("rail.progressIdle")}
    </div>
  );
}

function RailSection({
  title,
  open,
  onToggle,
  children,
  action,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rail-section">
      <div className="rail-section-head">
        <button className="rail-section-toggle" onClick={onToggle}>
          <Icon name={open ? "chevronDown" : "chevronRight"} size={14} className="rail-chev" />
          <span>{title}</span>
        </button>
        {action}
      </div>
      {open && <div className="rail-section-body">{children}</div>}
    </section>
  );
}

function ArtifactViewer({
  sessionId,
  artifact,
  content,
  onReload,
  onBack,
  onOpenEntry,
}: {
  sessionId: string;
  artifact: ArtifactInfo;
  content: ArtifactContent | null;
  onReload: () => Promise<void>;
  onBack: () => void;
  // Folder listings: open a child entry in the viewer (files and subfolders alike).
  onOpenEntry?: (path: string) => void;
}) {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const isHtml = content?.kind === "html" && !content.error;
  // Best viewed in a real app: spreadsheets, PDFs, and Office docs (pptx/docx can't preview inline)
  const isApp = content?.kind === "sheet" || content?.kind === "pdf" || content?.kind === "office";

  return (
    <div className="artifact-viewer">
      <div className="artifact-head">
        <button className="artifact-icon-btn" onClick={onBack} aria-label={t("rail.back")} title={t("rail.back")}>
          <Icon name="arrowLeft" size={16} />
        </button>
        <div className="artifact-heading">
          <div className="artifact-title"><span>{t("rail.artifacts")}</span><span className="artifact-sep">/</span><span>{artifact.name}</span></div>
          <div className="artifact-path">{artifact.path}</div>
        </div>
        <div className="rail-actions">
          {isHtml && (
            <button
              className="artifact-icon-btn"
              onClick={async () => {
                await onReload();
                setReloadKey((k) => k + 1);
              }}
              aria-label={t("rail.reload")}
              title={t("rail.reload")}
            >
              <Icon name="refresh" size={16} />
            </button>
          )}
          {isApp && (
            <button
              className="artifact-icon-btn"
              onClick={() => revealArtifact(sessionId, artifact.path, "open")}
              aria-label={t("rail.openDefault")}
              title={t("rail.openDefault")}
            >
              <Icon name="panelOpen" size={16} />
            </button>
          )}
          {/* Copy the ABSOLUTE path — the workspace-relative one is useless outside the app
              (tester catch 2026-07-12: it copied just "slack-connector-debug.md"). */}
          <button
            className="artifact-icon-btn"
            onClick={() => navigator.clipboard?.writeText(artifact.abs_path || artifact.path)}
            aria-label={t("rail.copyPath")}
            title={t("rail.copyPath")}
          >
            <Icon name="copy" size={16} />
          </button>
          <button
            className="artifact-icon-btn"
            onClick={() => revealArtifact(sessionId, artifact.path, "reveal")}
            aria-label={t("rail.showInFolder")}
            title={t("rail.showInFolder")}
          >
            <Icon name="folder" size={16} />
          </button>
        </div>
      </div>
      <div className="artifact-preview">
        {!content ? (
          <div className="rail-muted">{t("common.loading")}</div>
        ) : content.error ? (
          <div className="rail-error">{content.error}</div>
        ) : content.kind === "html" ? (
          <iframe
            key={`${artifact.path}-${reloadKey}`}
            sandbox="allow-scripts allow-same-origin"
            className="artifact-frame"
            srcDoc={content.content || ""}
          />
        ) : content.kind === "markdown" ? (
          <div className="artifact-md">
            <Markdown text={content.content || ""} />
          </div>
        ) : content.kind === "image" ? (
          <img className="artifact-image" src={content.data_url} />
        ) : content.kind === "pdf" ? (
          <PdfViewer dataUrl={content.data_url || ""} />
        ) : content.kind === "csv" ? (
          <CsvTable text={content.content || ""} />
        ) : content.kind === "sheet" ? (
          <SheetViewer dataUrl={content.data_url || ""} />
        ) : content.kind === "folder" ? (
          // A linked directory (e.g. a skill package): render the listing, click through.
          <div className="artifact-folderlist" data-testid="artifact-folder">
            {(content.entries || []).map((e) => (
              <button
                key={e.name}
                className="artifact-folder-row"
                onClick={() => onOpenEntry?.(`${artifact.path.replace(/\/+$/, "")}/${e.name}`)}
              >
                <Icon name={e.dir ? "folder" : "file"} size={14} />
                <span className="artifact-folder-name">{e.name}</span>
                {!e.dir && <span className="artifact-folder-size">{formatBytes(e.size)}</span>}
              </button>
            ))}
            {!content.entries?.length && <div className="rail-muted">This folder is empty.</div>}
          </div>
        ) : content.kind === "office" ? (
          <div className="artifact-open-prompt">
            <Icon name="panelOpen" size={28} />
            <p>This {/\.pptx?$/i.test(artifact.name) ? "PowerPoint" : "Word"} file can’t be previewed here.</p>
            <button className="btn sm" onClick={() => revealArtifact(sessionId, artifact.path, "open")}>
              Open in default app
            </button>
          </div>
        ) : (
          <pre className="artifact-code">{content.content}</pre>
        )}
      </div>
    </div>
  );
}

const MAX_TABLE_ROWS = 500;

function GridTable({ rows, note }: { rows: unknown[][]; note?: string }) {
  const [head, ...body] = rows;
  return (
    <div className="artifact-tablewrap">
      <table className="artifact-table">
        {head && (
          <thead>
            <tr>{head.map((c, i) => <th key={i}>{String(c ?? "")}</th>)}</tr>
          </thead>
        )}
        <tbody>
          {body.slice(0, MAX_TABLE_ROWS).map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{String(c ?? "")}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {(note || body.length > MAX_TABLE_ROWS) && (
        <div className="rail-muted artifact-table-note">
          {note}
          {body.length > MAX_TABLE_ROWS ? ` Showing first ${MAX_TABLE_ROWS} of ${body.length} rows.` : ""}
        </div>
      )}
    </div>
  );
}

// Minimal RFC-4180-ish CSV parsing: quoted fields, escaped quotes, CRLF. TSV via tab sniffing.
function parseCsv(text: string): string[][] {
  const delim = text.includes("\t") && !text.split("\n")[0]?.includes(",") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

function CsvTable({ text }: { text: string }) {
  const rows = parseCsv(text);
  if (!rows.length) return <div className="rail-muted artifact-table-note">Empty file.</div>;
  return <GridTable rows={rows} />;
}

// xlsx/xls preview via SheetJS (loaded on demand — it's a heavy module): sheet tabs + a capped
// grid. Real spreadsheet work belongs in Numbers/Excel via "Open in default app".
// WKWebView has no inline PDF plugin (<embed> shows a gray pane in the Tauri shell), so we
// rasterize pages with pdf.js onto stacked canvases — same lazy-chunk pattern as SheetViewer.
function PdfViewer({ dataUrl }: { dataUrl: string }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const holder = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setLoading(true);
    const base64 = dataUrl.split(",")[1] || "";
    import("pdfjs-dist")
      .then(async (pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const doc = await pdfjs.getDocument({ data: bytes }).promise;
        const el = holder.current;
        if (cancelled || !el) return;
        el.innerHTML = "";
        const width = el.clientWidth || 640;
        const dpr = window.devicePixelRatio || 1;
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "artifact-pdf-page";
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
          if (cancelled) return;
          el.appendChild(canvas);
        }
        setLoading(false);
      })
      .catch((e) => !cancelled && setError(String(e?.message || e)));
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  if (error) return <div className="rail-error artifact-table-note">Could not render PDF: {error}</div>;
  return (
    <div className="artifact-pdfjs">
      {loading && <div className="rail-muted artifact-table-note">Rendering PDF…</div>}
      <div ref={holder} />
    </div>
  );
}

function SheetViewer({ dataUrl }: { dataUrl: string }) {
  const [sheets, setSheets] = useState<{ name: string; rows: unknown[][] }[] | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSheets(null);
    setError("");
    setActive(0);
    const base64 = dataUrl.split(",")[1] || "";
    import("xlsx")
      .then((XLSX) => {
        if (cancelled) return;
        const wb = XLSX.read(base64, { type: "base64" });
        setSheets(
          wb.SheetNames.map((name) => ({
            name,
            rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" }) as unknown[][],
          })),
        );
      })
      .catch((e) => !cancelled && setError(String(e?.message || e)));
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  if (error) return <div className="rail-error artifact-table-note">Could not parse spreadsheet: {error}</div>;
  if (!sheets) return <div className="rail-muted artifact-table-note">Parsing spreadsheet…</div>;
  const sheet = sheets[active];
  return (
    <div className="sheet-viewer">
      {sheets.length > 1 && (
        <div className="sheet-tabs">
          {sheets.map((s, i) => (
            <button key={s.name} className={"sheet-tab" + (i === active ? " active" : "")} onClick={() => setActive(i)}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      {sheet.rows.length ? <GridTable rows={sheet.rows} /> : <div className="rail-muted artifact-table-note">Empty sheet.</div>}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(epochSeconds: number, locale?: string): string {
  if (!epochSeconds) return "";
  return new Date(epochSeconds * 1000).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}
