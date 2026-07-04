import type { ReactNode } from "react";
import type { Role, TenantFeature } from "../shared/api/client";

export type ViewKey = string;

export interface FeatureContext {
  role: Role;
  systems: TenantFeature[];
}

export interface FeatureRoute {
  path: string;
  view: ViewKey;
}

export interface NavigationItem {
  view?: ViewKey;
  label: string;
  icon: ReactNode;
  children?: NavigationItem[];
}

export interface FeatureManifest {
  id: string;
  order: number;
  routes: FeatureRoute[];
  navigation: (context: FeatureContext) => NavigationItem[];
}
