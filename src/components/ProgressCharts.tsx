import React, { useMemo, useState } from 'react';
import type { FitnessAssessment, StudentProfile } from '../types/fitness';
import { getThreshold } from '../utils/qd53Standards';

interface Props {
  student: StudentProfile;
  assessments: FitnessAssessment[];
}

interface ChartPoint {
  label: string;
  date: string;
  value: number;
}

interface MetricChartCardProps {
  title: string;
  unit: string;
  points: ChartPoint[];
  totLine?: number;
  datLine?: number;
  invertGood?: boolean;
  accentColor: string;
}

function MetricLineChart({
  title,
  unit,
  points,
  totLine,
  datLine,
  invertGood = false,
  accentColor,
}: MetricChartCardProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const width = 420;
  const height = 180;
  const padL = 44;
  const padR = 18;
  const padT = 18;
  const padB = 34;

  const { minY, maxY, coords, pathD, areaD } = useMemo(() => {
    const vals = points.map((p) => p.value);
    if (totLine !== undefined) vals.push(totLine);
    if (datLine !== undefined) vals.push(datLine);

    const rawMin = Math.min(...vals);
    const rawMax = Math.max(...vals);
    const span = Math.max(4, rawMax - rawMin);
    const y0 = Math.max(0, Math.floor(rawMin - span * 0.18));
    const y1 = Math.ceil(rawMax + span * 0.18);

    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const mapped = points.map((p, idx) => {
      const x =
        points.length === 1
          ? padL + plotW / 2
          : padL + (idx / (points.length - 1)) * plotW;
      const ratio = y1 === y0 ? 0.5 : (p.value - y0) / (y1 - y0);
      const y = padT + plotH - ratio * plotH;
      return { ...p, x, y };
    });

    const line = mapped.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
    const area =
      mapped.length > 0
        ? `${line} L ${mapped[mapped.length - 1].x} ${padT + plotH} L ${mapped[0].x} ${padT + plotH} Z`
        : '';

    return { minY: y0, maxY: y1, coords: mapped, pathD: line, areaD: area };
  }, [points, totLine, datLine]);

  const toY = (v: number) => {
    const plotH = height - padT - padB;
    const ratio = maxY === minY ? 0.5 : (v - minY) / (maxY - minY);
    return padT + plotH - ratio * plotH;
  };

  const latest = points[points.length - 1];
  const prev = points.length >= 2 ? points[points.length - 2] : null;
  const delta = latest && prev ? Math.round((latest.value - prev.value) * 10) / 10 : null;
  const activePoint = activeIndex !== null ? coords[activeIndex] : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <p className="text-xs text-slate-500">
            {latest ? (
              <>
                Gần nhất:{' '}
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {latest.value} {unit}
                </span>
                {delta !== null && (
                  <span
                    className={`ml-2 font-mono tabular-nums ${
                      (invertGood ? delta <= 0 : delta >= 0) ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    ({delta > 0 ? `+${delta}` : delta} {unit})
                  </span>
                )}
              </>
            ) : (
              'Chưa có dữ liệu'
            )}
          </p>
        </div>
        {totLine !== undefined && datLine !== undefined && (
          <div className="text-[11px] text-slate-500 font-mono tabular-nums whitespace-nowrap shrink-0">
            Tốt {invertGood ? '≤' : '≥'} {totLine} · Đạt {invertGood ? '≤' : '≥'} {datLine}
          </div>
        )}
      </div>

      {points.length === 0 ? (
        <div className="h-[150px] flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
          Chưa có lần đo nào được ghi nhận
        </div>
      ) : (
        <div className="relative w-full">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible select-none"
            role="img"
            aria-label={title}
          >
            {/* Horizontal grid */}
            {[0, 0.5, 1].map((t) => {
              const y = padT + t * (height - padT - padB);
              const val = Math.round((maxY - t * (maxY - minY)) * 10) / 10;
              return (
                <g key={t}>
                  <line
                    x1={padL}
                    x2={width - padR}
                    y1={y}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                  />
                  <text
                    x={padL - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-slate-400 text-[10px] font-mono"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Threshold reference lines */}
            {datLine !== undefined && (
              <line
                x1={padL}
                x2={width - padR}
                y1={toY(datLine)}
                y2={toY(datLine)}
                stroke="#d97706"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
            )}
            {totLine !== undefined && (
              <line
                x1={padL}
                x2={width - padR}
                y1={toY(totLine)}
                y2={toY(totLine)}
                stroke="#16a34a"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
            )}

            {/* Area & line */}
            {points.length > 1 && (
              <>
                <path d={areaD} fill={accentColor} fillOpacity="0.09" />
                <path
                  d={pathD}
                  fill="none"
                  stroke={accentColor}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* Data points */}
            {coords.map((c, idx) => (
              <g
                key={`${c.date}-${idx}`}
                className="cursor-pointer"
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={() => setActiveIndex(activeIndex === idx ? null : idx)}
              >
                <circle cx={c.x} cy={c.y} r="14" fill="transparent" />
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={activeIndex === idx ? 5.5 : 4}
                  fill="#ffffff"
                  stroke={accentColor}
                  strokeWidth="2.5"
                />
                <text
                  x={c.x}
                  y={height - 10}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px]"
                >
                  {c.label.length > 10 ? `${c.label.slice(0, 9)}…` : c.label}
                </text>
              </g>
            ))}
          </svg>

          {activePoint && (
            <div className="mt-1 text-xs text-slate-600 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <span>
                {activePoint.label} ({activePoint.date})
              </span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {activePoint.value} {unit}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const ProgressCharts: React.FC<Props> = ({ student, assessments }) => {
  const sorted = useMemo(
    () => [...assessments].sort((a, b) => a.testedAt.localeCompare(b.testedAt)),
    [assessments]
  );

  const threshold = getThreshold(student.age, student.gender);

  const bmiPoints = sorted.map((a) => ({
    label: a.termLabel,
    date: a.testedAt,
    value: a.bmi,
  }));
  const situpsPoints = sorted.map((a) => ({
    label: a.termLabel,
    date: a.testedAt,
    value: a.situpsCount,
  }));
  const jumpPoints = sorted.map((a) => ({
    label: a.termLabel,
    date: a.testedAt,
    value: a.longJumpCm,
  }));

  const primaryMode = sorted[sorted.length - 1]?.enduranceMode ?? '5min_m';
  const endurancePoints = sorted
    .filter((a) => a.enduranceMode === primaryMode)
    .map((a) => ({
      label: a.termLabel,
      date: a.testedAt,
      value: a.enduranceValue,
    }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <MetricLineChart
        title="Tiến trình chỉ số BMI"
        unit="kg/m²"
        points={bmiPoints}
        accentColor="#0f766e"
      />
      <MetricLineChart
        title="Nằm ngửa gập bụng (30 giây)"
        unit="lần"
        points={situpsPoints}
        totLine={threshold.situps.tot}
        datLine={threshold.situps.dat}
        accentColor="#0284c7"
      />
      <MetricLineChart
        title="Bật xa tại chỗ"
        unit="cm"
        points={jumpPoints}
        totLine={threshold.longJump.tot}
        datLine={threshold.longJump.dat}
        accentColor="#7c3aed"
      />
      <MetricLineChart
        title={
          primaryMode === '5min_m'
            ? 'Chạy bền tùy sức (5 phút)'
            : `Chạy bền (${student.gender === 'nam' ? '1000m' : '800m'})`
        }
        unit={primaryMode === '5min_m' ? 'm' : 'giây'}
        points={endurancePoints}
        totLine={
          primaryMode === '5min_m'
            ? threshold.endurance5Min.tot
            : threshold.enduranceDistanceSec.totMaxSec
        }
        datLine={
          primaryMode === '5min_m'
            ? threshold.endurance5Min.dat
            : threshold.enduranceDistanceSec.datMaxSec
        }
        invertGood={primaryMode === 'distance_s'}
        accentColor="#d97706"
      />
    </div>
  );
};
