import { useState } from "react";
import type { Item } from "../types";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { useI18n } from "../I18nProvider";

type PlanItem = Extract<Item, { kind: "planreq" }>;

// The agent (in read-only plan mode) proposed a plan via propose_plan. The user approves it —
// choosing whether execution should keep asking per action or run with full access — or sends
// it back with feedback. Mirrors the directory-request card, shown in the composer head.
export function PlanCard({
  item,
  onRespond,
}: {
  item: PlanItem;
  onRespond: (approved: boolean, mode?: string, feedback?: string) => void;
}) {
  const { locale } = useI18n();
  const zh = locale === "zh-CN";
  const [rejecting, setRejecting] = useState(false);
  const [feedback, setFeedback] = useState("");

  return (
    <div className="dirreq-card plan-card">
      <div className="dirreq-head">
        <Icon name="sparkle" size={16} className="ico" />
        <span>{zh ? "Atlas 提交了一份执行计划" : "Atlas proposed a plan"}</span>
      </div>
      <div className="plan-body">
        <Markdown text={item.plan} />
      </div>
      {rejecting ? (
        <div className="dirreq-actions">
          <input
            className="dirreq-path"
            placeholder={zh ? "希望如何调整这份计划？" : "What should change about the plan?"}
            value={feedback}
            autoFocus
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && feedback.trim()) onRespond(false, undefined, feedback.trim());
            }}
          />
          <button className="btn" onClick={() => setRejecting(false)}>
            {zh ? "返回" : "Back"}
          </button>
          <button
            className="btn primary"
            disabled={!feedback.trim()}
            onClick={() => onRespond(false, undefined, feedback.trim())}
          >
            {zh ? "发送反馈" : "Send feedback"}
          </button>
        </div>
      ) : (
        <div className="dirreq-actions">
          <button className="btn" onClick={() => setRejecting(true)}>
            {zh ? "要求修改" : "Request changes"}
          </button>
          <span className="spacer" />
          <button className="btn" onClick={() => onRespond(true, "interactive")}>
            {zh ? "批准——关键步骤仍需确认" : "Approve — ask per step"}
          </button>
          <button className="btn primary" onClick={() => onRespond(true, "auto")}>
            {zh ? "批准并执行" : "Approve & run"}
          </button>
        </div>
      )}
    </div>
  );
}
