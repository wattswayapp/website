"use client";

interface BatteryGaugeProps {
  percentage: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export default function BatteryGauge({
  percentage,
  size = "md",
  showLabel = true,
}: BatteryGaugeProps) {
  const pct = Math.max(0, Math.min(100, percentage));

  const color =
    pct > 60 ? "#22c55e" : pct > 30 ? "#eab308" : pct > 15 ? "#f97316" : "#ef4444";

  const dims = {
    sm: { w: 28, h: 14, r: 2, tip: 2 },
    md: { w: 40, h: 20, r: 3, tip: 3 },
    lg: { w: 56, h: 28, r: 4, tip: 4 },
  }[size];

  return (
    <div className="flex items-center gap-1.5">
      <svg
        width={dims.w + dims.tip + 2}
        height={dims.h + 2}
        viewBox={`0 0 ${dims.w + dims.tip + 2} ${dims.h + 2}`}
      >
        {/* Battery body */}
        <rect
          x={0.5}
          y={0.5}
          width={dims.w}
          height={dims.h}
          rx={dims.r}
          fill="none"
          stroke="#555"
          strokeWidth={1}
        />
        {/* Battery tip */}
        <rect
          x={dims.w + 1}
          y={dims.h * 0.25}
          width={dims.tip}
          height={dims.h * 0.5}
          rx={1}
          fill="#555"
        />
        {/* Fill */}
        <rect
          x={1.5}
          y={1.5}
          width={Math.max(0, ((dims.w - 2) * pct) / 100)}
          height={dims.h - 2}
          rx={dims.r - 1}
          fill={color}
          className="transition-all duration-500"
        />
      </svg>
      {showLabel && (
        <span
          className="font-semibold tabular-nums"
          style={{
            color,
            fontSize: size === "sm" ? "11px" : size === "md" ? "13px" : "16px",
          }}
        >
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}
