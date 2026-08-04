import { useEffect, useRef } from "react";
import { registerTabRefreshHandler } from "../utils/tabRefreshRegistry";

/** Register a reload callback for when the user taps the same footer tab again. */
export function useTabRefresh(screenName, onRefresh) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    return registerTabRefreshHandler(screenName, () => onRefreshRef.current?.());
  }, [screenName]);
}
