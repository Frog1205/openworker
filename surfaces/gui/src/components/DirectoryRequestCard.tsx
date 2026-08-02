import { useState } from "react";
import type { Item } from "../types";
import { chooseFolder } from "../tauri";
import { Icon } from "./Icon";
import { useI18n } from "../I18nProvider";

type DirReqItem = Extract<Item, { kind: "dirreq" }>;

// The agent asked (via request_directory) for access to a folder. The user picks/confirms a path
// and access level, or declines — mirroring the approval card, shown in the composer head.
export function DirectoryRequestCard({
  item,
  onRespond,
}: {
  item: DirReqItem;
  onRespond: (granted: boolean, path?: string, writable?: boolean) => void;
}) {
  const { locale } = useI18n();
  const zh = locale === "zh-CN";
  const [path, setPath] = useState(item.path || "");
  const [writable, setWritable] = useState(!!item.writable);

  const browse = async () => {
    const picked = await chooseFolder();
    if (picked) setPath(picked);
  };

  return (
    <div className="dirreq-card">
      <div className="dirreq-head">
        <Icon name="folderPlus" size={16} className="ico" />
        <span>{zh ? "Atlas 请求访问一个文件夹" : "Atlas is requesting access to a folder"}</span>
      </div>
      {item.reason && <div className="dirreq-reason">“{item.reason}”</div>}
      <div className="dirreq-pathrow">
        <input
          className="dirreq-path"
          placeholder={zh ? "选择或粘贴文件夹路径…" : "Choose or paste a folder path…"}
          value={path}
          onChange={(e) => setPath(e.target.value)}
        />
        <button className="btn icon-only" onClick={browse} title={zh ? "选择位置" : "Choose location"} aria-label={zh ? "选择位置" : "Choose location"}>
          <Icon name="folder" size={15} />
        </button>
      </div>
      <div className="dirreq-actions">
        <label className="dirreq-access">
          <input type="checkbox" checked={writable} onChange={(e) => setWritable(e.target.checked)} />
          {zh ? "允许写入（读写权限）" : "Allow writing (read-write)"}
        </label>
        <span className="spacer" />
        <button className="btn" onClick={() => onRespond(false)}>
          {zh ? "拒绝" : "Decline"}
        </button>
        <button className="btn primary" disabled={!path.trim()} onClick={() => onRespond(true, path.trim(), writable)}>
          {zh ? "授权访问" : "Grant access"}
        </button>
      </div>
    </div>
  );
}
