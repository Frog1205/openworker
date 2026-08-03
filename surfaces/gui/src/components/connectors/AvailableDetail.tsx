import { useState } from "react";
import { type CloudStatus, type Connector } from "../../api";
import { ConnectorBadge } from "../../connectors/ConnectorIcon";
import { AddConnectionModal } from "./AddConnectionModal";
import { FOOT, GRP, GRP_H, PILL_ACCENT, ROW, TAG_QUIET } from "./ui";
import { useI18n } from "../../I18nProvider";
import { connectorAbout, connectorAccess, connectorBlurb, connectorTitle, connectorToolCopy } from "../../connectors/locale";

// Pre-connect detail page (UX-DECISIONS §38): what a connector is for and what
// access it gets, BEFORE any credentials exist. About paragraph, honest Access
// bullets, and the tool list behind a collapsed disclosure (advanced-reader
// detail — no enable/disable pre-connect; that lever lives on the connected
// page). Connect opens the same add-connection modal as the list's pill.

export function AvailableDetail({
  c,
  cloud,
  onChanged,
}: {
  c: Connector;
  cloud: CloudStatus | null;
  onChanged: () => void;
}) {
  const { locale } = useI18n();
  const zh = locale === "zh-CN";
  const [connecting, setConnecting] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const tools = c.tools || [];
  const access = connectorAccess(c, locale);

  return (
    <div data-testid="available-detail">
      <div className="flex items-center gap-3.5 mb-5">
        <ConnectorBadge connector={c} size={44} title={connectorTitle(c, locale)} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-semibold tracking-tight leading-tight">{connectorTitle(c, locale)}</h2>
          <div className="text-[12.5px] text-muted">{connectorBlurb(c, locale)}</div>
        </div>
        <button
          className={PILL_ACCENT}
          data-testid="available-connect"
          onClick={() => setConnecting(true)}
        >
          {zh ? "连接" : "Connect"}
        </button>
      </div>

      {(c.about || zh) && <p className="text-[13px] text-ink/90 leading-relaxed mb-1 px-0.5">{connectorAbout(c, locale)}</p>}

      {access.length > 0 && (
        <>
          <div className={GRP_H}>{zh ? "授权范围" : "Access"}</div>
          <div className={GRP} data-testid="available-access">
            {access.map((line) => (
              <div key={line} className={ROW + " !min-h-[36px] !py-2 text-[13px]"}>
                {line}
              </div>
            ))}
          </div>
          <div className={FOOT}>
            {zh ? "密钥与令牌仅保存在当前设备上，你可以随时断开连接。" : "Keys and tokens are stored only on this computer. Disconnect anytime."}
          </div>
        </>
      )}

      {tools.length > 0 && (
        <>
          <div className={GRP_H}>{zh ? "可用工具" : "Tools"}</div>
          <div className={GRP}>
            <button
              className={ROW + " w-full text-left hover:bg-paper/60 text-[13px]"}
              data-testid="available-tools-toggle"
              onClick={() => setShowTools((v) => !v)}
            >
              <span className="min-w-0 flex-1 text-muted">
                {zh ? `连接后将增加 ${tools.length} 项工具能力` : `${tools.length} tool${tools.length === 1 ? "" : "s"} this connector adds`}
              </span>
              <span className="text-faint text-[13px] shrink-0">{showTools ? (zh ? "收起" : "Hide") : (zh ? "查看" : "View")}</span>
            </button>
            {showTools &&
              tools.map((t) => {
                const copy = connectorToolCopy(t, locale);
                return <div key={t.name} className={ROW + " !min-h-[38px]"}>
                  <span className="min-w-0 flex-1">
                    <span className="text-[13px]">{copy.label}</span>
                    <span className="block text-[12px] text-muted">{copy.description}</span>
                  </span>
                  {t.kind !== "read" && <span className={TAG_QUIET}>{zh ? "操作前确认" : "asks first"}</span>}
                </div>;
              })}
          </div>
        </>
      )}

      {connecting && (
        <AddConnectionModal
          c={c}
          cloud={cloud}
          onClose={() => setConnecting(false)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
