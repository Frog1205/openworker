import { useEffect, useState } from "react";
import { getRecentWorkspaces, openWorkspace, type RecentWorkspace } from "../api";
import { chooseFolder } from "../tauri";
import { useI18n } from "../I18nProvider";

// The mandatory workspace picker for project-scoped personas. Deliberately no
// "switch persona" escape hatch: if a persona needs a folder, the choice here is
// pick one or cancel — offering Chat as an exit undermined the persona the user
// just chose (owner call, 2026-07-03).
interface Props {
  onChoose: (path: string, branch?: string | null) => void;
  onCancel?: () => void; // present when changing folder mid-session
  create?: boolean; // "New project" mode: create the folder if missing
}

export function FolderGate({ onChoose, onCancel, create }: Props) {
  const { locale } = useI18n();
  const zh = locale === "zh-CN";
  const [recents, setRecents] = useState<RecentWorkspace[]>([]);
  const [path, setPath] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getRecentWorkspaces().then(setRecents).catch(() => {});
  }, []);

  const open = async (p: string, doCreate = false) => {
    setError("");
    const res = await openWorkspace(p.trim(), doCreate);
    if (res.ok) onChoose(res.path, res.git_branch);
    else setError(res.error || (zh ? "无法打开该文件夹" : "Could not open that folder"));
  };

  const browse = async () => {
    const picked = await chooseFolder();
    if (picked) {
      setPath(picked);
      open(picked, create); // a picked folder already exists; create flag is harmless
    }
  };

  return (
    <div className="gate-overlay">
      <div className="gate">
        <div className="gate-mark">✦</div>
        <h2>{create ? (zh ? "新建项目" : "New project") : (zh ? "选择项目空间" : "Choose a project folder")}</h2>
        <p className="gate-sub">
          {create
            ? (zh ? "选择文件夹或输入路径；路径不存在时会自动创建。" : "Pick a folder or enter a path. If the path doesn't exist, it will be created.")
            : (zh ? "Atlas 将在此空间内读取资料、编辑文件并执行任务。" : "Atlas uses this workspace to read, edit, and run tasks.")}
        </p>

        <div className="gate-input">
          <input
            placeholder={zh ? "输入项目文件夹路径" : "/path/to/your/project"}
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && open(path, create)}
            autoFocus
          />
          <button className="btn" onClick={browse} title={zh ? "从本机选择文件夹" : "Pick a folder"}>
            {zh ? "浏览…" : "Browse…"}
          </button>
          <button className="btn primary" onClick={() => open(path, create)} disabled={!path.trim()}>
            {create ? (zh ? "创建" : "Create") : (zh ? "打开" : "Open")}
          </button>
        </div>
        {error && <div className="gate-error">{error}</div>}

        {recents.length > 0 && (
          <>
            <div className="gate-label">{zh ? "最近使用" : "Recent"}</div>
            <div className="gate-recents">
              {recents.map((w) => (
                <div className="gate-recent" key={w.path} onClick={() => open(w.path)} title={w.path}>
                  <span className="folder">📁 {w.name}</span>
                  <span className="dim">{w.path}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {onCancel && (
          <div className="gate-foot">
            <button className="btn gate-cancel" onClick={onCancel}>
              {zh ? "取消" : "Cancel"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
