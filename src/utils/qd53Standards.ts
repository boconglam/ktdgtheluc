import type {
  BmiStandardConfig,
  BmiStandardPreset,
  EnduranceMode,
  FitnessGrade,
  Gender,
  SchoolAdminConfig,
  SchoolLevel,
} from '../types/fitness';

export interface AgeGenderThreshold {
  age: number; // 6 .. 21 (21 áp dụng cho >= 21 tuổi)
  level: Exclude<SchoolLevel, 'tat_ca'>;
  gender: Gender;
  situps: { tot: number; dat: number }; // lần / 30 giây (>=)
  longJump: { tot: number; dat: number }; // cm (>=)
  endurance5Min: { tot: number; dat: number }; // mét trong 5 phút (>=)
  enduranceDistanceSec: {
    distanceMeters: 300 | 500 | 600 | 800 | 1000 | 1500;
    totMaxSec: number; // <=
    datMaxSec: number; // <=
  };
}

export const SCHOOL_LEVEL_OPTIONS: Array<{
  value: SchoolLevel;
  label: string;
  shortLabel: string;
  ageRangeLabel: string;
}> = [
  {
    value: 'tieu_hoc',
    label: 'Tiểu học (6–10 tuổi · Lớp 1–5)',
    shortLabel: 'Tiểu học',
    ageRangeLabel: '6–10 tuổi',
  },
  {
    value: 'thcs',
    label: 'THCS (11–14 tuổi · Lớp 6–9)',
    shortLabel: 'THCS',
    ageRangeLabel: '11–14 tuổi',
  },
  {
    value: 'thpt',
    label: 'THPT (15–18 tuổi · Lớp 10–12)',
    shortLabel: 'THPT',
    ageRangeLabel: '15–18 tuổi',
  },
  {
    value: 'dai_hoc',
    label: 'Đại học / Cao đẳng (19–22+ tuổi)',
    shortLabel: 'Đại học / CĐ',
    ageRangeLabel: '19–22+ tuổi',
  },
  {
    value: 'tat_ca',
    label: 'Tất cả cấp học (6–22+ tuổi)',
    shortLabel: 'Tất cả cấp học',
    ageRangeLabel: '6–22+ tuổi',
  },
];

export function formatSchoolLevelLabel(level?: SchoolLevel): string {
  return SCHOOL_LEVEL_OPTIONS.find((o) => o.value === level)?.shortLabel || 'THPT';
}

export function formatGradeLevelLabel(gradeLevel: number): string {
  if (gradeLevel >= 13) return `Năm ${gradeLevel - 12} (ĐH)`;
  return `Khối ${gradeLevel}`;
}

export function getGradeOptionsForLevel(
  level: SchoolLevel = 'thpt'
): Array<{ value: number; label: string; defaultAge: number }> {
  if (level === 'tieu_hoc') {
    return [1, 2, 3, 4, 5].map((g) => ({ value: g, label: `Khối ${g}`, defaultAge: g + 5 }));
  }
  if (level === 'thcs') {
    return [6, 7, 8, 9].map((g) => ({ value: g, label: `Khối ${g}`, defaultAge: g + 5 }));
  }
  if (level === 'thpt') {
    return [10, 11, 12].map((g) => ({ value: g, label: `Khối ${g}`, defaultAge: g + 5 }));
  }
  if (level === 'dai_hoc') {
    return [13, 14, 15, 16].map((g) => ({
      value: g,
      label: `Năm ${g - 12} (ĐH/CĐ)`,
      defaultAge: g + 6,
    }));
  }
  return [
    ...[1, 2, 3, 4, 5].map((g) => ({ value: g, label: `Khối ${g} (Tiểu học)`, defaultAge: g + 5 })),
    ...[6, 7, 8, 9].map((g) => ({ value: g, label: `Khối ${g} (THCS)`, defaultAge: g + 5 })),
    ...[10, 11, 12].map((g) => ({ value: g, label: `Khối ${g} (THPT)`, defaultAge: g + 5 })),
    ...[13, 14, 15, 16].map((g) => ({
      value: g,
      label: `Năm ${g - 12} (ĐH/CĐ)`,
      defaultAge: g + 6,
    })),
  ];
}

