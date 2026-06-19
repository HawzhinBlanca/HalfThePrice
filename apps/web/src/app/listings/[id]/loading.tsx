export default function ListingDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Breadcrumb skeleton */}
      <div className="shimmer mb-6 h-4 w-40 rounded" />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Image skeleton */}
        <div className="shimmer aspect-[4/3] rounded-2xl" />

        {/* Details skeleton */}
        <div className="space-y-6">
          <div>
            <div className="shimmer h-8 w-3/4 rounded-lg" />
            <div className="shimmer mt-3 h-5 w-1/3 rounded" />
          </div>

          {/* Verification panel skeleton */}
          <div className="glass space-y-4 rounded-2xl p-6">
            <div className="shimmer h-5 w-48 rounded" />
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
                  <div className="shimmer h-3 w-24 rounded" />
                  <div className="shimmer mt-2 h-6 w-20 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Offer form skeleton */}
          <div className="glass space-y-4 rounded-2xl p-6">
            <div className="shimmer h-5 w-32 rounded" />
            <div className="shimmer h-10 w-full rounded-xl" />
            <div className="shimmer h-20 w-full rounded-xl" />
            <div className="shimmer h-10 w-32 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
