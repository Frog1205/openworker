import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { getRecentWorkspaces, openWorkspace, type RecentWorkspace } from "../api";
import { chooseFolder } from "../tauri";
import { useI18n } from "../I18nProvider";
import { Icon } from "./Icon";

interface Props {
  current: string;
  onChoose: (path: string, branch?: string | null) => void;
  onClear: () => void;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}

export function WorkspacePicker({ current, onChoose, onClear, onClose, anchorRef }: Props) {
  const { locale } = useI18n();
  const zh = locale === "zh-CN";
  const [recents, setRecents] = useState<RecentWorkspace[]>([]);
  const [creating, setCreating] = useState(false);
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
  const [position, setPosition] = useState({ left: 8, top: 8 });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(310, Math.max(220, document.documentElement.clientWidth - 24));
      const left = Math.max(8, Math.min(rect.left, document.documentElement.clientWidth - width - 8));
      setPosition({ left, top: Math.max(8, rect.top - 8) });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [anchorRef]);

  useEffect(() => {
    getRecentWorkspaces().then(setRecents).catch(() => setRecents([]));
  }, []);

  const choose = async (target: string, create = false) => {
    setError("");
    const result = await openWorkspace(target.trim(), create);
    if (result.ok) {
      onChoose(result.path, result.git_branch);
      onClose();
    } else {
      setError(result.error || (zh ? "无法打开该项目空间" : "Could not open that workspace"));
    }
  };

  const browse = async () => {
    const picked = await chooseFolder();
    if (picked) {
      setPath(picked);
      if (creating) void choose(picked, true);
    }
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[100]" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed z-[101] w-[310px] max-w-[calc(100vw-1.5rem)] -translate-y-full rounded-2xl border border-line bg-panel shadow-2xl p-2"
        style={{ left: position.left, top: position.top }}
        role="menu"
        aria-label={zh ? "选择项目空间" : "Choose project workspace"}
      >
        {!creating ? (
          <>
            <div className="px-2 py-1.5 text-[11px] text-faint uppercase tracking-wide">
              {zh ? "最近项目" : "Recent projects"}
            </div>
            <div className="max-h-[230px] overflow-y-auto">
              {recents.map((workspace) => {
                const selected = current === workspace.path;
                return (
                  <button
                    type="button"
                    role="menuitem"
                    key={workspace.path}
                    className={
                      "w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-[13px] " +
                      (selected ? "bg-paper" : "hover:bg-paper")
                    }
                    onClick={() => void choose(workspace.path)}
                  >
                    <Icon name="folder" size={16} className="text-muted shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                    {selected && <span className="text-[17px] leading-none">✓</span>}
                  </button>
                );
              })}
              {recents.length === 0 && (
                <div className="px-2.5 py-3 text-[12px] text-muted">
                  {zh ? "还没有最近项目" : "No recent projects"}
                </div>
              )}
            </div>
            <div className="my-1 border-t border-line" />
            <button
              type="button"
              role="menuitem"
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-[13px] hover:bg-paper"
              onClick={() => {
                setCreating(true);
                setError("");
              }}
            >
              <span className="w-4 text-center text-[18px] leading-none">＋</span>
              {zh ? "新建项目" : "New project"}
            </button>
            {current && (
              <button
                type="button"
                role="menuitem"
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-[13px] hover:bg-paper"
                onClick={() => {
                  onClear();
                  onClose();
                }}
              >
                <span className="w-4 text-center text-[18px] leading-none">×</span>
                {zh ? "不在项目中工作" : "Don't work in a project"}
              </button>
            )}
          </>
        ) : (
          <div className="p-1">
            <div className="flex items-center gap-2 px-1 pb-2">
              <button type="button" className="text-muted hover:text-ink" onClick={() => setCreating(false)} aria-label={zh ? "返回项目列表" : "Back to projects"}>
                ‹
              </button>
              <span className="font-medium text-[13px]">{zh ? "新建项目" : "New project"}</span>
            </div>
            <p className="px-1 pb-2 text-[12px] text-muted">
              {zh ? "选择一个新文件夹作为项目空间。" : "Choose a new folder for this project."}
            </p>
            <div className="flex gap-1.5">
              <input
                autoFocus
                value={path}
                onChange={(event) => setPath(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void choose(path, true)}
                placeholder={zh ? "输入文件夹路径" : "Folder path"}
                className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2.5 py-2 text-[12px] outline-none focus:border-accent"
              />
              <button type="button" className="rounded-lg border border-line px-2 text-[12px] hover:bg-paper" onClick={() => void browse()}>
                {zh ? "浏览" : "Browse"}
              </button>
            </div>
            {error && <div className="px-1 pt-2 text-[12px] text-danger">{error}</div>}
            <button
              type="button"
              className="mt-2 w-full rounded-lg bg-accent px-3 py-2 text-[12px] text-white disabled:opacity-50"
              disabled={!path.trim()}
              onClick={() => void choose(path, true)}
            >
              {zh ? "创建并开始" : "Create and start"}
            </button>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