/**
 * Bảng tiêu chuẩn đánh giá, xếp loại thể lực học sinh, sinh viên (6 đến 21+ tuổi)
 * Theo Quyết định số 53/2008/QĐ-BGDĐT ngày 17/09/2008 của Bộ Giáo dục và Đào tạo.
 */
export const QD53_THRESHOLDS: AgeGenderThreshold[] = [
  // =========================================================================
  // TIỂU HỌC (6 - 10 tuổi)
  // =========================================================================
  { age: 6, level: 'tieu_hoc', gender: 'nam', situps: { tot: 10, dat: 6 }, longJump: { tot: 115, dat: 100 }, endurance5Min: { tot: 710, dat: 610 }, enduranceDistanceSec: { distanceMeters: 300, totMaxSec: 90, datMaxSec: 105 } },
  { age: 7, level: 'tieu_hoc', gender: 'nam', situps: { tot: 11, dat: 7 }, longJump: { tot: 125, dat: 110 }, endurance5Min: { tot: 750, dat: 640 }, enduranceDistanceSec: { distanceMeters: 300, totMaxSec: 85, datMaxSec: 100 } },
  { age: 8, level: 'tieu_hoc', gender: 'nam', situps: { tot: 12, dat: 8 }, longJump: { tot: 135, dat: 120 }, endurance5Min: { tot: 790, dat: 670 }, enduranceDistanceSec: { distanceMeters: 300, totMaxSec: 80, datMaxSec: 95 } },
  { age: 9, level: 'tieu_hoc', gender: 'nam', situps: { tot: 13, dat: 9 }, longJump: { tot: 145, dat: 128 }, endurance5Min: { tot: 830, dat: 710 }, enduranceDistanceSec: { distanceMeters: 500, totMaxSec: 140, datMaxSec: 165 } },
  { age: 10, level: 'tieu_hoc', gender: 'nam', situps: { tot: 14, dat: 10 }, longJump: { tot: 155, dat: 138 }, endurance5Min: { tot: 870, dat: 740 }, enduranceDistanceSec: { distanceMeters: 500, totMaxSec: 135, datMaxSec: 160 } },

  { age: 6, level: 'tieu_hoc', gender: 'nu', situps: { tot: 9, dat: 5 }, longJump: { tot: 110, dat: 95 }, endurance5Min: { tot: 660, dat: 570 }, enduranceDistanceSec: { distanceMeters: 300, totMaxSec: 95, datMaxSec: 112 } },
  { age: 7, level: 'tieu_hoc', gender: 'nu', situps: { tot: 10, dat: 6 }, longJump: { tot: 118, dat: 103 }, endurance5Min: { tot: 700, dat: 600 }, enduranceDistanceSec: { distanceMeters: 300, totMaxSec: 90, datMaxSec: 106 } },
  { age: 8, level: 'tieu_hoc', gender: 'nu', situps: { tot: 11, dat: 7 }, longJump: { tot: 126, dat: 110 }, endurance5Min: { tot: 740, dat: 630 }, enduranceDistanceSec: { distanceMeters: 300, totMaxSec: 85, datMaxSec: 100 } },
  { age: 9, level: 'tieu_hoc', gender: 'nu', situps: { tot: 12, dat: 8 }, longJump: { tot: 134, dat: 118 }, endurance5Min: { tot: 770, dat: 660 }, enduranceDistanceSec: { distanceMeters: 500, totMaxSec: 150, datMaxSec: 175 } },
  { age: 10, level: 'tieu_hoc', gender: 'nu', situps: { tot: 13, dat: 9 }, longJump: { tot: 142, dat: 125 }, endurance5Min: { tot: 800, dat: 680 }, enduranceDistanceSec: { distanceMeters: 500, totMaxSec: 145, datMaxSec: 170 } },

  // =========================================================================
  // THCS (11 - 14 tuổi)
  // =========================================================================
  { age: 11, level: 'thcs', gender: 'nam', situps: { tot: 15, dat: 11 }, longJump: { tot: 165, dat: 146 }, endurance5Min: { tot: 900, dat: 780 }, enduranceDistanceSec: { distanceMeters: 800, totMaxSec: 210, datMaxSec: 240 } },
  { age: 12, level: 'thcs', gender: 'nam', situps: { tot: 16, dat: 12 }, longJump: { tot: 174, dat: 155 }, endurance5Min: { tot: 930, dat: 810 }, enduranceDistanceSec: { distanceMeters: 800, totMaxSec: 202, datMaxSec: 232 } },
  { age: 13, level: 'thcs', gender: 'nam', situps: { tot: 18, dat: 13 }, longJump: { tot: 183, dat: 164 }, endurance5Min: { tot: 970, dat: 840 }, enduranceDistanceSec: { distanceMeters: 800, totMaxSec: 194, datMaxSec: 224 } },
  { age: 14, level: 'thcs', gender: 'nam', situps: { tot: 19, dat: 14 }, longJump: { tot: 191, dat: 171 }, endurance5Min: { tot: 1000, dat: 870 }, enduranceDistanceSec: { distanceMeters: 800, totMaxSec: 186, datMaxSec: 216 } },

  { age: 11, level: 'thcs', gender: 'nu', situps: { tot: 14, dat: 10 }, longJump: { tot: 148, dat: 132 }, endurance5Min: { tot: 820, dat: 700 }, enduranceDistanceSec: { distanceMeters: 600, totMaxSec: 175, datMaxSec: 205 } },
  { age: 12, level: 'thcs', gender: 'nu', situps: { tot: 15, dat: 10 }, longJump: { tot: 154, dat: 138 }, endurance5Min: { tot: 840, dat: 720 }, enduranceDistanceSec: { distanceMeters: 600, totMaxSec: 170, datMaxSec: 200 } },
  { age: 13, level: 'thcs', gender: 'nu', situps: { tot: 16, dat: 11 }, longJump: { tot: 159, dat: 143 }, endurance5Min: { tot: 855, dat: 735 }, enduranceDistanceSec: { distanceMeters: 600, totMaxSec: 165, datMaxSec: 195 } },
  { age: 14, level: 'thcs', gender: 'nu', situps: { tot: 16, dat: 11 }, longJump: { tot: 162, dat: 147 }, endurance5Min: { tot: 870, dat: 750 }, enduranceDistanceSec: { distanceMeters: 600, totMaxSec: 160, datMaxSec: 190 } },

  // =========================================================================
  // THPT (15 - 18 tuổi)
  // =========================================================================
  { age: 15, level: 'thpt', gender: 'nam', situps: { tot: 20, dat: 15 }, longJump: { tot: 198, dat: 178 }, endurance5Min: { tot: 1030, dat: 900 }, enduranceDistanceSec: { distanceMeters: 1000, totMaxSec: 235, datMaxSec: 265 } },
  { age: 16, level: 'thpt', gender: 'nam', situps: { tot: 22, dat: 17 }, longJump: { tot: 206, dat: 186 }, endurance5Min: { tot: 1060, dat: 920 }, enduranceDistanceSec: { distanceMeters: 1000, totMaxSec: 230, datMaxSec: 260 } },
  { age: 17, level: 'thpt', gender: 'nam', situps: { tot: 24, dat: 19 }, longJump: { tot: 213, dat: 193 }, endurance5Min: { tot: 1090, dat: 940 }, enduranceDistanceSec: { distanceMeters: 1000, totMaxSec: 225, datMaxSec: 255 } },
  { age: 18, level: 'thpt', gender: 'nam', situps: { tot: 25, dat: 20 }, longJump: { tot: 218, dat: 198 }, endurance5Min: { tot: 1120, dat: 960 }, enduranceDistanceSec: { distanceMeters: 1000, totMaxSec: 220, datMaxSec: 250 } },

  { age: 15, level: 'thpt', gender: 'nu', situps: { tot: 17, dat: 12 }, longJump: { tot: 165, dat: 150 }, endurance5Min: { tot: 880, dat: 760 }, enduranceDistanceSec: { distanceMeters: 800, totMaxSec: 225, datMaxSec: 255 } },
  { age: 16, level: 'thpt', gender: 'nu', situps: { tot: 18, dat: 13 }, longJump: { tot: 167, dat: 152 }, endurance5Min: { tot: 900, dat: 780 }, enduranceDistanceSec: { distanceMeters: 800, totMaxSec: 220, datMaxSec: 250 } },
  { age: 17, level: 'thpt', gender: 'nu', situps: { tot: 19, dat: 14 }, longJump: { tot: 168, dat: 153 }, endurance5Min: { tot: 920, dat: 800 }, enduranceDistanceSec: { distanceMeters: 800, totMaxSec: 215, datMaxSec: 245 } },
  { age: 18, level: 'thpt', gender: 'nu', situps: { tot: 20, dat: 15 }, longJump: { tot: 170, dat: 155 }, endurance5Min: { tot: 940, dat: 820 }, enduranceDistanceSec: { distanceMeters: 800, totMaxSec: 210, datMaxSec: 240 } },

  // =========================================================================
  // ĐẠI HỌC / CAO ĐẲNG / TCCN (19 - 21+ tuổi)
  // =========================================================================
  { age: 19, level: 'dai_hoc', gender: 'nam', situps: { tot: 26, dat: 21 }, longJump: { tot: 222, dat: 202 }, endurance5Min: { tot: 1150, dat: 980 }, enduranceDistanceSec: { distanceMeters: 1500, totMaxSec: 345, datMaxSec: 390 } },
  { age: 20, level: 'dai_hoc', gender: 'nam', situps: { tot: 27, dat: 22 }, longJump: { tot: 225, dat: 205 }, endurance5Min: { tot: 1180, dat: 1000 }, enduranceDistanceSec: { distanceMeters: 1500, totMaxSec: 338, datMaxSec: 382 } },
  { age: 21, level: 'dai_hoc', gender: 'nam', situps: { tot: 28, dat: 22 }, longJump: { tot: 228, dat: 208 }, endurance5Min: { tot: 1200, dat: 1020 }, enduranceDistanceSec: { distanceMeters: 1500, totMaxSec: 332, datMaxSec: 375 } },

  { age: 19, level: 'dai_hoc', gender: 'nu', situps: { tot: 21, dat: 16 }, longJump: { tot: 172, dat: 156 }, endurance5Min: { tot: 960, dat: 840 }, enduranceDistanceSec: { distanceMeters: 800, totMaxSec: 205, datMaxSec: 235 } },
  { age: 20, level: 'dai_hoc', gender: 'nu', situps: { tot: 22, dat: 16 }, longJump: { tot: 174, dat: 158 }, endurance5Min: { tot: 980, dat: 850 }, enduranceDistanceSec: { distanceMeters: 800, totMaxSec: 200, datMaxSec: 230 } },
  { age: 21, level: 'dai_hoc', gender: 'nu', situps: { tot: 22, dat: 17 }, longJump: { tot: 175, dat: 160 }, endurance5Min: { tot: 990, dat: 860 }, enduranceDistanceSec: { distanceMeters: 800, totMaxSec: 196, datMaxSec: 226 } },
];

