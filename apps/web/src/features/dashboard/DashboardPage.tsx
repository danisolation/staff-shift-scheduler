import { useHealth } from './use-health';

export function DashboardPage() {
  const { data, isPending, isError, refetch } = useHealth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          The scheduler will live here. For now, this page proves the full loop works:
          browser → api → database-ready NestJS service.
        </p>
      </div>

      <div className="rounded-lg border p-6">
        <h2 className="mb-4 font-semibold">API health</h2>
        {isPending && <p>Checking the api...</p>}
        {isError && (
          <div className="space-y-2">
            <p className="text-red-600">Could not reach the api.</p>
            <p className="text-muted-foreground text-sm">
              Is <code>pnpm dev</code> running the api on port 3000?
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-md border px-3 py-1 text-sm"
            >
              Retry
            </button>
          </div>
        )}
        {data && (
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="font-medium">Status:</dt>
              <dd>{data.status}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Uptime:</dt>
              <dd>{Math.round(data.uptimeSeconds)}s</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Checked at:</dt>
              <dd>{new Date(data.timestamp).toLocaleString()}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
