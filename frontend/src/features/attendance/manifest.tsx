import { CalendarCheck } from "lucide-react";
import type { FeatureManifest } from "../../app/feature-types";

const manifest: FeatureManifest = {
  id: "attendance",
  order: 20,
  routes: [{ path: "/attendance", view: "attendance" }],
  navigation: ({ role, systems }) => {
    const enabled = systems.some((system) => system.code.startsWith("attendance") && Boolean(system.enabled));
    return enabled && (role === "tenant_admin" || role === "tenant_staff")
      ? [{ view: "attendance", label: "Attendance", icon: <CalendarCheck size={19} /> }]
      : [];
  }
};

export default manifest;
