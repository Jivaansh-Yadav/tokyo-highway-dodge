import { useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

/** True only after the component has hydrated in the browser. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}
