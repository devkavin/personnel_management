import { LayoutDashboard } from "lucide-react";
import type { FeatureManifest } from "../../app/feature-types";

const manifest: FeatureManifest = {
  id: "dashboard",
  order: 10,
  routes: [{ path: "/dashboard", view: "dashboard" }],
  navigation: () => [{ view: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={19} /> }]
};

export default manifest;
