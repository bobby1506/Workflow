export default function WorkflowLoading() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 animate-pulse">
      {/* Top bar skeleton */}
      <div className="bg-white border-b border-gray-100 h-12 flex items-center px-4 gap-3 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gray-100" />
        <div className="w-px h-4 bg-gray-100" />
        <div className="w-40 h-4 rounded bg-gray-100" />
        <div className="ml-auto flex items-center gap-2">
          <div className="w-20 h-7 rounded-lg bg-gray-100" />
          <div className="w-16 h-7 rounded-lg bg-gray-100" />
        </div>
      </div>

      {/* Canvas skeleton */}
      <div className="flex-1 relative" style={{ background: "#f0f0f0" }}>
        {/* Node skeletons */}
        <div className="absolute top-32 left-16 w-52 h-36 bg-white rounded-xl shadow-sm border border-gray-200" />
        <div className="absolute top-24 left-96 w-64 h-48 bg-white rounded-xl shadow-sm border border-gray-200" />
        <div className="absolute top-28 right-24 w-52 h-32 bg-white rounded-xl shadow-sm border border-gray-200" />

        {/* Bottom toolbar skeleton */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white border border-gray-200 rounded-full shadow-lg px-2 py-1.5">
          <div className="w-8 h-8 rounded-full bg-gray-100" />
          <div className="w-px h-5 bg-gray-100" />
          <div className="w-8 h-8 rounded-full bg-gray-100" />
          <div className="w-px h-5 bg-gray-100" />
          <div className="w-8 h-8 rounded-full bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
