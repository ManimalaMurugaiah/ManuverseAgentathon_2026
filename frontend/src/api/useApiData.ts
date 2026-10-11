import { useCallback, useEffect, useMemo, useState } from "react";

import api from "./client";
import { getApiErrorMessage } from "./errors";

type Params = Record<string, string | number | boolean | null | undefined>;

export function cleanParams(params: Params | undefined): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "");
  return Object.fromEntries(entries) as Record<string, string | number | boolean>;
}

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string;
}

/** GET `path` whenever it or `params` change; pass `null` to skip the request. */
export function useApiData<T>(path: string | null, params?: Params): ApiState<T> & { reload: () => void } {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: path !== null, error: "" });
  const [tick, setTick] = useState(0);
  const key = useMemo(() => JSON.stringify([path, cleanParams(params) ?? null]), [path, params]);

  useEffect(() => {
    if (path === null) {
      setState({ data: null, loading: false, error: "" });
      return undefined;
    }
    let active = true;
    setState((current) => ({ ...current, loading: true }));
    api
      .get<T>(path, { params: cleanParams(params) })
      .then(({ data }) => {
        if (active) setState({ data, loading: false, error: "" });
      })
      .catch((error: unknown) => {
        if (active) setState((current) => ({ data: current.data, loading: false, error: getApiErrorMessage(error, "Could not load this data.") }));
      });
    return () => {
      active = false;
    };
    // `key` captures path and params by value, so params objects can be created inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { ...state, reload };
}
