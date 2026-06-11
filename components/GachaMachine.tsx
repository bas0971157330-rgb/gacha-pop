type GachaMachineProps = {
  color?: "pink" | "blue" | "purple" | "green";
  compact?: boolean;
};

const colorMap = {
  pink: {
    lid: "from-pink-300 to-fuchsia-400",
    body: "from-pink-300 to-rose-400",
    slot: "bg-pink-600",
  },
  blue: {
    lid: "from-sky-300 to-blue-500",
    body: "from-sky-300 to-blue-500",
    slot: "bg-blue-700",
  },
  purple: {
    lid: "from-violet-300 to-purple-600",
    body: "from-violet-300 to-purple-600",
    slot: "bg-purple-800",
  },
  green: {
    lid: "from-emerald-200 to-green-500",
    body: "from-emerald-200 to-green-500",
    slot: "bg-emerald-800",
  },
};

export function GachaMachine({ color = "green", compact = false }: GachaMachineProps) {
  const theme = colorMap[color];

  return (
    <div
      className={`gacha-machine relative mx-auto ${compact ? "h-52 w-48" : "h-[360px] w-[300px] sm:h-[430px] sm:w-[360px]"}`}
    >
      <div className="absolute left-1/2 top-3 h-[45%] w-[72%] -translate-x-1/2 overflow-hidden rounded-t-[40px] rounded-b-2xl border-4 border-white/80 bg-white/45 shadow-inner backdrop-blur-md">
        <div className={`absolute inset-x-0 top-0 h-6 bg-gradient-to-r ${theme.lid}`} />
        {Array.from({ length: 18 }).map((_, index) => (
          <span
            key={index}
            className={`gacha-ball ball-${index % 6}`}
            style={{
              left: `${10 + (index * 19) % 72}%`,
              top: `${26 + (index * 23) % 55}%`,
              animationDelay: `${index * 0.15}s`,
            }}
          />
        ))}
      </div>
      <div className={`absolute bottom-[14%] left-1/2 h-[38%] w-[78%] -translate-x-1/2 rounded-3xl bg-gradient-to-b ${theme.body} shadow-[inset_0_0_0_5px_rgba(255,255,255,0.45),0_18px_28px_rgba(87,59,151,0.22)]`} />
      <div className="absolute bottom-[17%] left-1/2 h-[33%] w-[40%] -translate-x-1/2 rounded-2xl border-4 border-slate-300 bg-gradient-to-b from-slate-100 to-slate-300 shadow-lg">
        <div className="mx-auto mt-4 h-3 w-16 rounded-full bg-slate-500" />
        <div className="mx-auto mt-5 grid h-16 w-16 place-items-center rounded-full border-4 border-slate-500 bg-gradient-to-br from-white to-slate-400">
          <div className="h-2 w-12 rounded-full bg-slate-700" />
        </div>
        <div className={`mx-auto mt-5 h-9 w-20 rounded-b-xl ${theme.slot} shadow-inner`} />
      </div>
      <div className="absolute bottom-[8%] left-1/2 h-10 w-[82%] -translate-x-1/2 rounded-b-3xl bg-slate-100 shadow-lg" />
      <div className="absolute bottom-0 left-1/2 h-9 w-[95%] -translate-x-1/2 rounded-[50%] bg-violet-500/25 blur-sm" />
    </div>
  );
}
