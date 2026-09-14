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

  it.each([200, 503])('records elapsed response time for HTTP %s', async (status) => {
    mockFetch = jest.spyOn(global, 'fetch').mockImplementation(() =>
      new Promise((resolve) => setTimeout(() => resolve({ ok: status === 200, status } as Response), 125))
    );
    const { result } = renderHook(() => useHealthCheck('/health', { interval: 0 }));
    expect(result.current.responseTime).toBeNull();
    await act(async () => { jest.advanceTimersByTime(125); });
    expect(result.current.responseTime).toBe(125);
  });

  it.each(['offline', 'network', 'timeout'])('clears previous timing after %s failure', async (failure) => {
    mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 } as Response);
    const { result } = renderHook(() => useHealthCheck('/health', { enabled: false, timeout: 500 }));
    await act(() => result.current.healthCheck());
    expect(result.current.responseTime).not.toBeNull();

    if (failure === 'offline') setOnLine(false);
    if (failure === 'network') mockFetch.mockRejectedValue(new Error('network down'));
    if (failure === 'timeout') {
      mockFetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('timed out')));
      }));
    }
    await act(async () => {
      const check = result.current.healthCheck();
      jest.advanceTimersByTime(500);
      await check;
    });
    expect(result.current.responseTime).toBeNull();
    expect(result.current.isChecking).toBe(false);
  });

  it('ignores timing from a superseded request', async () => {
    let resolveFirst!: (response: Response) => void;
    mockFetch = jest.spyOn(global, 'fetch')
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({ ok: true } as Response), 25)));
    const { result } = renderHook(() => useHealthCheck('/health', { enabled: false }));
    let first!: Promise<void>;
    act(() => { first = result.current.healthCheck(); });
    await act(async () => {
      const second = result.current.healthCheck();
      jest.advanceTimersByTime(25);
      await second;
    });
    expect(result.current.responseTime).toBe(25);
    await act(async () => {
      jest.advanceTimersByTime(100);
      resolveFirst({ ok: true } as Response);
      await first;
    });
    expect(result.current.responseTime).toBe(25);
  });

});