export function clampQd53Age(age: number): number {
  const rounded = Math.round(age);
  if (rounded <= 6) return 6;
  if (rounded >= 21) return 21;
  return rounded;
}

export function getThreshold(age: number, gender: Gender): AgeGenderThreshold {
  const clamped = clampQd53Age(age);
  return (
    QD53_THRESHOLDS.find((t) => t.age === clamped && t.gender === gender) ??
    QD53_THRESHOLDS.find((t) => t.age === 16 && t.gender === gender) ??
    QD53_THRESHOLDS[0]
  );
}

export function getThresholdsForLevel(
  level: SchoolLevel,
  gender: Gender
): AgeGenderThreshold[] {
  return QD53_THRESHOLDS.filter(
    (t) => t.gender === gender && (level === 'tat_ca' || t.level === level)
  );
}

export function evaluateSitups(count: number, age: number, gender: Gender): FitnessGrade {
  const t = getThreshold(age, gender).situps;
  if (count >= t.tot) return 'tot';
  if (count >= t.dat) return 'dat';
  return 'chua_dat';
}

export function evaluateLongJump(cm: number, age: number, gender: Gender): FitnessGrade {
  const t = getThreshold(age, gender).longJump;
  if (cm >= t.tot) return 'tot';
  if (cm >= t.dat) return 'dat';
  return 'chua_dat';
}

