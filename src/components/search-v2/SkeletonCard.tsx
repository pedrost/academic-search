export function SkeletonCard() {
  return (
    <div className="bg-[#1a1b26] border border-white/8 rounded-xl p-4 space-y-3 animate-pulse">
      <div className="flex justify-between">
        <div className="h-5 w-3/5 bg-white/5 rounded" />
        <div className="h-4 w-12 bg-white/5 rounded font-mono" />
      </div>
      <div className="h-4 w-2/3 bg-white/5 rounded" />
      <div className="h-4 w-1/3 bg-white/5 rounded" />
      <div className="flex gap-2 pt-1">
        <div className="h-6 w-16 bg-violet-500/10 rounded-full" />
        <div className="h-6 w-24 bg-white/5 rounded-full" />
      </div>
      <div className="h-10 w-full bg-white/5 rounded" />
    </div>
  )
}
