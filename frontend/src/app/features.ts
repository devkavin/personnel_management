import type { FeatureContext, FeatureManifest, NavigationItem, ViewKey } from "./feature-types";

const discovered = import.meta.glob<{ default: FeatureManifest }>("../features/*/manifest.tsx", { eager: true });

export const featureManifests = Object.values(discovered)
  .map((module) => module.default)
  .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));

const routes = featureManifests.flatMap((feature) => feature.routes);

export function pathForView(view: ViewKey) {
  return routes.find((route) => route.view === view)?.path ?? "/profile";
}

export function viewForPath(pathname: string) {
  return routes.find((route) => route.path === pathname)?.view ?? "dashboard";
}

export function navigationFor(context: FeatureContext): NavigationItem[] {
  return featureManifests.flatMap((feature) => feature.navigation(context));
}

export function allowedViews(context: FeatureContext) {
  const collect = (items: NavigationItem[]): ViewKey[] => items.flatMap((item) => [
    ...(item.view ? [item.view] : []),
    ...collect(item.children ?? [])
  ]);
  return new Set(collect(navigationFor(context)));
}
