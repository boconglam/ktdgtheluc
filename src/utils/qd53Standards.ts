import type { EnduranceMode, FitnessGrade, Gender } from '../types/fitness';

export interface AgeGenderThreshold {
  age: 15 | 16 | 17 | 18;
  gender: Gender;
  situps: { tot: number; dat: number }; // lần / 30 giây (>=)
  longJump: { tot: number; dat: number }; // cm (>=)
  endurance5Min: { tot: number; dat: number }; // mét trong 5 phút (>=)
  enduranceDistanceSec: {
    distanceMeters: 1000 | 800;
    totMaxSec: number; // <=
    datMaxSec: number; // <=
  };
}

/**
 * Tiêu chuẩn đánh giá, xếp loại thể lực học sinh THPT (15 - 18 tuổi)
 * Theo Quyết định số 53/2008/QĐ-BGDĐT ngày 17/09/2008 của Bộ Giáo dục và Đào tạo.
 */
export const QD53_THRESHOLDS: AgeGenderThreshold[] = [
  // NAM (15 - 18 tuổi)
  {
    age: 15,
    gender: 'nam',
    situps: { tot: 20, dat: 15 },
    longJump: { tot: 198, dat: 178 },
    endurance5Min: { tot: 1030, dat: 900 },
    enduranceDistanceSec: { distanceMeters: 1000, totMaxSec: 235, datMaxSec: 265 },
  },
  {
    age: 16,
    gender: 'nam',
    situps: { tot: 22, dat: 17 },
    longJump: { tot: 206, dat: 186 },
    endurance5Min: { tot: 1060, dat: 920 },
    enduranceDistanceSec: { distanceMeters: 1000, totMaxSec: 230, datMaxSec: 260 },
  },
  {
    age: 17,
    gender: 'nam',
    situps: { tot: 24, dat: 19 },
    longJump: { tot: 213, dat: 193 },
    endurance5Min: { tot: 1090, dat: 940 },
    enduranceDistanceSec: { distanceMeters: 1000, totMaxSec: 225, datMaxSec: 255 },
  },
  {
    age: 18,
    gender: 'nam',
    situps: { tot: 25, dat: 20 },
    longJump: { tot: 218, dat: 198 },
    endurance5Min: { tot: 1120, dat: 960 },
    enduranceDistanceSec: { distanceMeters: 1000, totMaxSec: 220, datMaxSec: 250 },
  },
  // NỮ (15 - 18 tuổi)
  {
    age: 15,
    gender: 'nu',
    situps: { tot: 17, dat: 12 },
    longJump: { tot: 165, dat: 150 },
    endurance5Min: { tot: 880, dat: 760 },
    enduranceDistanceSec: { distanceMeters: 800, totMaxSec: 225, datMaxSec: 255 },
  },
  {
    age: 16,
    gender: 'nu',
    situps: { tot: 18, dat: 13 },
    longJump: { tot: 167, dat: 152 },
    endurance5Min: { tot: 900, dat: 780 },
    enduranceDistanceSec: { distanceMeters: 800, totMaxSec: 220, datMaxSec: 250 },
  },
  {
    age: 17,
    gender: 'nu',
    situps: { tot: 19, dat: 14 },
    longJump: { tot: 168, dat: 153 },
    endurance5Min: { tot: 920, dat: 800 },
    enduranceDistanceSec: { distanceMeters: 800, totMaxSec: 215, datMaxSec: 245 },
  },
  {
    age: 18,
    gender: 'nu',
    situps: { tot: 20, dat: 15 },
    longJump: { tot: 170, dat: 155 },
    endurance5Min: { tot: 940, dat: 820 },
    enduranceDistanceSec: { distanceMeters: 800, totMaxSec: 210, datMaxSec: 240 },
  },
];

export function clampQd53Age(age: number): 15 | 16 | 17 | 18 {
  if (age <= 15) return 15;
  if (age === 16) return 16;
  if (age === 17) return 17;
  return 18;
}

export function getThreshold(age: number, gender: Gender): AgeGenderThreshold {
  const clamped = clampQd53Age(age);
  return (
    QD53_THRESHOLDS.find((t) => t.age === clamped && t.gender === gender) ??
    QD53_THRESHOLDS[0]
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

export interface BmiEvaluation {
  bmi: number;
  category: string;
  tone: 'info' | 'good' | 'warn' | 'danger';
  advice: string;
}

/**
 * Phân loại BMI cho học sinh THPT (15 - 18 tuổi) theo chuẩn WHO / IDI & WPRO Châu Á
 */
export function classifyBmi(bmi: number, age: number): BmiEvaluation {
  // Ngưỡng thiếu cân nhẹ ở tuổi 15-16 hơi thấp hơn người lớn (khoảng 17.5 - 18.0)
  const underweightCut = age <= 15 ? 17.5 : age === 16 ? 18.0 : 18.5;
  if (bmi < 16.0) {
    return {
      bmi,
      category: 'Gầy độ II',
      tone: 'danger',
      advice: 'Cần bổ sung dinh dưỡng và theo dõi sức khỏe thể lực định kỳ.',
    };
  }
  if (bmi < underweightCut) {
    return {
      bmi,
      category: 'Thiếu cân (Gầy)',
      tone: 'warn',
      advice: 'Khuyến nghị tăng cường năng lượng khẩu phần và bài tập sức mạnh.',
    };
  }
  if (bmi < 23.0) {
    return {
      bmi,
      category: 'Bình thường',
      tone: 'good',
      advice: 'Chỉ số cân đối, duy trì chế độ vận động và dinh dưỡng hiện tại.',
    };
  }
  if (bmi < 25.0) {
    return {
      bmi,
      category: 'Thừa cân',
      tone: 'warn',
      advice: 'Tăng thời lượng chạy bền và kiểm soát tinh bột/đường.',
    };
  }
  return {
    bmi,
    category: 'Béo phì',
    tone: 'danger',
    advice: 'Cần phối hợp giáo án vận động giảm mỡ an toàn và tư vấn y tế học đường.',
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

export function formatEnduranceDisplay(value: number, mode: EnduranceMode, gender: Gender): string {
  if (mode === '5min_m') {
    return `${Math.round(value)} m / 5p`;
  }
  const dist = gender === 'nam' ? '1000m' : '800m';
  return `${formatSecondsToMinSec(value)} (${dist})`;
}
