# use-health-check

A React hook that polls an endpoint to check whether it's healthy/reachable.

## Installation

```
npm install use-health-check
```

## Usage

```tsx
import { useHealthCheck } from 'use-health-check';

const ApiStatus = () => {
  const { isHealthy, isChecking, lastChecked, error, healthCheck } = useHealthCheck(
    'https://api.example.com/health',
    { interval: 30000, timeout: 5000 }
  );

  if (isHealthy === null) return <p>Checking…</p>;

  return (
    <div>
      <p>API is {isHealthy ? 'up' : 'down'}</p>
      {error && <p>{error}</p>}
      {lastChecked && <p>Last checked: {lastChecked.toLocaleTimeString()}</p>}
      <button onClick={healthCheck} disabled={isChecking}>
        Check now
      </button>
    </div>
  );
};
```

## API

### `useHealthCheck(url, options?)`

**Options**

| Option           | Type                             | Default    | Description                                                        |
| ----------------- | --------------------------------- | ---------- | -------------------------------------------------------------------- |
| `interval`         | `number`                          | `30000`    | Time between checks, in ms. `0` disables polling (still checks once). |
| `timeout`          | `number`                          | `5000`     | Abort a check that takes longer than this, in ms.                   |
| `enabled`          | `boolean`                         | `true`     | Set `false` to pause checks entirely.                                |
| `method`           | `'GET' \| 'HEAD'`                 | `'HEAD'`   | HTTP method used for the check.                                     |
| `onStatusChange`   | `(isHealthy: boolean) => void`    | —          | Called whenever health status transitions.                          |

**Return value**

| Field         | Type                     | Description                                    |
| -------------- | ------------------------- | ------------------------------------------------ |
| `isHealthy`    | `boolean \| null`         | `null` until the first check resolves.          |
| `isChecking`   | `boolean`                 | `true` while a check is in flight.               |
| `lastChecked`  | `Date \| null`            | Timestamp of the most recent check.             |
| `error`        | `string \| null`          | Error message from the most recent failed check. |
| `healthCheck`     | `() => Promise<void>`     | Run a check immediately, outside the interval.  |

## Behavior notes

- A check counts as unhealthy on any non-2xx response, a network error, or a timeout.
- If `navigator.onLine` is `false`, the hook reports unhealthy without making a network request.
- In non-browser environments (SSR), the hook is a no-op and `isHealthy` stays `null`.

## License

MIT
