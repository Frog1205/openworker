import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Composer } from "./Composer";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Composer project workspace", () => {
  it("opens the workspace picker and lets the user cancel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ workspaces: [] }) }) as unknown as Response),
    );
    render(
      <Composer
        mode="interactive"
        model="gpt-5.6-sol"
        running={false}
        connected
        workspace="D:\\projects\\atlas"
        workspacePickerEnabled
        onWorkspaceChange={vi.fn()}
        onSend={vi.fn()}
        onInterrupt={vi.fn()}
        onModeChange={vi.fn()}
        onModelChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose project workspace" }));
    expect(await screen.findByRole("heading", { name: "Choose a project folder" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("heading", { name: "Choose a project folder" })).toBeNull();
  });
});
