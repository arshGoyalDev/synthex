import React, { useMemo } from "react";

export function ActivityGraph() {
  // Generate random data for the last 14 weeks (approx 3 months)
  const renderSquare = (level: number, key: string) => {
    let bg = "bg-surface-elevated"; // level 0
    if (level === 1) bg = "bg-accent-light/60";
    if (level === 2) bg = "bg-accent-primary/60";
    if (level === 3) bg = "bg-accent-primary";
    if (level === 4) bg = "bg-accent-dark";

    return (
      <div
        key={key}
        className={`w-[11px] h-[11px] rounded-[2px] ${bg} border border-[rgba(255,255,255,0.02)]`}
        title={`Activity level: ${level}`}
      />
    );
  };

  const weeksData = useMemo(() => {
    const weeks = [];
    for (let w = 0; w < 16; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        // Random activity level favoring 0 and 1
        // eslint-disable-next-line
        const r = Math.random();
        let level = 0;
        if (r > 0.6) level = 1;
        if (r > 0.8) level = 2;
        if (r > 0.9) level = 3;
        if (r > 0.97) level = 4;
        days.push(renderSquare(level, `${w}-${d}`));
      }
      weeks.push(
        <div key={w} className="flex flex-col gap-[3px]">
          {days}
        </div>
      );
    }
    return weeks;
  }, []);

  return (
    <div className="mb-10 p-5 rounded-xl border border-border-default bg-bg-secondary flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary m-0">
          Recent Activity
        </h2>
        <span className="text-xs text-text-tertiary font-medium">104 contributions</span>
      </div>
      
      <div className="flex gap-[3px] overflow-hidden">
        {weeksData}
      </div>

      <div className="flex items-center justify-end gap-2 text-[10px] text-text-tertiary mt-1">
        <span>Less</span>
        <div className="flex gap-[3px]">
          {renderSquare(0, "l0")}
          {renderSquare(1, "l1")}
          {renderSquare(2, "l2")}
          {renderSquare(3, "l3")}
          {renderSquare(4, "l4")}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
