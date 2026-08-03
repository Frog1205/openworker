import { describe, expect, it } from "vitest";
import type { Connector } from "../api";
import { connectorBlurb, connectorTitle } from "./locale";

const connector = (name: string, title: string, blurb = "Server copy") =>
  ({ name, title, blurb }) as Connector;

describe("connector Chinese product copy", () => {
  it("keeps brand names while localizing product capabilities", () => {
    const github = connector("github", "GitHub");
    expect(connectorTitle(github, "zh-CN")).toBe("GitHub");
    expect(connectorBlurb(github, "zh-CN")).toContain("Pull Request");
    expect(connectorBlurb(github, "zh-CN")).not.toBe("Server copy");
  });

  it("localizes functional connector names and has a Chinese fallback", () => {
    expect(connectorTitle(connector("browser", "Browser"), "zh-CN")).toBe("浏览器");
    expect(connectorBlurb(connector("new_service", "New Service"), "zh-CN")).toContain("让 Atlas");
  });

  it("preserves the backend copy in English", () => {
    const github = connector("github", "GitHub");
    expect(connectorBlurb(github, "en-US")).toBe("Server copy");
  });
});
