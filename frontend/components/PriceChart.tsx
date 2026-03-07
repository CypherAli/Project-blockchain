"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TradeEvent } from "@/lib/contracts";

interface Props {
  events: TradeEvent[];
  k: bigint;
  p0: bigint;
}

interface ChartPoint {
  index: number;
  price: number;
  supply: number;
  type: string;
}

export default function PriceChart({ events, k, p0 }: Props) {
  // Build price history from trade events
  const chartData: ChartPoint[] = events.map((event, i) => ({
    index: i + 1,
    price: Number(event.newPrice) / 1e18,
    supply: Number(event.newSupply),
    type: event.type,
  }));

  // Add starting point
  if (chartData.length === 0 || chartData[0].supply > 0) {
    chartData.unshift({ index: 0, price: Number(p0) / 1e18, supply: 0, type: "init" });
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const d = payload[0].payload as ChartPoint;
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs">
          <p className="text-violet-400 font-semibold">
            {d.price.toFixed(6)} ETH/share
          </p>
          <p className="text-gray-400">{d.supply} shares minted</p>
          {d.type !== "init" && (
            <p className={d.type === "buy" ? "text-green-400" : "text-red-400"}>
              {d.type === "buy" ? "BUY" : "SELL"}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (chartData.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        No trades yet — be the first buyer!
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis
          dataKey="supply"
          tick={{ fill: "#6b7280", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          label={{ value: "Shares", position: "insideBottom", fill: "#6b7280", fontSize: 10 }}
        />
        <YAxis
          tick={{ fill: "#6b7280", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v.toFixed(4)}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="price"
          stroke="#8b5cf6"
          strokeWidth={2}
          fill="url(#priceGradient)"
          dot={(props) => {
            const { cx, cy, payload } = props;
            if (payload.type === "init") return <circle key={`dot-${cx}-${cy}`} />;
            return (
              <circle
                key={`dot-${cx}-${cy}`}
                cx={cx}
                cy={cy}
                r={3}
                fill={payload.type === "buy" ? "#10b981" : "#ef4444"}
                stroke="none"
              />
            );
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
