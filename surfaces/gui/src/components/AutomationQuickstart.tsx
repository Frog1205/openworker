import { useEffect, useRef, useState } from "react";
import {
  cloudLogin,
  connectManaged,
  getCloudStatus,
  getConnectors,
  getRecentChannels,
  waitForCloudSignIn,
  type CloudStatus,
  type Connector,
  type RecentChannel,
} from "../api";
import { ConnectorBadge } from "../connectors/ConnectorIcon";
import { ChannelPicker } from "./SubscriptionsChip";
import { SelectMenu } from "./SelectMenu";
import { useI18n } from "../I18nProvider";

// The Automations quickstart (UX-DECISIONS §29): ONE template system. The former onboarding
// recipe step (§24's role recipes) merged into the page's "Start from a template" grid — every
// card carries §27's connector-dot vocabulary (brand = connected, grayscale = needs connecting);
// picking a card expands the configure card below the grid: connect rows (with the lazy cloud
// sign-in pane), channel-by-name, day × time, and the §25 consent line for write recipes.
// The `ob-*` testids moved here with the machinery.

// "When" = day choice × free time (owner call 2026-07-11); the cron assembles from the two.
const DAYS: Record<string, { label: string; dow: string }> = {
  mon: { label: "Mondays", dow: "1" },
  tue: { label: "Tuesdays", dow: "2" },
  wed: { label: "Wednesdays", dow: "3" },
  thu: { label: "Thursdays", dow: "4" },
  fri: { label: "Fridays", dow: "5" },
  sat: { label: "Saturdays", dow: "6" },
  sun: { label: "Sundays", dow: "0" },
  weekdays: { label: "Weekdays", dow: "1-5" },
  daily: { label: "Every day", dow: "*" },
};
const DAYS_ZH: Record<string, { label: string; dow: string }> = {
  mon: { label: "每周一", dow: "1" }, tue: { label: "每周二", dow: "2" },
  wed: { label: "每周三", dow: "3" }, thu: { label: "每周四", dow: "4" },
  fri: { label: "每周五", dow: "5" }, sat: { label: "每周六", dow: "6" },
  sun: { label: "每周日", dow: "0" }, weekdays: { label: "工作日", dow: "1-5" },
  daily: { label: "每天", dow: "*" },
};
// §30 connect-state spinner (the app has no other spinner — waits elsewhere are label swaps).
// Exported for Onboarding page 2's sign-in button (same states, same look).
export const Spinner = () => (
  <span className="inline-block w-3 h-3 rounded-full border-[1.5px] border-line2 border-t-accent animate-spin" />
);

const cronFor = (dayKey: string, hhmm: string) => {
  const [h, m] = hhmm.split(":");
  return `${Number(m) || 0} ${Number(h) || 9} * * ${DAYS[dayKey]?.dow ?? "*"}`;
};

interface QuickTemplate {
  key: string;
  title: string;
  blurb: string;
  cadence: string; // the card's footer label
  conns: { name: string; why: string }[]; // [] = no connections needed
  needsRepo?: boolean;
  needsChannel?: boolean;
  consent?: boolean; // write recipes carry the §25 consent line; reads carry disclosure
  deliver?: boolean; // Morning brief's deliver-to choice
  day: string;
  time: string;
  instructions: (ctx: { repo: string; channel: string; deliver: "app" | "slack" }) => string;
}

