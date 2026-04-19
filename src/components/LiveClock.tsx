import { useEffect, useState } from "react";

export function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const utc = now.toISOString().replace("T", " ").slice(0, 19) + "Z";
  const local = now.toLocaleString("en-GB", { hour12: false });

  return (
    <div className="flex flex-col items-end gap-0.5 font-mono text-xs leading-tight">
      <div className="text-cyan glow-cyan tracking-widest">{utc}</div>
      <div className="text-muted-foreground tracking-wider">LOCAL {local}</div>
    </div>
  );
}
