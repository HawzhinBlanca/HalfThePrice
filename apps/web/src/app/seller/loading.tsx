export default function SellerLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Dashboard header skeleton */}
      <div className="mb-8">
        <div className="shimmer h-8 w-48 rounded-lg" />
        <div className="shimmer mt-2 h-4 w-80 rounded" />
      </div>

      {/* Stats row skeleton */}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-6">
            <div className="shimmer h-3 w-20 rounded" />
            <div className="shimmer mt-2 h-8 w-12 rounded" />
          </div>
        ))}
      </div>

      {/* Cap estimator skeleton */}
      <div className="glass mb-8 rounded-2xl p-6">
        <div className="shimmer h-5 w-40 rounded" />
        <div className="shimmer mt-4 h-10 w-full rounded-xl" />
      </div>

      {/* Listings skeleton */}
      <div className="space-y-4">
        <div className="shimmer h-5 w-32 rounded" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass flex items-center gap-4 rounded-2xl p-4">
            <div className="shimmer h-16 w-16 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="shimmer h-4 w-3/4 rounded" />
              <div className="shimmer h-3 w-1/2 rounded" />
            </div>
            <div className="shimmer h-8 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
