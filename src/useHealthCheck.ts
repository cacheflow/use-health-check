import { useCallback, useEffect, useRef, useState } from "react";

export interface UseHealthCheckOptions {
  /** How often to re-check, in ms. Set to 0 to disable polling (still runs once on mount / healthCheck). Default 30000. */
  interval?: number;
  /** Abort a check that takes longer than this, in ms. Default 5000. */
  timeout?: number;
  /** Pause checks entirely, e.g. while a feature using this hook is hidden. Default true. */
  enabled?: boolean;
  /** HTTP method used for the check. Default 'HEAD'. */
  method?: "GET" | "HEAD";
  /** Called whenever isHealthy transitions to a new value. */
  onStatusChange?: (isHealthy: boolean) => void;
}

export interface UseHealthCheckValues {
  /** null until the first check resolves. */
  isHealthy: boolean | null;
  isChecking: boolean;
  lastChecked: Date | null;
  error: string | null;
  /** Latest check time to response headers, in ms; null before a response or when a check fails without one. */
  responseTime: number | null;
  /** Run a check immediately, outside the polling interval. */
  healthCheck: () => Promise<void>;
}

const missingWindow = typeof window === "undefined";

const DEFAULT_INTERVAL = 30000;
const DEFAULT_TIMEOUT = 5000;

export const useHealthCheck = (
  url: string,
  options: UseHealthCheckOptions = {},
): UseHealthCheckValues => {
  const {
    interval = DEFAULT_INTERVAL,
    timeout = DEFAULT_TIMEOUT,
    enabled = true,
    method = "HEAD",
    onStatusChange,
  } = options;

  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isHealthyRef = useRef(isHealthy);
  isHealthyRef.current = isHealthy;

  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const reportHealthCheckStatus = (healthy: boolean) => {
    if (isHealthyRef.current !== healthy) {
      onStatusChangeRef.current?.(healthy);
    }
    setIsHealthy(healthy);
  };

  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const healthCheck = useCallback(async () => {
    if (missingWindow) {
      return;
    }

    controllerRef.current?.abort();
    const requestId = ++requestIdRef.current;

    if (!window.navigator.onLine) {
      setResponseTime(null);
      setIsChecking(false);
      setError("Browser is offline");
      setLastChecked(new Date());
      reportHealthCheckStatus(false);
      return;
    }

    setIsChecking(true);

    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = setTimeout(
      () =>
        controller.abort(
          new Error(`Health check timed out after ${timeout}ms`),
        ),
      timeout,
    );

    const startedAt = performance.now();

    try {
      const response = await fetch(url, {
        method,
        cache: "no-store",
        signal: controller.signal,
      });

      if (requestIdRef.current !== requestId) {
        return void 0;
      }
      const endTime = performance.now();
      const responseTimeDiff = endTime - startedAt;

      setResponseTime(responseTimeDiff);
      reportHealthCheckStatus(response.ok);
      setError(response.ok ? null : `Received status ${response.status}`);
    } catch (err) {
      if (requestIdRef.current !== requestId) {
        return void 0;
      }

      setResponseTime(null);
      reportHealthCheckStatus(false);
      setError(err instanceof Error ? err.message : "Health check failed");
    } finally {
      clearTimeout(timer);
      if (requestIdRef.current === requestId) {
        setLastChecked(new Date());
        setIsChecking(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, method, timeout]);

  useEffect(() => {
    if (missingWindow || !enabled) {
      return;
    }

    let active = true;

    const runHealthCheck = async () => {
      if (active) {
        await healthCheck();
      }
    };

    runHealthCheck();

    if (!interval) {
      return;
    }

    const id = setInterval(runHealthCheck, interval);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [healthCheck, enabled, interval]);

  return {
    isHealthy,
    isChecking,
    lastChecked,
    error,
    responseTime,
    healthCheck: healthCheck,
  };
};
