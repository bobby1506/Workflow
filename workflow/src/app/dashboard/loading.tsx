export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 h-14">
        <div className="max-w-5xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gray-200" />
            <div className="w-20 h-4 rounded bg-gray-200" />
          </div>
          <div className="w-28 h-8 rounded-full bg-gray-200" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Page title */}
        <div className="mb-8">
          <div className="w-32 h-7 rounded bg-gray-200 mb-2" />
          <div className="w-56 h-4 rounded bg-gray-100" />
        </div>

        {/* System workflows section */}
        <div className="mb-10">
          <div className="w-36 h-4 rounded bg-gray-200 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1].map((i) => (
              <div
                key={i}
                className="bg-white border border-gray-100 rounded-xl overflow-hidden"
              >
                <div className="h-36 bg-gray-100" />
                <div className="px-4 py-3">
                  <div className="w-28 h-3 rounded bg-gray-200 mb-1.5" />
                  <div className="w-20 h-2.5 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Your workflows section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="w-28 h-4 rounded bg-gray-200" />
            <div className="w-40 h-7 rounded-lg bg-gray-100" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white border border-gray-100 rounded-xl overflow-hidden"
              >
                <div className="h-36 bg-gray-100" />
                <div className="px-4 py-3">
                  <div className="w-32 h-3 rounded bg-gray-200 mb-1.5" />
                  <div className="w-24 h-2.5 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
