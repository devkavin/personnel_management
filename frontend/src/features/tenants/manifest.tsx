import { Building2 } from "lucide-react";
import type { FeatureManifest } from "../../app/feature-types";

const manifest: FeatureManifest = {
  id: "tenants",
  order: 30,
  routes: [{ path: "/tenants", view: "tenants" }],
  navigation: ({ role }) => role === "super_admin"
    ? [{ view: "tenants", label: "Tenants", icon: <Building2 size={19} /> }]
    : []
};

export default manifest;
