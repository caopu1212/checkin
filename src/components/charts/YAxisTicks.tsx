export function YAxisTicks({ max, height }: { max: number; height: number }) {
  return (
    <div className="relative w-7 shrink-0" style={{ height }}>
      <span className="absolute right-1 -top-1.5 text-[9px] text-[var(--viz-text-muted)]">{max}</span>
      <span className="absolute -bottom-1.5 right-1 text-[9px] text-[var(--viz-text-muted)]">0</span>
    </div>
  )
}
