import { act, renderHook, waitFor } from '@testing-library/react';
import { useHealthCheck } from './useHealthCheck';

if (!global.fetch) {
  global.fetch = (() => Promise.resolve({} as Response)) as any;
}

describe('useHealthCheck', () => {
  let mockFetch: jest.SpyInstance;

  const setOnLine = (onLine: boolean) => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: onLine,
    });
  };

  beforeEach(() => {
    jest.useFakeTimers({ legacyFakeTimers: false });
    setOnLine(true);
  });

  afterEach(() => {
    mockFetch?.mockRestore();
    jest.useRealTimers();
  });

  it('reports healthy when the endpoint responds ok', async () => {
    mockFetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 200 } as Response);

    const { result } = renderHook(() =>
      useHealthCheck('https://example.com/health')
    );

    await waitFor(() => expect(result.current.isHealthy).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.lastChecked).not.toBeNull();
  });

  it('reports unhealthy when the endpoint responds with a non-ok status', async () => {
    mockFetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: false, status: 503 } as Response);

    const { result } = renderHook(() =>
      useHealthCheck('https://example.com/health')
    );

    await waitFor(() => expect(result.current.isHealthy).toBe(false));
    expect(result.current.error).toContain('503');
  });

  it('reports unhealthy when the fetch throws', async () => {
    mockFetch = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() =>
      useHealthCheck('https://example.com/health')
    );

    await waitFor(() => expect(result.current.isHealthy).toBe(false));
    expect(result.current.error).toBe('network down');
  });

  it('skips the network call and reports unhealthy when the browser is offline', async () => {
    setOnLine(false);
    mockFetch = jest.spyOn(global, 'fetch');

    const { result } = renderHook(() =>
      useHealthCheck('https://example.com/health')
    );

    await waitFor(() => expect(result.current.isHealthy).toBe(false));
    expect(result.current.error).toBe('Browser is offline');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not check automatically when enabled is false', async () => {
    mockFetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 200 } as Response);

    const { result } = renderHook(() =>
      useHealthCheck('https://example.com/health', { enabled: false })
    );

    expect(result.current.isHealthy).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();

    await act(() => result.current.healthCheck());
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('calls onStatusChange only when health status transitions', async () => {
    mockFetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 200 } as Response);

    const onStatusChange = jest.fn();
    const { result } = renderHook(() =>
      useHealthCheck('https://example.com/health', { onStatusChange })
    );

    await waitFor(() => expect(result.current.isHealthy).toBe(true));
    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenCalledWith(true);

    await act(() => result.current.healthCheck());
    expect(onStatusChange).toHaveBeenCalledTimes(1);
  });

  it('polls again after the configured interval', async () => {
    mockFetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 200 } as Response);

    renderHook(() =>
      useHealthCheck('https://example.com/health', { interval: 10000 })
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});