export function evaluateEndurance(
  value: number,
  mode: EnduranceMode,
  age: number,
  gender: Gender
): FitnessGrade {
  const t = getThreshold(age, gender);
  if (mode === '5min_m') {
    if (value >= t.endurance5Min.tot) return 'tot';
    if (value >= t.endurance5Min.dat) return 'dat';
    return 'chua_dat';
  }
  if (value <= 0) return 'chua_dat';
  if (value <= t.enduranceDistanceSec.totMaxSec) return 'tot';
  if (value <= t.enduranceDistanceSec.datMaxSec) return 'dat';
  return 'chua_dat';
}

/**
 * Xếp loại thể lực chung theo Điều 5 Quyết định 53/2008/QĐ-BGDĐT:
 * - Tốt: Tất cả các nội dung kiểm tra đều từ mức Đạt trở lên, trong đó có ít nhất 2/3 số nội dung đạt mức Tốt.
 * - Đạt: Tất cả các nội dung kiểm tra đều đạt mức Đạt trở lên (nhưng chưa đủ điều kiện Tốt).
 * - Chưa đạt: Có ít nhất 1 nội dung kiểm tra ở mức Chưa đạt.
 */
export function evaluateOverallQd53(
  situpsGrade: FitnessGrade,
  longJumpGrade: FitnessGrade,
  enduranceGrade: FitnessGrade
): FitnessGrade {
  const grades = [situpsGrade, longJumpGrade, enduranceGrade];
  if (grades.includes('chua_dat')) return 'chua_dat';
  const totCount = grades.filter((g) => g === 'tot').length;
  if (totCount >= 2) return 'tot';
  return 'dat';
}