const TEMPLATES: QuickTemplate[] = [
  {
    key: "github",
    title: "GitHub digest",
    blurb: "Merged PRs and commits, posted to your team's Slack.",
    cadence: "Weekly",
    conns: [
      { name: "slack", why: "Where the digest posts" },
      { name: "github", why: "What the digest summarizes" },
    ],
    needsRepo: true,
    needsChannel: true,
    consent: true,
    day: "mon",
    time: "09:00",
    instructions: ({ repo, channel }) =>
      `Summarize activity since the last digest in the GitHub repository ${repo || "(the connected repository)"}: ` +
      `merged pull requests, notable commits, and anything needing attention. ` +
      `Post the digest to the Slack channel ${channel} using send_message.`,
  },
  {
    key: "pipeline",
    title: "Pipeline digest",
    blurb: "Deals that moved — and deals going quiet — posted to Slack.",
    cadence: "Weekly",
    conns: [
      { name: "slack", why: "Where the digest posts" },
      { name: "hubspot", why: "Pipeline and deal activity" },
    ],
    needsChannel: true,
    consent: true,
    day: "mon",
    time: "09:00",
    instructions: ({ channel }) =>
      `Review HubSpot activity since the last digest: deals that changed stage, deals going ` +
      `quiet, and deals past their close date. Post a short pipeline digest to the Slack ` +
      `channel ${channel} using send_message.`,
  },
  {
    key: "brief",
    title: "Morning brief",
    blurb: "Calendar and unread email, summarized before your day starts.",
    cadence: "Daily",
    conns: [
      { name: "google_calendar", why: "Today's meetings and gaps" },
      { name: "gmail", why: "What arrived overnight" },
    ],
    deliver: true,
    day: "daily",
    time: "08:00",
    instructions: ({ deliver }) =>
      `Prepare a short morning brief: today's calendar events and gaps, plus email that ` +
      `arrived since yesterday evening. ` +
      (deliver === "app" ? "Save it as the session deliverable." : "Send it to me as a Slack DM."),
  },
  {
    key: "news",
    title: "Morning news briefing",
    blurb: "A 5-bullet tech & world news digest, saved as markdown.",
    cadence: "Daily",
    conns: [],
    day: "daily",
    time: "08:00",
    instructions: () =>
      "Search the web for the most important technology and world news from the last 24 hours " +
      "and write a concise 5-bullet briefing, saved as a markdown file.",
  },
  {
    key: "inboxdigest",
    title: "Inbox digest",
    blurb: "One short digest of your unread email.",
    cadence: "Weekdays",
    conns: [{ name: "gmail", why: "Your unread email" }],
    day: "weekdays",
    time: "09:00",
    instructions: () => "Summarize my unread email into one short digest note.",
  },
  {
    key: "cleanup",
    title: "Folder cleanup",
    blurb: "Sort recent Downloads into tidy folders by type.",
    cadence: "Weekly",
    conns: [],
    day: "fri",
    time: "17:30",
    instructions: () => "Sort my recent Downloads into tidy folders by file type.",
  },
];

const TEMPLATES_ZH: QuickTemplate[] = [
  {
    key: "github", title: "GitHub 项目周报", blurb: "汇总已合并的 PR 和重要提交，并发布到团队 Slack。", cadence: "每周",
    conns: [{ name: "slack", why: "接收周报的团队频道" }, { name: "github", why: "获取代码仓库动态" }],
    needsRepo: true, needsChannel: true, consent: true, day: "mon", time: "09:00",
    instructions: ({ repo, channel }) => `汇总 GitHub 仓库 ${repo || "（已连接的仓库）"} 自上次周报以来的动态：已合并的 PR、重要提交和需要关注的事项。使用 send_message 将精炼周报发送到 Slack 频道 ${channel}。`,
  },
  {
    key: "pipeline", title: "销售管道简报", blurb: "追踪阶段变化与停滞商机，并将重点同步到 Slack。", cadence: "每周",
    conns: [{ name: "slack", why: "接收简报的团队频道" }, { name: "hubspot", why: "获取商机阶段与跟进动态" }],
    needsChannel: true, consent: true, day: "mon", time: "09:00",
    instructions: ({ channel }) => `检查 HubSpot 自上次简报以来的动态：阶段发生变化、长期无进展以及超过预计成交日期的商机。使用 send_message 将精炼的销售管道简报发送到 Slack 频道 ${channel}。`,
  },
  {
    key: "brief", title: "每日工作简报", blurb: "在工作开始前整合今日日程与未读邮件，形成行动提示。", cadence: "每天",
    conns: [{ name: "google_calendar", why: "获取今日会议与可用时段" }, { name: "gmail", why: "梳理昨晚以来的新邮件" }],
    deliver: true, day: "daily", time: "08:00",
    instructions: ({ deliver }) => `生成一份精炼的每日工作简报：整理今天的日程、空闲时段，以及昨晚以来需要关注的邮件。${deliver === "app" ? "将结果保存为当前任务交付物。" : "通过 Slack 私信发送给我。"}`,
  },
  {
    key: "news", title: "每日资讯速览", blurb: "精选 5 条科技与全球要闻，保存为 Markdown 简报。", cadence: "每天", conns: [], day: "daily", time: "08:00",
    instructions: () => "检索过去 24 小时最重要的科技与全球新闻，筛选并写成 5 条简洁、有信息增量的要点，保存为 Markdown 文件。",
  },
  {
    key: "inboxdigest", title: "收件箱摘要", blurb: "将未读邮件压缩为一份简洁、可行动的摘要。", cadence: "工作日",
    conns: [{ name: "gmail", why: "读取需要处理的未读邮件" }], day: "weekdays", time: "09:00",
    instructions: () => "梳理我的未读邮件，按重要程度提炼为一份简短摘要，并明确需要回复或跟进的事项。",
  },
  {
    key: "cleanup", title: "下载目录整理", blurb: "按文件类型自动归类近期下载内容，让目录保持清晰。", cadence: "每周", conns: [], day: "fri", time: "17:30",
    instructions: () => "检查近期下载的文件，按文件类型整理到清晰的子目录中；遇到可能覆盖或删除文件的操作时先征求确认。",
  },
];

