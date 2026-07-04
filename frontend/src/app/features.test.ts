import { describe, expect, it } from "vitest";
import { allowedViews, pathForView, viewForPath } from "./features";

describe("feature manifests", () => {
  it("maps stable views to URL routes", () => {
    expect(pathForView("attendance")).toBe("/attendance");
    expect(viewForPath("/schedule/setup")).toBe("schedule-setup");
  });

  it("limits member navigation to member-facing features", () => {
    const views = allowedViews({
      role: "tenant_member",
      systems: [{ code: "scheduling", name: "Scheduling", description: null, enabled: true }]
    });
    expect(views.has("my-schedule")).toBe(true);
    expect(views.has("people")).toBe(false);
    expect(views.has("attendance")).toBe(false);
  });
});
