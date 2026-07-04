import { UserRound } from "lucide-react";
import type { FeatureManifest } from "../../app/feature-types";

const manifest: FeatureManifest = {
  id: "profile",
  order: 100,
  routes: [{ path: "/profile", view: "profile" }],
  navigation: () => [{ view: "profile", label: "Profile", icon: <UserRound size={19} /> }]
};

export default manifest;