export function calculateBmi(heightCm: number, weightKg: number): number {
  if (heightCm <= 0 || weightKg <= 0) return 0;
  const hMeters = heightCm / 100;
  return Math.round((weightKg / (hMeters * hMeters)) * 10) / 10;
}

export const DEFAULT_VN_BMI_STANDARD: BmiStandardConfig = {
  preset: 'vn_wpro',
  countryLabel: 'Việt Nam / Châu Á (IDI & WPRO - Bộ Y tế)',
  underweightMax: 18.5,
  normalMax: 23.0,
  overweightMax: 25.0,
  obese1Max: 30.0,
  ageAdjustUnder18: true,
};

export const WHO_GLOBAL_BMI_STANDARD: BmiStandardConfig = {
  preset: 'who_global',
  countryLabel: 'WHO Quốc tế (Châu Âu / Toàn cầu)',
  underweightMax: 18.5,
  normalMax: 25.0,
  overweightMax: 30.0,
  obese1Max: 35.0,
  ageAdjustUnder18: true,
};

export function getDefaultBmiStandard(preset: BmiStandardPreset): BmiStandardConfig {
  if (preset === 'who_global') return { ...WHO_GLOBAL_BMI_STANDARD };
  if (preset === 'custom') {
    return {
      ...DEFAULT_VN_BMI_STANDARD,
      preset: 'custom',
      countryLabel: 'Tùy chỉnh quốc gia / khu vực',
    };
  }
  return { ...DEFAULT_VN_BMI_STANDARD };
}

