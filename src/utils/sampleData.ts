import type { FitnessAssessment, SchoolAdminConfig, StudentProfile } from '../types/fitness';
import {
  calculateBmi,
  classifyBmi,
  evaluateEndurance,
  evaluateLongJump,
  evaluateOverallQd53,
  evaluateSitups,
} from './qd53Standards';

export function buildSampleDataset(ownerUid: string): {
  schoolConfig: SchoolAdminConfig;
  students: StudentProfile[];
  assessments: FitnessAssessment[];
} {
  const schoolId = 'school_default';
  const schoolConfig: SchoolAdminConfig = {
    id: schoolId,
    managingAuthority: 'SỞ GIÁO DỤC VÀ ĐÀO TẠO TP. HỒ CHÍ MINH',
    schoolName: 'TRƯỜNG THPT NGUYỄN THƯỢNG HIỀN',
    schoolYear: '2025 - 2026',
    locationName: 'TP. Hồ Chí Minh',
    documentCode: 'Số: 12/BC-GDTC',
    signerTitle: 'THỦ TRƯỞNG ĐƠN VỊ',
    signerName: '',
    preparerName: 'Nguyễn Hoàng Nam',
    ownerUid,
    authorizedUids: [ownerUid],
  };

  const students: StudentProfile[] = [
    {
      id: 'stu_sample_1',
      schoolId,
      studentCode: 'HS10A101',
      fullName: 'Nguyễn Minh Khôi',
      className: '10A1',
      gradeLevel: 10,
      gender: 'nam',
      birthYear: 2011,
      age: 15,
      notes: '',
      ownerUid,
      authorizedUids: [ownerUid],
    },
    {
      id: 'stu_sample_2',
      schoolId,
      studentCode: 'HS10A102',
      fullName: 'Trần Ngọc Thảo Vy',
      className: '10A1',
      gradeLevel: 10,
      gender: 'nu',
      birthYear: 2011,
      age: 15,
      notes: '',
      ownerUid,
      authorizedUids: [ownerUid],
    },
    {
      id: 'stu_sample_3',
      schoolId,
      studentCode: 'HS11A201',
      fullName: 'Lê Hoàng Gia Bảo',
      className: '11A2',
      gradeLevel: 11,
      gender: 'nam',
      birthYear: 2010,
      age: 16,
      notes: '',
      ownerUid,
      authorizedUids: [ownerUid],
    },
    {
      id: 'stu_sample_4',
      schoolId,
      studentCode: 'HS12A101',
      fullName: 'Phạm Khánh Linh',
      className: '12A1',
      gradeLevel: 12,
      gender: 'nu',
      birthYear: 2009,
      age: 17,
      notes: '',
      ownerUid,
      authorizedUids: [ownerUid],
    },
  ];

  const rawEntries: Array<{
    id: string;
    student: StudentProfile;
    termLabel: string;
    testedAt: string;
    heightCm: number;
    weightKg: number;
    situpsCount: number;
    longJumpCm: number;
    enduranceValue: number;
  }> = [
    {
      id: 'asm_sample_1a',
      student: students[0],
      termLabel: 'Đầu năm học',
      testedAt: '2025-09-20',
      heightCm: 167,
      weightKg: 57,
      situpsCount: 18,
      longJumpCm: 188,
      enduranceValue: 960,
    },
    {
      id: 'asm_sample_1b',
      student: students[0],
      termLabel: 'Giữa kỳ I',
      testedAt: '2025-11-18',
      heightCm: 168,
      weightKg: 58,
      situpsCount: 22,
      longJumpCm: 201,
      enduranceValue: 1050,
    },
    {
      id: 'asm_sample_2a',
      student: students[1],
      termLabel: 'Đầu năm học',
      testedAt: '2025-09-20',
      heightCm: 158,
      weightKg: 48,
      situpsCount: 14,
      longJumpCm: 154,
      enduranceValue: 810,
    },
    {
      id: 'asm_sample_2b',
      student: students[1],
      termLabel: 'Giữa kỳ I',
      testedAt: '2025-11-18',
      heightCm: 159,
      weightKg: 49,
      situpsCount: 18,
      longJumpCm: 166,
      enduranceValue: 890,
    },
    {
      id: 'asm_sample_3b',
      student: students[2],
      termLabel: 'Giữa kỳ I',
      testedAt: '2025-11-18',
      heightCm: 172,
      weightKg: 71,
      situpsCount: 16,
      longJumpCm: 183,
      enduranceValue: 880,
    },
    {
      id: 'asm_sample_4b',
      student: students[3],
      termLabel: 'Giữa kỳ I',
      testedAt: '2025-11-18',
      heightCm: 162,
      weightKg: 52,
      situpsCount: 19,
      longJumpCm: 169,
      enduranceValue: 930,
    },
  ];

  const assessments: FitnessAssessment[] = rawEntries.map((entry) => {
    const bmi = calculateBmi(entry.heightCm, entry.weightKg);
    const bmiEval = classifyBmi(bmi, entry.student.age);
    const situpsGrade = evaluateSitups(entry.situpsCount, entry.student.age, entry.student.gender);
    const longJumpGrade = evaluateLongJump(entry.longJumpCm, entry.student.age, entry.student.gender);
    const enduranceGrade = evaluateEndurance(
      entry.enduranceValue,
      '5min_m',
      entry.student.age,
      entry.student.gender
    );
    const overallGrade = evaluateOverallQd53(situpsGrade, longJumpGrade, enduranceGrade);

    return {
      id: entry.id,
      studentId: entry.student.id,
      schoolId,
      termLabel: entry.termLabel,
      schoolYear: '2025 - 2026',
      testedAt: entry.testedAt,
      ageAtTest: entry.student.age,
      gender: entry.student.gender,
      heightCm: entry.heightCm,
      weightKg: entry.weightKg,
      bmi,
      bmiCategory: bmiEval.category,
      situpsCount: entry.situpsCount,
      situpsGrade,
      longJumpCm: entry.longJumpCm,
      longJumpGrade,
      enduranceMode: '5min_m',
      enduranceValue: entry.enduranceValue,
      enduranceGrade,
      overallGrade,
      captureMethod: 'manual',
      status: 'draft',
      recordedByUid: ownerUid,
      authorizedUids: [ownerUid],
    };
  });

  return { schoolConfig, students, assessments };
}
