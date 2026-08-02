import { describe, expect, it } from "vitest";
import { extraEnglishTranslationKeys, missingTranslationKeys, translate } from "./i18n";

describe("Atlas locales", () => {
  it("keeps the English catalog complete", () => {
    expect(missingTranslationKeys()).toEqual([]);
    expect(extraEnglishTranslationKeys()).toEqual([]);
  });

  it("formats product values and falls back to Chinese", () => {
    expect(translate("zh-CN", "boot.starting", { product: "Atlas Creator" })).toContain(
      "Atlas Creator",
    );
    expect(translate("unknown", "app.alpha")).toBe("内测版");
  });
});