export function extractBmiConfigFromSchool(schoolConfig?: SchoolAdminConfig | null): BmiStandardConfig {
  if (!schoolConfig || !schoolConfig.bmiPreset) {
    return { ...DEFAULT_VN_BMI_STANDARD };
  }
  const base = getDefaultBmiStandard(schoolConfig.bmiPreset);
  return {
    preset: schoolConfig.bmiPreset,
    countryLabel: schoolConfig.bmiCountryLabel || base.countryLabel,
    underweightMax: Number(schoolConfig.bmiUnderweightMax) || base.underweightMax,
    normalMax: Number(schoolConfig.bmiNormalMax) || base.normalMax,
    overweightMax: Number(schoolConfig.bmiOverweightMax) || base.overweightMax,
    obese1Max: Number(schoolConfig.bmiObese1Max) || base.obese1Max,
    ageAdjustUnder18:
      typeof schoolConfig.bmiAgeAdjust === 'boolean'
        ? schoolConfig.bmiAgeAdjust
        : base.ageAdjustUnder18,
  };
}

export interface BmiEvaluation {
  bmi: number;
  category: string;
  tone: 'info' | 'good' | 'warn' | 'danger';
  advice: string;
  thresholdsLabel: string;
}

function getVietnamesePediatricCutoffs(age: number, baseNormalMax: number): {
  severeThin: number;
  underweight: number;
  normalMax: number;
  overweightMax: number;
} {
  // Tỷ lệ hiệu chỉnh theo chuẩn người Việt Nam (gốc WPRO 23.0) hoặc chuẩn quốc gia khác
  const scale = baseNormalMax / 23.0;
  if (age <= 7) {
    return {
      severeThin: Math.round(12.6 * 10) / 10,
      underweight: Math.round(13.8 * 10) / 10,
      normalMax: Math.round(17.5 * scale * 10) / 10,
      overweightMax: Math.round(19.5 * scale * 10) / 10,
    };
  }
  if (age <= 9) {
    return {
      severeThin: 13.0,
      underweight: 14.2,
      normalMax: Math.round(18.4 * scale * 10) / 10,
      overweightMax: Math.round(20.8 * scale * 10) / 10,
    };
  }
  if (age === 10) {
    return {
      severeThin: 13.4,
      underweight: 14.6,
      normalMax: Math.round(19.4 * scale * 10) / 10,
      overweightMax: Math.round(22.0 * scale * 10) / 10,
    };
  }
  if (age <= 12) {
    return {
      severeThin: 14.0,
      underweight: 15.2,
      normalMax: Math.round(20.4 * scale * 10) / 10,
      overweightMax: Math.round(23.0 * scale * 10) / 10,
    };
  }
  if (age <= 14) {
    return {
      severeThin: 14.8,
      underweight: 16.2,
      normalMax: Math.round(21.6 * scale * 10) / 10,
      overweightMax: Math.round(24.0 * scale * 10) / 10,
    };
  }
  if (age === 15) {
    return {
      severeThin: 15.4,
      underweight: 17.0,
      normalMax: Math.round(22.5 * scale * 10) / 10,
      overweightMax: Math.round(24.5 * scale * 10) / 10,
    };
  }
  if (age === 16) {
    return {
      severeThin: 15.8,
      underweight: 17.5,
      normalMax: Math.round(23.0 * scale * 10) / 10,
      overweightMax: Math.round(25.0 * scale * 10) / 10,
    };
  }
  // 17 tuổi
  return {
    severeThin: 16.0,
    underweight: 18.0,
    normalMax: Math.round(23.0 * scale * 10) / 10,
    overweightMax: Math.round(25.0 * scale * 10) / 10,
  };
}

