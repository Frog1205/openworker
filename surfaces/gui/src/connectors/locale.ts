import type { Connector, ConnectorTool } from "../api";
import type { Locale } from "../i18n";

const ZH_TITLES: Record<string, string> = {
  browser: "浏览器",
  email: "邮箱（IMAP）",
  imap: "邮箱（IMAP）",
};

const ZH_BLURBS: Record<string, string> = {
  browser: "访问网页、检索信息，并在浏览器中完成操作。",
  telegram: "通过 Telegram Bot 接收任务、持续对话并发送结果。",
  slack: "在 Slack 中获取协作上下文、响应请求，并在授权后发送消息。",
  email: "连接任意 IMAP 邮箱，让 Atlas 检索、阅读和发送邮件。",
  imap: "连接任意 IMAP 邮箱，让 Atlas 检索、阅读和发送邮件。",
  gmail: "检索和整理 Gmail 邮件，起草回复并在授权后发送。",
  google_calendar: "查看空闲时段、整理日程，并在授权后创建或调整事件。",
  github: "处理 Issue、Pull Request、仓库文件与 CI 状态。",
  outlook: "协同处理 Microsoft 365 邮件、日历、会议邀请与日程。",
  amplitude: "查询 Amplitude 产品数据、用户行为与关键指标。",
  apollo: "检索并补充企业与联系人信息，辅助销售研究与跟进。",
  asana: "读取和管理 Asana 任务、项目及协作进度。",
  attio: "读取 Attio CRM 中的对象、记录与业务备注。",
  box: "在 Box 中检索、浏览和读取文件。",
  canva: "在 Canva 中查找、创建并导出设计内容。",
  clickup: "读取和管理 ClickUp 任务、文档与项目进度。",
  close: "检索 Close CRM 中的线索、联系人与销售活动。",
  confluence: "检索并读取 Confluence 知识库与团队文档。",
  discord: "在 Discord 中读取上下文、响应消息并发送结果。",
  docusign: "查询 DocuSign 信封、签署状态与相关信息。",
  dropbox: "在 Dropbox 中查找、浏览和读取文件。",
  figma: "读取 Figma 设计文件、页面和团队协作上下文。",
  gitlab: "处理 GitLab Issue、Merge Request、仓库文件与流水线状态。",
  google_drive: "在 Google Drive 中检索、整理和读取文件。",
  hubspot: "查询 HubSpot CRM 线索、交易阶段与客户跟进信息。",
  hunter: "检索企业联系人与公开邮箱，辅助销售研究。",
  jira: "读取和管理 Jira Issue、项目与迭代进度。",
  linear: "读取和管理 Linear Issue、项目与团队进度。",
  mixpanel: "查询 Mixpanel 产品分析、事件与用户行为数据。",
  monday: "读取和管理 monday.com 看板、事项与项目进度。",
  notion: "检索和读取 Notion 页面、数据库与团队知识。",
  posthog: "查询 PostHog 事件、漏斗、留存与产品分析数据。",
  quickbooks: "查询 QuickBooks 客户、发票与财务记录。",
  stripe: "查询 Stripe 客户、付款、订阅与账单信息。",
  whatsapp: "通过 WhatsApp 接收任务、持续对话并发送结果。",
  zendesk: "检索和处理 Zendesk 工单、客户与支持上下文。",
};

export function connectorTitle(c: Connector, locale: Locale): string {
  return locale === "zh-CN" ? ZH_TITLES[c.name] || c.title : c.title;
}

export function connectorBlurb(c: Connector, locale: Locale): string {
  if (locale !== "zh-CN") return c.blurb;
  return ZH_BLURBS[c.name] || `连接 ${connectorTitle(c, locale)}，让 Atlas 在授权范围内获取上下文并完成任务。`;
}

export function connectorAbout(c: Connector, locale: Locale): string {
  if (locale !== "zh-CN") return c.about || "";
  return `${connectorBlurb(c, locale)} 凭据只保存在当前设备上，你可以随时调整权限或断开连接。`;
}

export function connectorAccess(c: Connector, locale: Locale): string[] {
  if (locale !== "zh-CN") return c.access || [];
  return (c.access || []).map((_, index) =>
    index === 0
      ? `读取完成任务所需的 ${connectorTitle(c, locale)} 数据`
      : index === 1
        ? "仅在你授权的范围内执行操作"
        : "涉及写入或发送的关键操作会先请求确认",
  );
}

export function connectorToolCopy(tool: ConnectorTool, locale: Locale) {
  if (locale !== "zh-CN") return { label: tool.label, description: tool.description };
  return {
    label: tool.label,
    description: `${tool.kind === "read" ? "读取与检索" : "执行操作"}所需的连接器能力；Atlas 会遵循当前任务权限。`,
  };
}
