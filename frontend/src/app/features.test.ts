import { describe, expect, it } from "vitest";
import { allowedViews, navigationFor, pathForView, viewForPath } from "./features";

describe("feature manifests", () => {
  it("maps stable views to URL routes", () => {
    expect(pathForView("attendance")).toBe("/attendance");
    expect(viewForPath("/schedule/setup")).toBe("schedule-setup");
    expect(viewForPath("/schedule/regattas")).toBe("schedule-regattas");
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

  it("places Regattas between schedule creation and setup for staff", () => {
    const scheduling = navigationFor({
      role: "tenant_staff",
      systems: [{ code: "scheduling", name: "Scheduling", description: null, enabled: true }]
    }).find((item) => item.label === "Schedule");

    expect(scheduling?.children?.map((item) => item.view)).toEqual([
      "schedule-calendar",
      "schedule-add",
      "schedule-regattas",
      "schedule-setup"
    ]);
  });
});
