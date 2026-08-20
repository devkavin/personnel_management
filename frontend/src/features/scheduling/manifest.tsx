import { CalendarDays, Flag, ListTree, SquarePlus } from "lucide-react";
import type { FeatureManifest } from "../../app/feature-types";

const manifest: FeatureManifest = {
  id: "scheduling",
  order: 40,
  routes: [
    { path: "/schedule/calendar", view: "schedule-calendar" },
    { path: "/schedule/add", view: "schedule-add" },
    { path: "/schedule/regattas", view: "schedule-regattas" },
    { path: "/schedule/setup", view: "schedule-setup" },
    { path: "/my-schedule", view: "my-schedule" }
  ],
  navigation: ({ role, systems }) => {
    if (!systems.some((system) => system.code === "scheduling" && Boolean(system.enabled))) return [];
    const children = role === "tenant_member"
      ? [{ view: "my-schedule", label: "My schedule", icon: <CalendarDays size={19} /> }]
      : [
          { view: "schedule-calendar", label: "Calendar", icon: <CalendarDays size={19} /> },
          { view: "schedule-add", label: "Add schedule", icon: <SquarePlus size={19} /> },
          { view: "schedule-regattas", label: "Regattas", icon: <Flag size={19} /> },
          { view: "schedule-setup", label: "Schedule setup", icon: <ListTree size={19} /> }
        ];
    return [{ label: "Schedule", icon: <CalendarDays size={19} />, children }];
  }
};

export default manifest;
