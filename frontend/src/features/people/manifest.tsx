import { UsersRound } from "lucide-react";
import type { FeatureManifest } from "../../app/feature-types";

const manifest: FeatureManifest = {
  id: "people",
  order: 30,
  routes: [{ path: "/people", view: "people" }],
  navigation: ({ role }) => role === "tenant_admin" || role === "tenant_staff" ? [{
    view: "people",
    label: "People",
    icon: <UsersRound size={19} />
  }] : []
};

export default manifest;
