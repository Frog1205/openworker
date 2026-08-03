import { useState } from "react";
import { type CloudStatus, type Connector, type SlackStatus } from "../../api";
import { ConnectorBadge } from "../../connectors/ConnectorIcon";
import { connectorBlurb, connectorTitle } from "../../connectors/locale";
import { useI18n } from "../../I18nProvider";
import { AddConnectionModal } from "./AddConnectionModal";
import { CHIP_OK, CHIP_OFF, CHIP_WARN, GRP, GRP_H, FOOT, PILL_QUIET, ROW } from "./ui";

const AVAILABLE_FOLD = 8;

export function ConnectorsList({
  connectors,
  cloud,
  slack,
  onOpen,
  onChanged,
}: {
  connectors: Connector[];
  cloud: CloudStatus | null;
  slack: SlackStatus | null;
  onOpen: (name: string) => void;
  onChanged: () => void;
}) {
  const { locale } = useI18n();
  const zh = locale === "zh-CN";
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  const q = filter.trim().toLowerCase();
  const match = (c: Connector) =>
    !q ||
    connectorTitle(c, locale).toLowerCase().includes(q) ||
    c.title.toLowerCase().includes(q) ||
    c.name.includes(q);
  const connected = connectors.filter((c) => c.connected && match(c));
  const available = connectors.filter((c) => !c.connected && c.available && match(c));
  const shown = showAll || q ? available : available.slice(0, AVAILABLE_FOLD);
  const connectingC = connecting ? connectors.find((c) => c.name === connecting) : null;

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <input
          placeholder={zh ? "搜索连接器" : "Search"}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-44 px-3.5 py-1.5 rounded-full border border-line bg-panel text-[13px] outline-none focus:border-accent"
        />
      </div>

      {connected.length > 0 && (
        <>
          <div className={GRP_H + " !mt-0"}>
            {zh ? `已连接 · ${connected.length}` : `Connected · ${connected.length}`}
          </div>
          <div className={GRP}>
            {connected.map((c) => (
              <button
                key={c.name}
                data-testid={`connector-${c.name}`}
                className={ROW + " w-full text-left hover:bg-paper/60"}
                onClick={() => onOpen(c.name)}
              >
                <ConnectorBadge connector={c} size={34} title={connectorTitle(c, locale)} />
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-[13.5px]">{connectorTitle(c, locale)}</span>
                  <span className="block text-[12px] text-muted">{statusLine(c, zh)}</span>
                </span>
                {healthChip(c, slack, zh)}
                <span className="text-faint text-[15px] shrink-0">›</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className={GRP_H}>{zh ? "可连接" : "Available"}</div>
      <div className={GRP}>
        {shown.map((c) => (
          <button
            key={c.name}
            data-testid={`connector-${c.name}`}
            className={ROW + " w-full text-left hover:bg-paper/60"}
            onClick={() => onOpen(c.name)}
          >
            <ConnectorBadge connector={c} size={34} title={connectorTitle(c, locale)} />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-[13.5px]">{connectorTitle(c, locale)}</span>
              <span className="block text-[12px] text-muted truncate">{connectorBlurb(c, locale)}</span>
            </span>
            <span
              className={PILL_QUIET + " cursor-pointer"}
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                setConnecting(c.name);
              }}
            >
              {zh ? "连接" : "Connect"}
            </span>
          </button>
        ))}
        {shown.length === 0 && (
          <div className={ROW + " text-[12.5px] text-muted"}>
            {zh ? "没有匹配的连接器。" : "Nothing matches."}
          </div>
        )}
      </div>
      {!showAll && !q && available.length > AVAILABLE_FOLD && (
        <div className={FOOT}>
          {zh ? `还有 ${available.length - AVAILABLE_FOLD} 个 · ` : `${available.length - AVAILABLE_FOLD} more · `}
          <button className="text-muted hover:text-ink" onClick={() => setShowAll(true)}>
            {zh ? "显示全部" : "show all"}
          </button>
        </div>
      )}

      {connectingC && (
        <AddConnectionModal
          c={connectingC}
          cloud={cloud}
          onClose={() => setConnecting(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

function statusLine(c: Connector, zh: boolean): string {
  if (c.name === "slack" && c.mode === "relay") {
    const n = c.workspaces?.length ?? 0;
    return zh ? `${n} 个工作区 · 云端中继` : `${n} workspace${n === 1 ? "" : "s"} · relay`;
  }
  if ((c.accounts?.length ?? 0) > 1)
    return zh ? `${c.accounts!.length} 个账户` : `${c.accounts!.length} accounts`;
  if ((c.portals?.length ?? 0) > 1)
    return zh ? `${c.portals!.length} 个门户` : `${c.portals!.length} portals`;
  if (c.auth === "none") return zh ? "内置能力" : "Built in";
  return c.account || (zh ? "已连接" : "Connected");
}

function healthChip(c: Connector, slack: SlackStatus | null, zh: boolean) {
  if (c.name === "slack" && c.mode === "relay" && slack) {
    if (!slack.signed_in)
      return <span className={CHIP_WARN}>● {zh ? "需要登录" : "Sign-in needed"}</span>;
    if (slack.relay.state === "offline")
      return <span className={CHIP_OFF}>● {zh ? "离线" : "Offline"}</span>;
    if (slack.relay.state === "reconnecting")
      return <span className={CHIP_WARN}>● {zh ? "正在重连" : "Reconnecting"}</span>;
    if (Object.values(slack.teams).some((t) => !t.token_ok))
      return <span className={CHIP_WARN}>⚠ Token</span>;
    return <span className={CHIP_OK}>● {zh ? "在线" : "Live"}</span>;
  }
  if (c.two_way && c.connected)
    return <span className={CHIP_OK}>● {zh ? "在线" : "Live"}</span>;
  return <span className={CHIP_OK}>● {zh ? "可用" : "Ready"}</span>;
}
