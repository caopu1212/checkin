export function Legend({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-3">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-[11px] text-neutral-500">
          {it.dashed ? (
            <svg width="12" height="2" className="shrink-0">
              <line x1="0" y1="1" x2="12" y2="1" stroke={it.color} strokeWidth="2" strokeDasharray="3 2" />
            </svg>
          ) : (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  )
}
