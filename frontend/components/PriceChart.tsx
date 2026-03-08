'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TradeEvent } from '@/lib/contracts';

interface Props {
  events: TradeEvent[];
  k:      bigint;
  p0:     bigint;
}

interface ChartPoint {
  index:  number;
  price:  number;
  supply: number;
  type:   string;
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ChartPoint;
  return (
    <div style={{
      background:         'hsl(135 28% 8% / 0.94)',
      backdropFilter:     'blur(16px)',
      border:             '1px solid hsl(135 40% 40% / 0.35)',
      borderRadius:       'var(--r-md)',
      padding:            '10px 12px',
      fontFamily:         'var(--font-mono)',
      fontSize:           11,
      boxShadow:          '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: 'var(--green)', fontWeight: 700, marginBottom: 4 }}>
        {d.price.toFixed(6)} Ξ/share
      </div>
      <div style={{ color: 'var(--text-dim)', marginBottom: d.type !== 'init' ? 4 : 0 }}>
        {d.supply} shares minted
      </div>
      {d.type !== 'init' && (
        <div style={{ color: d.type === 'BUY' ? 'var(--green)' : 'var(--terra)', fontWeight: 700 }}>
          {d.type}
        </div>
      )}
    </div>
  );
}

// ─── PriceChart ───────────────────────────────────────────────────────────────

export default function PriceChart({ events, k, p0 }: Props) {
  const chartData: ChartPoint[] = events.map((event, i) => ({
    index:  i + 1,
    price:  Number(event.newPrice) / 1e18,
    supply: Number(event.newSupply),
    type:   event.type,
  }));

  if (chartData.length === 0 || chartData[0].supply > 0) {
    chartData.unshift({ index: 0, price: Number(p0) / 1e18, supply: 0, type: 'init' });
  }

  if (chartData.length < 2) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 180,
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--text-muted)',
      }}>
        no trades yet — be the first buyer!
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="solarpunkGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="hsl(135 56% 54%)" stopOpacity={0.28} />
            <stop offset="95%" stopColor="hsl(135 56% 54%)" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(135 30% 16%)"
          vertical={false}
        />

        <XAxis
          dataKey="supply"
          tick={{ fill: 'hsl(135 22% 30%)', fontSize: 9, fontFamily: 'var(--font-mono)' }}
          tickLine={false}
          axisLine={false}
          label={{ value: 'shares', position: 'insideBottomRight', offset: -4, fill: 'hsl(135 22% 30%)', fontSize: 9 }}
        />
        <YAxis
          tick={{ fill: 'hsl(135 22% 30%)', fontSize: 9, fontFamily: 'var(--font-mono)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => v.toFixed(4)}
          width={54}
        />

        <Tooltip content={<CustomTooltip />} />

        <Area
          type="monotone"
          dataKey="price"
          stroke="hsl(135 56% 54%)"
          strokeWidth={2}
          fill="url(#solarpunkGradient)"
          dot={(props: any) => {
            const { cx, cy, payload } = props;
            if (payload.type === 'init') return <circle key={`dot-${cx}-${cy}`} r={0} />;
            const fill = payload.type === 'BUY' ? 'hsl(135 56% 54%)' : 'hsl(20 58% 52%)';
            return (
              <circle
                key={`dot-${cx}-${cy}`}
                cx={cx} cy={cy} r={3.5}
                fill={fill}
                stroke="hsl(135 28% 8%)"
                strokeWidth={1.5}
              />
            );
          }}
          activeDot={{ r: 5, fill: 'hsl(135 56% 54%)', stroke: 'hsl(135 28% 8%)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
