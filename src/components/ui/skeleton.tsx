import { cn } from '../../lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

// Plan text skeleton component for consistent plan loading states
function PlanTextSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center", className)}>
      <div className="h-4 w-16 bg-[#21262D] rounded animate-pulse"></div>
      <span className="mx-1.5 text-[#8B949E]">•</span>
      <div className="h-4 w-12 bg-[#21262D] rounded animate-pulse"></div>
    </div>
  );
}

export { Skeleton, PlanTextSkeleton }
