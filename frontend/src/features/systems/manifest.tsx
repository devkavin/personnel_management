import { Settings } from "lucide-react";
import type { FeatureManifest } from "../../app/feature-types";

const manifest: FeatureManifest = {
  id: "systems",
  order: 50,
  routes: [{ path: "/systems", view: "systems" }],
  navigation: ({ role }) => role === "super_admin"
    ? [{ view: "systems", label: "Systems", icon: <Settings size={19} /> }]
    : []
};

export default manifest;
