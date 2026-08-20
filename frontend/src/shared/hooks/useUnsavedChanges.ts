import { useEffect } from "react";

let dirtySourceCount = 0;

export function hasUnsavedChanges() {
  return dirtySourceCount > 0;
}

export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    dirtySourceCount += 1;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => {
      dirtySourceCount = Math.max(0, dirtySourceCount - 1);
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, [isDirty]);
}
