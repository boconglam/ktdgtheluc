import React, { useEffect, useState } from 'react';
import { Check, Globe2, GraduationCap, X } from 'lucide-react';
import {
  DEFAULT_VN_BMI_STANDARD,
  QD53_THRESHOLDS,
  SCHOOL_LEVEL_OPTIONS,
  extractBmiConfigFromSchool,
  formatSecondsToMinSec,
  getDefaultBmiStandard,
  getThresholdsForLevel,
} from '../utils/qd53Standards';
import type {
  BmiStandardConfig,
  BmiStandardPreset,
  Gender,
  SchoolAdminConfig,
  SchoolLevel,
} from '../types/fitness';

interface Props {
  open: boolean;
  initialTab?: 'qd53' | 'bmi';
  onClose: () => void;
  schoolConfig?: SchoolAdminConfig;
  onUpdateSchoolConfig?: (next: SchoolAdminConfig) => void;
}

export const Qd53ReferenceModal: React.FC<Props> = ({
  open,
  initialTab = 'qd53',
  onClose,
  schoolConfig,
  onUpdateSchoolConfig,
}) => {
  const [modalTab, setModalTab] = useState<'qd53' | 'bmi'>(initialTab);
  const [levelFilter, setLevelFilter] = useState<SchoolLevel>(schoolConfig?.schoolLevel ?? 'thpt');
  const [genderFilter, setGenderFilter] = useState<Gender>('nam');
  const [bmiDraft, setBmiDraft] = useState<BmiStandardConfig>(() =>
    extractBmiConfigFromSchool(schoolConfig)
  );
  const [savedBanner, setSavedBanner] = useState('');

  useEffect(() => {
    if (open) {
      setModalTab(initialTab);
      setLevelFilter(schoolConfig?.schoolLevel ?? 'thpt');
      setBmiDraft(extractBmiConfigFromSchool(schoolConfig));
      setSavedBanner('');
    }
  }, [open, initialTab, schoolConfig]);

  if (!open) return null;

  const rows =
    levelFilter === 'tat_ca'
      ? QD53_THRESHOLDS.filter((t) => t.gender === genderFilter)
      : getThresholdsForLevel(levelFilter, genderFilter);

  const handleSelectBmiPreset = (preset: BmiStandardPreset) => {
    setBmiDraft(getDefaultBmiStandard(preset));
  };

  const handleApplyLevel = (nextLevel: SchoolLevel) => {
    setLevelFilter(nextLevel);
    if (onUpdateSchoolConfig && schoolConfig) {
      onUpdateSchoolConfig({ ...schoolConfig, schoolLevel: nextLevel });
      setSavedBanner('Đã cập nhật cấp học áp dụng cho toàn hệ thống.');
      window.setTimeout(() => setSavedBanner(''), 3000);
    }
  };

  const handleSaveBmiConfig = () => {
    if (!onUpdateSchoolConfig || !schoolConfig) return;
    const underweightMax = Math.min(22, Math.max(12, Number(bmiDraft.underweightMax) || 18.5));
    const normalMax = Math.min(30, Math.max(underweightMax + 0.5, Number(bmiDraft.normalMax) || 23));
    const overweightMax = Math.min(35, Math.max(normalMax + 0.5, Number(bmiDraft.overweightMax) || 25));
    const obese1Max = Math.min(45, Math.max(overweightMax + 0.5, Number(bmiDraft.obese1Max) || 30));

    onUpdateSchoolConfig({
      ...schoolConfig,
      bmiPreset: bmiDraft.preset,
      bmiCountryLabel: bmiDraft.countryLabel.trim() || DEFAULT_VN_BMI_STANDARD.countryLabel,
      bmiUnderweightMax: underweightMax,
      bmiNormalMax: normalMax,
      bmiOverweightMax: overweightMax,
      bmiObese1Max: obese1Max,
      bmiAgeAdjust: bmiDraft.ageAdjustUnder18,
    });
    setSavedBanner('Đã áp dụng chuẩn BMI mới cho toàn bộ đánh giá & báo cáo.');
    window.setTimeout(() => setSavedBanner(''), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Hệ thống tiêu chuẩn QĐ 53/2008 &amp; Chuẩn BMI theo quốc gia
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Quyết định 53/2008/QĐ-BGDĐT (nhiều cấp học 6–22+ tuổi) và Chuẩn BMI Việt Nam / Tùy chỉnh quốc gia
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

        {/* Top Modal Switch Tabs */}
        <div className="px-5 pt-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setModalTab('qd53')}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                modalTab === 'qd53'
                  ? 'border-teal-700 text-teal-800 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Bảng chuẩn QĐ 53/2008 (Nhiều cấp học)
            </button>
            <button
              type="button"
              onClick={() => setModalTab('bmi')}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                modalTab === 'bmi'
                  ? 'border-teal-700 text-teal-800 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe2 className="w-4 h-4" />
              Chuẩn BMI Việt Nam &amp; Quốc gia tùy chỉnh
            </button>
          </div>
          {savedBanner && (
            <span className="text-xs font-medium text-emerald-700 inline-flex items-center gap-1 pb-2">
              <Check className="w-3.5 h-3.5" />
              {savedBanner}
            </span>
          )}
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {modalTab === 'qd53' ? (
            <>
              {/* Education Level & Gender Filter */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {SCHOOL_LEVEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleApplyLevel(opt.value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap min-h-[36px] ${
                        levelFilter === opt.value
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.shortLabel} ({opt.ageRangeLabel})
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setGenderFilter('nam')}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap min-h-[36px] ${
                      genderFilter === 'nam'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Nam
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenderFilter('nu')}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap min-h-[36px] ${
                      genderFilter === 'nu'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Nữ
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="py-2.5 px-3 font-semibold">Tuổi</th>
                      <th className="py-2.5 px-3 font-semibold">Cấp học</th>
                      <th className="py-2.5 px-3 font-semibold">Gập bụng (lần/30s)</th>
                      <th className="py-2.5 px-3 font-semibold">Bật xa tại chỗ (cm)</th>
                      <th className="py-2.5 px-3 font-semibold">Chạy 5 phút (m)</th>
                      <th className="py-2.5 px-3 font-semibold">Chạy cự ly (phút:giây)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                    {rows.map((r) => (
                      <tr key={`${r.gender}-${r.age}`} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 font-sans whitespace-nowrap">
                          {r.age === 21 ? '21+ tuổi' : `${r.age} tuổi`}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-sans whitespace-nowrap">
                          {r.level === 'tieu_hoc'
                            ? 'Tiểu học'
                            : r.level === 'thcs'
                              ? 'THCS'
                              : r.level === 'thpt'
                                ? 'THPT'
                                : 'Đại học / CĐ'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="text-emerald-700 font-semibold">Tốt ≥ {r.situps.tot}</span>
                          <span className="text-slate-300 mx-1.5">|</span>
                          <span className="text-amber-700">Đạt ≥ {r.situps.dat}</span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="text-emerald-700 font-semibold">Tốt ≥ {r.longJump.tot}</span>
                          <span className="text-slate-300 mx-1.5">|</span>
                          <span className="text-amber-700">Đạt ≥ {r.longJump.dat}</span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="text-emerald-700 font-semibold">
                            Tốt ≥ {r.endurance5Min.tot}
                          </span>
                          <span className="text-slate-300 mx-1.5">|</span>
                          <span className="text-amber-700">Đạt ≥ {r.endurance5Min.dat}</span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="text-slate-500 mr-1.5 font-sans">
                            ({r.enduranceDistanceSec.distanceMeters}m)
                          </span>
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
                <p className="font-semibold text-slate-900">
                  Quy tắc xếp loại chung (Điều 5, QĐ 53/2008/QĐ-BGDĐT):
                </p>
                <p>
                  1. Xếp loại Tốt: Tất cả các nội dung kiểm tra đều đạt từ mức Đạt trở lên, trong đó có ít nhất 2/3 số nội dung đạt mức Tốt.
                </p>
                <p>
                  2. Xếp loại Đạt: Tất cả các nội dung kiểm tra đều đạt mức Đạt trở lên (chưa đủ điều kiện Tốt).
                </p>
                <p>3. Chưa đạt: Có ít nhất 1 nội dung kiểm tra ở mức Chưa đạt.</p>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-4 text-xs text-slate-700 space-y-1">
                <div className="font-semibold text-teal-900">
                  Chuẩn BMI mặc định phù hợp người Việt Nam (IDI &amp; WPRO - Châu Á / Bộ Y tế)
                </div>
                <p>
                  Người Việt Nam và khu vực Châu Á có ngưỡng thừa cân từ <strong>23.0 kg/m²</strong> và béo phì từ{' '}
                  <strong>25.0 kg/m²</strong> (thấp hơn chuẩn WHO Châu Âu 25.0 / 30.0). Học sinh dưới 18 tuổi được tự động hiệu chỉnh ngưỡng theo độ tuổi học đường.
                </p>
              </div>

              {/* Preset Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    id: 'vn_wpro' as BmiStandardPreset,
                    title: 'Việt Nam / Châu Á (IDI & WPRO)',
                    desc: 'Bình thường: 18.5 – 22.9 · Thừa cân: 23.0 – 24.9 · Béo phì ≥ 25.0',
                  },
                  {
                    id: 'who_global' as BmiStandardPreset,
                    title: 'WHO Quốc tế (Châu Âu)',
                    desc: 'Bình thường: 18.5 – 24.9 · Thừa cân: 25.0 – 29.9 · Béo phì ≥ 30.0',
                  },
                  {
                    id: 'custom' as BmiStandardPreset,
                    title: 'Tùy chỉnh theo quốc gia khác',
                    desc: 'Nhập tên quốc gia & các ngưỡng BMI riêng biệt theo tiêu chuẩn địa phương',
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectBmiPreset(item.id)}
                    className={`p-3.5 text-left rounded-xl border transition-colors ${
                      bmiDraft.preset === item.id
                        ? 'border-teal-700 bg-teal-50/70 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-semibold">{item.title}</div>
                    <div className="text-[11px] text-slate-500 mt-1 leading-snug">{item.desc}</div>
                  </button>
                ))}
              </div>

              {/* Editable Cutoffs */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-900">
                  Thông số ngưỡng phân loại BMI (áp dụng cho 18+ tuổi và làm gốc hiệu chỉnh tuổi học đường)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <label className="block sm:col-span-2 lg:col-span-3">
                    <span className="font-medium text-slate-700">Tên quốc gia / Tiêu chuẩn hiển thị</span>
                    <input
                      type="text"
                      value={bmiDraft.countryLabel}
                      onChange={(e) =>
                        setBmiDraft({
                          ...bmiDraft,
                          preset: bmiDraft.preset === 'vn_wpro' || bmiDraft.preset === 'who_global' ? 'custom' : bmiDraft.preset,
                          countryLabel: e.target.value,
                        })
                      }
                      placeholder="VD: Việt Nam / Châu Á (IDI & WPRO) hoặc Nhật Bản, Singapore..."
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Ngưỡng tối thiểu Bình thường (&lt; Gầy)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="12"
                      max="22"
                      value={bmiDraft.underweightMax}
                      onChange={(e) =>
                        setBmiDraft({ ...bmiDraft, preset: 'custom', underweightMax: Number(e.target.value) })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Ngưỡng bắt đầu Thừa cân (≥)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="18"
                      max="30"
                      value={bmiDraft.normalMax}
                      onChange={(e) =>
                        setBmiDraft({ ...bmiDraft, preset: 'custom', normalMax: Number(e.target.value) })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Ngưỡng Béo phì độ I (≥)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="20"
                      max="35"
                      value={bmiDraft.overweightMax}
                      onChange={(e) =>
                        setBmiDraft({ ...bmiDraft, preset: 'custom', overweightMax: Number(e.target.value) })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
                    />
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Ngưỡng Béo phì độ II (≥)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="24"
                      max="45"
                      value={bmiDraft.obese1Max}
                      onChange={(e) =>
                        setBmiDraft({ ...bmiDraft, preset: 'custom', obese1Max: Number(e.target.value) })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
                    />
                  </label>
                  <label className="flex items-center gap-2 sm:col-span-2 pt-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bmiDraft.ageAdjustUnder18}
                      onChange={(e) =>
                        setBmiDraft({ ...bmiDraft, ageAdjustUnder18: e.target.checked })
                      }
                      className="w-4 h-4 accent-teal-700"
                    />
                    <span className="text-slate-700 font-medium">
                      Tự động hiệu chỉnh ngưỡng BMI học đường cho học sinh dưới 18 tuổi (6–17 tuổi)
                    </span>
                  </label>
                </div>

                {onUpdateSchoolConfig && schoolConfig && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleSaveBmiConfig}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl min-h-[42px]"
                    >
                      <Check className="w-4 h-4" />
                      Lưu &amp; Áp dụng chuẩn BMI
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