/**
 * Phân loại BMI theo chuẩn người Việt Nam (IDI & WPRO / Bộ Y tế) hoặc chuẩn quốc gia tùy chỉnh.
 * Hỗ trợ hiệu chỉnh theo độ tuổi (6–17 tuổi) và người trưởng thành (18+ tuổi).
 */
export function classifyBmi(
  bmi: number,
  age: number,
  config: BmiStandardConfig = DEFAULT_VN_BMI_STANDARD
): BmiEvaluation {
  const useYouth = config.ageAdjustUnder18 && age < 18;
  const cutoffs = useYouth
    ? getVietnamesePediatricCutoffs(age, config.normalMax)
    : {
        severeThin: Math.max(12, Math.round((config.underweightMax - 2.5) * 10) / 10),
        underweight: config.underweightMax,
        normalMax: config.normalMax,
        overweightMax: config.overweightMax,
      };

  const thresholdsLabel = `Chuẩn ${config.countryLabel}: Bình thường ${cutoffs.underweight}–${(
    cutoffs.normalMax - 0.1
  ).toFixed(1)} · Thừa cân ≥ ${cutoffs.normalMax} · Béo phì ≥ ${cutoffs.overweightMax}`;

  if (bmi < cutoffs.severeThin) {
    return {
      bmi,
      category: 'Gầy độ II',
      tone: 'danger',
      advice: 'Chỉ số BMI thấp đáng kể. Cần tăng cường dinh dưỡng hợp lý và theo dõi y tế học đường.',
      thresholdsLabel,
    };
  }
  if (bmi < cutoffs.underweight) {
    return {
      bmi,
      category: 'Thiếu cân (Gầy)',
      tone: 'warn',
      advice: 'Khuyến nghị bổ sung năng lượng, đạm và tập luyện tăng sức mạnh cơ bắp.',
      thresholdsLabel,
    };
  }
  if (bmi < cutoffs.normalMax) {
    return {
      bmi,
      category: 'Bình thường',
      tone: 'good',
      advice: 'Chỉ số cân đối phù hợp thể trạng Việt Nam, duy trì chế độ vận động và dinh dưỡng.',
      thresholdsLabel,
    };
  }
  if (bmi < cutoffs.overweightMax) {
    return {
      bmi,
      category: 'Thừa cân',
      tone: 'warn',
      advice: 'Nên tăng cường vận động sức bền (chạy bền, thể thao ngoài trời) và cân đối khẩu phần.',
      thresholdsLabel,
    };
  }
  if (!useYouth && bmi >= config.obese1Max) {
    return {
      bmi,
      category: 'Béo phì độ II',
      tone: 'danger',
      advice: 'Cần chương trình vận động giảm mỡ an toàn có giám sát chuyên môn và tư vấn dinh dưỡng.',
      thresholdsLabel,
    };
  }
  return {
    bmi,
    category: !useYouth ? 'Béo phì độ I' : 'Béo phì',
    tone: 'danger',
    advice: 'Cần phối hợp giáo án vận động giảm mỡ an toàn và tư vấn y tế học đường.',
    thresholdsLabel,
  };
}

export function formatGradeLabel(grade: FitnessGrade): string {
  switch (grade) {
    case 'tot':
      return 'Tốt';
    case 'dat':
      return 'Đạt';
    case 'chua_dat':
      return 'Chưa đạt';
  }
}

export function formatGenderLabel(gender: Gender): string {
  return gender === 'nam' ? 'Nam' : 'Nữ';
}

export function formatSecondsToMinSec(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.round(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatEnduranceDisplay(
  value: number,
  mode: EnduranceMode,
  gender: Gender,
  age = 16
): string {
  if (mode === '5min_m') {
    return `${Math.round(value)} m / 5p`;
  }
  const dist = getThreshold(age, gender).enduranceDistanceSec.distanceMeters;
  return `${formatSecondsToMinSec(value)} (${dist}m)`;
}