export function AutomationQuickstart({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (payload: {
    title: string;
    instructions: string;
    cron?: string;
    permissions?: { tool: string; target: string; access: "read" | "write" }[];
  }) => void;
}) {
  const { locale } = useI18n();
  const zh = locale === "zh-CN";
  const templates = zh ? TEMPLATES_ZH : TEMPLATES;
  const days = zh ? DAYS_ZH : DAYS;
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const picked = templates.find((t) => t.key === pickedKey) || null;

  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [cloud, setCloud] = useState<CloudStatus | null>(null);
  const [pendingConn, setPendingConn] = useState<string | null>(null);
  // §30 connect states: "opening" while the broker POST is in flight (the browser hasn't
  // appeared yet), "waiting" once it has — the handoff strip explains the out-of-band finish.
  const [connFlow, setConnFlow] = useState<{ name: string; phase: "opening" | "waiting" } | null>(
    null,
  );
  const [signinPhase, setSigninPhase] = useState<"opening" | "waiting" | null>(null);
  const [recent, setRecent] = useState<RecentChannel[]>([]);
  const [repo, setRepo] = useState("");
  const [channel, setChannel] = useState("");
  const [day, setDay] = useState("mon");
  const [time, setTime] = useState("09:00");
  const [deliver, setDeliver] = useState<"app" | "slack">("app");
  const [consent, setConsent] = useState(true);

  const refresh = () => {
    getConnectors().then(setConnectors).catch(() => {});
    getCloudStatus().then(setCloud).catch(() => {});
  };
  // Connector state drives the card dots, so load once up front; poll only while a template
  // is being configured (connects and the cloud sign-in land out-of-band).
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    if (!picked) return;
    refresh();
    getRecentChannels().then(setRecent).catch(() => {});
    pollRef.current = setInterval(refresh, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedKey]);

  const connState = (name: string) => connectors.find((c) => c.name === name);
  const allConnected = !picked || picked.conns.every((c) => connState(c.name)?.connected);
  // §25 consent line shows the HUMAN name (owner catch 2026-07-14: it echoed the raw
  // slack:T…/C… target). Names come from a picker pick (remembered per address) or the
  // recent list; a hand-typed raw address stays raw — we never guess.
  const [picked_names, setPickedNames] = useState<Record<string, { name: string; workspace?: string }>>({});
  const pickedInfo = picked_names[channel];
  const channelName = pickedInfo?.name || recent.find((c) => c.channel === channel)?.name;
  const channelLabel = channelName ? `#${channelName}` : channel;
  const channelWorkspace = pickedInfo?.workspace;

  // The poll flipping a row to ✓ is what ends its waiting state.
  useEffect(() => {
    if (connFlow && connState(connFlow.name)?.connected) setConnFlow(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectors]);

  // §30: the configure card scrolls into view on pick — it expands below the fold on
  // three-row grids and otherwise appears "nowhere".
  const cfgRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (pickedKey) cfgRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [pickedKey]);

  const pick = (t: QuickTemplate) => {
    setPickedKey(t.key);
    setDay(t.day);
    setTime(t.time);
    setConsent(true);
    setConnFlow(null);
  };

  const startConnect = async (name: string) => {
    if (!cloud?.signed_in) {
      setPendingConn(name); // the pane appears; sign-in completes it
      return;
    }
    // §30: the broker round-trip takes seconds — narrate it on the row itself.
    setConnFlow({ name, phase: "opening" });
    // GitHub is authorize-first at the BROKER: one connect links an existing
    // installation or lands on the install page — no flow choice here anymore.
    await connectManaged(name).catch(() => {});
    // The POST resolves once the system browser is off; the poll ends the waiting state.
    setConnFlow((f) => (f?.name === name ? { name, phase: "waiting" } : f));
    refresh();
  };

  const signinPollRef = useRef<(() => void) | null>(null);
  const cancelSignin = () => {
    signinPollRef.current?.();
    signinPollRef.current = null;
    setSigninPhase(null);
  };
  useEffect(() => cancelSignin, []); // never leave the poll running after unmount

  const signInThenConnect = async () => {
    setSigninPhase("opening");
    await cloudLogin().catch(() => {});
    setSigninPhase("waiting");
    // Poll until the browser flow lands, then finish the pending connect (bounded).
    signinPollRef.current = waitForCloudSignIn(async (s) => {
      signinPollRef.current = null;
      setSigninPhase(null);
      if (!s?.signed_in) return;
      setCloud(s);
      if (pendingConn) {
        const name = pendingConn;
        setConnFlow({ name, phase: "opening" });
        await connectManaged(name).catch(() => {});
        setConnFlow((f) => (f?.name === name ? { name, phase: "waiting" } : f));
        setPendingConn(null);
        refresh();
      }
    });
  };

  const create = () => {
    if (!picked) return;
    onCreate({
      title: picked.title,
      instructions: picked.instructions({ repo, channel, deliver }),
      cron: cronFor(day, time),
      permissions:
        picked.consent && consent && channel
          ? [{ tool: "send_message", target: channel, access: "write" }]
          : [],
    });
  };

  const gateHint = !allConnected
    ? `${zh ? "请先连接" : "Connect"} ${picked?.conns
        .filter((c) => !connState(c.name)?.connected)
        .map((c) => connState(c.name)?.title || c.name)
        .join(zh ? "、" : " and ")}${zh ? " 后继续" : " to continue"}`
    : picked?.needsChannel && !channel
      ? (zh ? "请先选择接收内容的频道" : "Pick a channel to post to first")
      : "";

  const label = "block text-[12px] text-muted mt-3 mb-1";
  const input =
    "w-full px-3 py-2 rounded-lg border border-line bg-panel text-[13.5px] outline-none focus:border-accent";

  return (
    <div className="mb-4">
      <div className="text-[11px] uppercase tracking-[0.05em] text-faint mb-2.5">
        {zh ? "从模板开始" : "Start from a template"}
      </div>
      {/* Equal-height cards (owner ask 2026-07-12): 1fr rows + h-full — <button> grid items
          don't stretch like divs. */}
      <div className="grid grid-cols-3 auto-rows-fr gap-3">
        {templates.map((t) => (
          <button
            key={t.key}
            data-testid={`qs-template-${t.key}`}
            className={
              "h-full text-left rounded-xl2 border bg-panel p-4 flex flex-col gap-1.5 " +
              (pickedKey === t.key
                ? "border-accent ring-2 ring-accentSoft"
                : "border-line hover:border-lineStrong")
            }
            onClick={() => pick(t)}
          >
            <span className="text-[13.5px] font-semibold">{t.title}</span>
            <span className="text-[12px] text-muted leading-relaxed flex-1">{t.blurb}</span>
            <span className="flex items-center gap-1.5 mt-1">
              {t.conns.map((c) => {
                const cs = connState(c.name);
                const on = !!cs?.connected;
                return (
                  <span
                    key={c.name}
                    title={`${cs?.title || c.name} — ${on ? (zh ? "已连接" : "connected") : (zh ? "尚未连接" : "not connected yet")}`}
                    style={on ? undefined : { filter: "grayscale(1)", opacity: 0.55 }}
                  >
                    {cs ? (
                      <ConnectorBadge connector={cs} size={16} title={cs.title} />
                    ) : (
                      <span className="inline-block w-4 h-4 rounded-full border border-line2" />
                    )}
                  </span>
                );
              })}
              <span className="text-[11px] text-faint ml-0.5">
                {t.conns.length === 0 ? `${zh ? "无需连接外部服务" : "No connections needed"} · ${t.cadence}` : t.cadence}
              </span>
            </span>
          </button>
        ))}
      </div>

      {picked && (
        <div
          ref={cfgRef}
          className="mt-3 rounded-xl2 border border-line bg-panel p-4"
          data-testid="qs-configure"
        >
          {/* §30: the card names its template — without this it starts abruptly after the grid. */}
          <div className="flex items-baseline gap-2 pb-2.5 mb-1 border-b border-line">
            <span className="text-[11px] uppercase tracking-[0.05em] text-accent font-semibold">
              {zh ? "配置" : "Set up"}
            </span>
            <span className="text-[14px] font-semibold">{picked.title}</span>
            <span className="ml-auto text-[12px] text-faint max-sm:hidden">
              {picked.conns.length ? (zh ? "连接、交付与计划" : "Connections, delivery & schedule") : (zh ? "交付与计划" : "Delivery & schedule")} ·{" "}
              {picked.cadence}
            </span>
          </div>
          {picked.conns.map(({ name, why }) => {
            const c = connState(name);
            const flow = connFlow?.name === name ? connFlow : null;
            return (
              <div key={name} className="border-b border-line last:border-b-0">
                <div className="flex items-center gap-3 py-2.5">
                  {c && <ConnectorBadge connector={c} size={26} title={c.title} />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium">{c?.title || name}</span>
                    <span className="block text-[11.5px] text-faint">{why}</span>
                  </span>
                  {c?.connected ? (
                    <span className="text-[12.5px] text-ok">✓ {zh ? "已连接" : "Connected"}</span>
                  ) : flow ? (
                    <span className="inline-flex items-center gap-2 text-[12px] text-muted">
                      <Spinner />
                      {flow.phase === "opening"
                        ? (zh ? "正在打开浏览器…" : "Opening browser…")
                        : `${zh ? "正在等待" : "Waiting for"} ${c?.title || name}…`}
                    </span>
                  ) : (
                    <button
                      className="px-3.5 py-1 rounded-full border border-line text-[12.5px] hover:bg-paper"
                      onClick={() => startConnect(name)}
                      data-testid={`ob-connect-${name}`}
                    >
                      {zh ? "连接" : "Connect"}
                    </button>
                  )}
                </div>
                {/* §30 handoff strip: the flow finishes out-of-band in the browser — say so,
                    and let Cancel clear the LOCAL state (the browser tab is the user's). */}
                {flow?.phase === "waiting" && (
                  <div
                    className="flex items-start gap-2 bg-accentSoft/50 rounded-lg px-3 py-2 mb-2.5 text-[12px] text-muted"
                    data-testid="ob-connect-wait"
                  >
                    <span>↗</span>
                    <span className="flex-1 min-w-0">
                      <b className="text-ink font-medium">
                        {zh ? `请在浏览器中完成 ${c?.title || name} 的连接。` : `Finish connecting ${c?.title || name} in your browser.`}
                      </b>{" "}
                      {zh ? "授权完成后返回此处，页面会自动更新。" : "Approve it there, then come back — this page updates by itself."}
                    </span>
                    <button
                      className="text-faint underline hover:text-muted shrink-0"
                      onClick={() => setConnFlow(null)}
                      data-testid="ob-connect-cancel"
                    >
                      {zh ? "取消" : "Cancel"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {pendingConn && !cloud?.signed_in && (
            <div
              className="bg-accentSoft/50 rounded-xl px-4 py-3 mt-3 text-[12.5px] text-muted"
              data-testid="ob-cloudpane"
            >
              <span className="block text-[13px] text-ink font-medium">
                {zh ? "登录一次，即可使用所有快捷连接" : "One sign-in unlocks every one-click connection"}
              </span>
              {zh ? "连接由 Atlas Worker Cloud 协调，访问令牌仍安全保存在本机。" : "Connections are brokered by Atlas Worker Cloud — your tokens stay on this computer."}
              <div className="flex items-center gap-3 mt-2">
                {signinPhase ? (
                  <>
                    <span className="inline-flex items-center gap-2 text-[12px]">
                      <Spinner />
                      {signinPhase === "opening" ? (zh ? "正在打开浏览器…" : "Opening browser…") : (zh ? "正在等待登录…" : "Waiting for sign-in…")}
                    </span>
                    {signinPhase === "waiting" && (
                      <span className="text-[11.5px] text-faint">
                        {zh ? "请在浏览器中完成登录，页面会自动更新。" : "Finish signing in in your browser — this page updates by itself."}{" "}
                        <button
                          className="underline hover:text-muted"
                          onClick={cancelSignin}
                          data-testid="ob-signin-cancel"
                        >
                          {zh ? "取消" : "Cancel"}
                        </button>
                      </span>
                    )}
                  </>
                ) : (
                  <button
                    className="px-3.5 py-1 rounded-full border border-line text-[12.5px] text-accent hover:bg-panel"
                    onClick={signInThenConnect}
                    data-testid="ob-cloud-signin"
                  >
                    {zh ? "登录 Atlas Worker Cloud" : "Sign in to Atlas Worker Cloud"}
                  </button>
                )}
              </div>
            </div>
          )}

          {allConnected && (
            <div className={picked.conns.length ? "bg-paper rounded-xl px-4 py-3.5 mt-3" : ""} data-testid="ob-recipe">
              {picked.needsRepo && (
                <>
                  <label className={label}>{zh ? "代码仓库" : "Repository"}</label>
                  <input
                    className={input}
                    placeholder="owner/repo"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    data-testid="ob-repo"
                  />
                </>
              )}
              {picked.needsChannel && (
                <>
                  <label className={label}>{zh ? "发送到频道" : "Post to channel"}</label>
                  <div data-testid="ob-channel">
                    <ChannelPicker
                      value={channel}
                      onChange={setChannel}
                      recent={recent}
                      onPickName={(address, name, workspace) =>
                        setPickedNames((m) => ({ ...m, [address]: { name, workspace } }))
                      }
                    />
                  </div>
                  <p className="text-[11px] text-warnInk mt-1">
                    {zh ? "Atlas 必须已加入该频道；若尚未加入，请在 Slack 中邀请 @AtlasWorker。" : "The bot must be a member of the channel — invite @AtlasWorker in Slack if it isn't."}
                  </p>
                </>
              )}
              <label className={label}>{zh ? "执行计划" : "When"}</label>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <SelectMenu
                    ariaLabel={zh ? "日期" : "Day"}
                    value={day}
                    options={Object.entries(days).map(([k, v]) => ({ value: k, label: v.label }))}
                    onChange={setDay}
                  />
                </div>
                <input
                  className="w-28 px-3 py-2 rounded-lg border border-line bg-panel text-[13.5px] outline-none focus:border-accent"
                  type="time"
                  aria-label={zh ? "时间" : "Time"}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
              {picked.deliver && (
                <>
                  <label className={label}>{zh ? "交付到" : "Deliver to"}</label>
                  <SelectMenu
                    ariaLabel={zh ? "交付到" : "Deliver to"}
                    value={deliver}
                    options={[
                      { value: "app", label: zh ? "当前应用" : "In the app" },
                      { value: "slack", label: zh ? "Slack 私信（稍后连接 Slack）" : "Slack DM (connect Slack later)" },
                    ]}
                    onChange={(v) => setDeliver(v as "app" | "slack")}
                  />
                </>
              )}
              {picked.consent ? (
                <label className="flex items-start gap-2.5 mt-3.5 text-[12.5px] text-muted select-none">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    data-testid="ob-consent"
                  />
                  <span>
                    {zh ? "允许此自动化无需逐次确认，直接将简报发布到" : "Allow this automation to post its digest to"}{" "}
                    <b className="text-ink" title={channel || undefined}>
                      {channelLabel || (zh ? "所选频道" : "the channel")}
                      {channelWorkspace ? ` (${channelWorkspace})` : ""}
                    </b>{" "}
                    {zh ? "。其他操作仍会先征求你的确认。" : "without asking each time. Anything else still asks first."}
                  </span>
                </label>
              ) : picked.conns.length > 0 ? (
                <p className="text-[12.5px] text-muted mt-3">
                  {zh ? <>此自动化按计划仅执行<b className="text-ink">读取</b>操作，无需额外确认。</> : <>This automation only <b className="text-ink">reads</b> on schedule — reading never needs approval.</>}
                </p>
              ) : null}
            </div>
          )}

          <div className="flex items-center gap-3 mt-4">
            <button
              className="text-[12.5px] text-faint hover:text-muted"
              onClick={() => setPickedKey(null)}
            >
              {zh ? "取消" : "Cancel"}
            </button>
            {/* A silently-disabled primary reads as a bug — always name the missing piece. */}
            {gateHint && (
              <span className="ml-auto text-[11.5px] text-faint" data-testid="ob-create-hint">
                {gateHint}
              </span>
            )}
            <button
              className={
                (gateHint ? "" : "ml-auto ") +
                "px-5 py-2 rounded-full bg-ink text-panel text-[13px] disabled:opacity-40"
              }
              disabled={busy || !allConnected || (picked.needsChannel && !channel)}
              onClick={create}
              data-testid="ob-create"
            >
              {busy ? (zh ? "正在创建…" : "Creating…") : (zh ? "创建自动化" : "Create automation")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
