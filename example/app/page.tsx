'use client';

import { useState } from 'react';
import { useHealthCheck } from '../../src/useHealthCheck';

export default function Home() {
  const [simulateFail, setSimulateFail] = useState(false);
  const [simulateDelay, setSimulateDelay] = useState(0);

  const url = `/api/health?fail=${simulateFail}&delay=${simulateDelay}`;

  const { isHealthy, isChecking, lastChecked, error, healthCheck } = useHealthCheck(url, {
    interval: 5000,
    timeout: 3000,
  });

  const statusColor = isHealthy === null ? '#888' : isHealthy ? '#0a7d2c' : '#c22';

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32, maxWidth: 480 }}>
      <h1>useHealthCheck demo</h1>
      <p style={{ color: '#666' }}>
        Polling <code>{url}</code> every 5s, 3s timeout.
      </p>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginTop: 16 }}>
        <p>
          Status:{' '}
          <strong style={{ color: statusColor }}>
            {isHealthy === null ? 'checking…' : isHealthy ? 'healthy' : 'unhealthy'}
          </strong>
        </p>
        <p>Checking now: {isChecking ? 'yes' : 'no'}</p>
        <p>Last checked: {lastChecked ? lastChecked.toLocaleTimeString() : '—'}</p>
        <p>Error: {error ?? '—'}</p>
      </div>

      <fieldset style={{ marginTop: 24, border: '1px solid #ddd', borderRadius: 8 }}>
        <legend>Simulate</legend>

        <label style={{ display: 'block', margin: '8px 0' }}>
          <input
            type="checkbox"
            checked={simulateFail}
            onChange={(e) => setSimulateFail(e.target.checked)}
          />{' '}
          Endpoint returns 503
        </label>

        <label style={{ display: 'block', margin: '8px 0' }}>
          Response delay (ms):{' '}
          <input
            type="number"
            min={0}
            step={500}
            value={simulateDelay}
            onChange={(e) => setSimulateDelay(Number(e.target.value))}
            style={{ width: 90 }}
          />
        </label>
        <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>
          Set this above 3000ms to trigger the hook's timeout/abort path.
        </p>
      </fieldset>

      <button onClick={() => healthCheck()} style={{ marginTop: 16 }}>
        Check now
      </button>
    </main>
  );
}
