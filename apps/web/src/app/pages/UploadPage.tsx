import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../features/auth/hooks/useApiClient';
import { useUser } from '../../features/auth/hooks/useUser';

interface MeResponse {
  id: string;
  clerkId: string;
  email: string;
}

/** Placeholder cua Phase 4. Goi /me de chung minh flow auth end-to-end. */
export function UploadPage() {
  const api = useApiClient();
  const { user } = useUser();

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<MeResponse>('/me'),
  });

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-semibold">Upload</h1>
        <p className="text-sm text-slate-500">Placeholder. Tinh nang upload se lam o Phase 4.</p>
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Backend GET /me
        </h2>
        {meQuery.isPending && <p className="text-sm">Loading...</p>}
        {meQuery.isError && (
          <p className="text-sm text-red-600">Failed to load: {meQuery.error.message}</p>
        )}
        {meQuery.data && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">id</dt>
            <dd className="font-mono">{meQuery.data.id}</dd>
            <dt className="text-slate-500">clerkId</dt>
            <dd className="font-mono">{meQuery.data.clerkId}</dd>
            <dt className="text-slate-500">email</dt>
            <dd>{meQuery.data.email}</dd>
          </dl>
        )}
      </section>

      {user && (
        <p className="text-xs text-slate-400">
          Signed in as {user.email ?? user.name ?? user.id}
        </p>
      )}
    </div>
  );
}
