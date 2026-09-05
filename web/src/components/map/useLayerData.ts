import { useEffect, useRef, useState } from "react";

interface LayerState<T> {
  data: T[] | null;
  loading: boolean;
  error: string | null;
}

/** Fetches once, the first time `enabled` becomes true, and keeps the
 * result cached for the life of the component - these are all reference/
 * near-static datasets (largest is 1,959 rows), not worth refetching. */
export function useLayerData<T>(enabled: boolean, fetcher: () => Promise<T[]>): LayerState<T> {
  const [state, setState] = useState<LayerState<T>>({ data: null, loading: false, error: null });
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled || fetchedRef.current) return;
    fetchedRef.current = true;
    setState({ data: null, loading: true, error: null });
    fetcher()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) =>
        setState({ data: null, loading: false, error: err instanceof Error ? err.message : "Failed to load" })
      );
    // fetcher is expected stable per layer (defined inline per call site is
    // fine since fetchedRef prevents refetch regardless of identity churn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return state;
}
