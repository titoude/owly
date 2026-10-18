import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Routes, Route } from "react-router-dom";
import "../i18n";
import { AppProvider } from "../appContext";
import Observe from "../pages/Observe";
import { seedDemo } from "../demo";
import { db } from "../db";
import * as drafts from "../drafts";

// Autosave writes through saveDraft — hold every write open so the test can
// resolve/reject them out of order and watch the real indicator.
vi.mock("../drafts", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../drafts")>();
  return { ...mod, saveDraft: vi.fn(mod.saveDraft) };
});

const pending: { resolve: () => void; reject: (e?: unknown) => void }[] = [];

beforeEach(async () => {
  pending.length = 0;
  await db.children.clear();
  await db.observations.clear();
  await db.settings.clear();
  await drafts.clearAllDrafts();
  vi.mocked(drafts.saveDraft).mockImplementation(
    () => new Promise<void>((res, rej) => pending.push({ resolve: res, reject: rej })),
  );
});

async function mountWizard() {
  await seedDemo();
  render(
    <AppProvider>
      <MemoryRouter initialEntries={["/observe"]}>
        <Routes>
          <Route path="/observe/:id?" element={<Observe />} />
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );
  // Step 0 content + the loadDraft/offerSeen chain settled.
  await screen.findByRole("button", { name: "15 min ago" });
  await act(async () => {});
}

describe("wizard draft indicator", () => {
  it("a pending newer write clears 'Draft saved'; stale and rejected writes behave truthfully", async () => {
    await mountWizard();
    const chip = (n: string) => screen.getByRole("button", { name: n });

    fireEvent.click(chip("15 min ago"));
    expect(pending).toHaveLength(1);
    expect(screen.queryByText("Draft saved")).toBeNull();

    fireEvent.click(chip("30 min ago"));
    expect(pending).toHaveLength(2);
    expect(screen.queryByText("Draft saved")).toBeNull();

    // Older write resolves late — must not mark current fields saved.
    await act(async () => pending[0].resolve());
    expect(screen.queryByText("Draft saved")).toBeNull();

    // Latest write resolves — the indicator is now truthful.
    await act(async () => pending[1].resolve());
    expect(await screen.findByText("Draft saved")).toBeInTheDocument();

    // A newer write in flight immediately clears the saved status.
    fireEvent.click(chip("60 min ago"));
    expect(pending).toHaveLength(3);
    expect(screen.queryByText("Draft saved")).toBeNull();

    // Its rejection reports failure instead of leaving a false "saved".
    await act(async () => pending[2].reject(new Error("denied")));
    expect(await screen.findByRole("alert")).toHaveTextContent(/draft/i);
    expect(screen.queryByText("Draft saved")).toBeNull();

    // A subsequent write that resolves recovers both states.
    fireEvent.click(chip("120 min ago"));
    expect(pending).toHaveLength(4);
    await act(async () => pending[3].resolve());
    expect(await screen.findByText("Draft saved")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
