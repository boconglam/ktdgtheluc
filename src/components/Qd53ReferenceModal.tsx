import React, { useState } from 'react';
import { X } from 'lucide-react';
import { QD53_THRESHOLDS, formatSecondsToMinSec } from '../utils/qd53Standards';
import type { Gender } from '../types/fitness';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const Qd53ReferenceModal: React.FC<Props> = ({ open, onClose }) => {
  const [genderFilter, setGenderFilter] = useState<Gender>('nam');

  if (!open) return null;

  const rows = QD53_THRESHOLDS.filter((t) => t.gender === genderFilter);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Bảng tiêu chuẩn Quyết định 53/2008/QĐ-BGDĐT (THPT)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ban hành ngày 17/09/2008 · Độ tuổi 15–18 theo giới tính
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Đóng bảng chuẩn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setGenderFilter('nam')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap min-h-[40px] ${
                genderFilter === 'nam'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Nam sinh (15–18 tuổi)
            </button>
            <button
              type="button"
              onClick={() => setGenderFilter('nu')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap min-h-[40px] ${
                genderFilter === 'nu'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Nữ sinh (15–18 tuổi)
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-semibold">Tuổi</th>
                  <th className="py-2.5 px-3 font-semibold">Nằm ngửa gập bụng (lần/30s)</th>
                  <th className="py-2.5 px-3 font-semibold">Bật xa tại chỗ (cm)</th>
                  <th className="py-2.5 px-3 font-semibold">Chạy tùy sức 5 phút (m)</th>
                  <th className="py-2.5 px-3 font-semibold">
                    Chạy {genderFilter === 'nam' ? '1000m' : '800m'} (phút:giây)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                {rows.map((r) => (
                  <tr key={r.age} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-semibold text-slate-900 font-sans">
                      {r.age} tuổi
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-emerald-700 font-semibold">Tốt ≥ {r.situps.tot}</span>
                      <span className="text-slate-300 mx-1.5">|</span>
                      <span className="text-amber-700">Đạt ≥ {r.situps.dat}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-emerald-700 font-semibold">Tốt ≥ {r.longJump.tot}</span>
                      <span className="text-slate-300 mx-1.5">|</span>
                      <span className="text-amber-700">Đạt ≥ {r.longJump.dat}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-emerald-700 font-semibold">
                        Tốt ≥ {r.endurance5Min.tot}
                      </span>
                      <span className="text-slate-300 mx-1.5">|</span>
                      <span className="text-amber-700">Đạt ≥ {r.endurance5Min.dat}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-emerald-700 font-semibold">
                        Tốt ≤ {formatSecondsToMinSec(r.enduranceDistanceSec.totMaxSec)}
                      </span>
                      <span className="text-slate-300 mx-1.5">|</span>
                      <span className="text-amber-700">
                        Đạt ≤ {formatSecondsToMinSec(r.enduranceDistanceSec.datMaxSec)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-1.5 leading-relaxed">
            <p className="font-semibold text-slate-900">Quy tắc xếp loại chung (Điều 5, QĐ 53/2008):</p>
            <p>1. Xếp loại Tốt: Tất cả các nội dung kiểm tra đều đạt từ mức Đạt trở lên, trong đó có ít nhất 2/3 số nội dung đạt mức Tốt.</p>
            <p>2. Xếp loại Đạt: Tất cả các nội dung kiểm tra đều đạt mức Đạt trở lên (chưa đủ điều kiện Tốt).</p>
            <p>3. Chưa đạt: Có ít nhất 1 nội dung kiểm tra ở mức Chưa đạt.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
