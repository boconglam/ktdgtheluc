import * as XLSX from 'xlsx';
import type {
  FitnessAssessment,
  Gender,
  GradeLevel,
  SchoolAdminConfig,
  StudentProfile,
} from '../types/fitness';
import { formatEnduranceDisplay, formatGenderLabel, formatGradeLabel } from '../utils/qd53Standards';
import { createSafeId } from './storageService';

export interface ParsedExcelRow {
  rowIndex: number;
  studentCode: string;
  fullName: string;
  className: string;
  gradeLevel: GradeLevel;
  gender: Gender;
  birthYear: number;
  age: number;
  notes: string;
  valid: boolean;
  error?: string;
}

function normalizeHeader(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

function inferGradeFromClass(className: string): GradeLevel {
  if (className.startsWith('12')) return 12;
  if (className.startsWith('11')) return 11;
  return 10;
}

function parseGender(raw: string): Gender {
  const norm = normalizeHeader(raw);
  if (norm === 'nu' || norm === 'f' || norm === 'female' || norm === '0') return 'nu';
  return 'nam';
}

export function downloadExcelTemplate(): void {
  const rows = [
    {
      'STT': 1,
      'Mã học sinh': 'HS10A101',
      'Họ và tên': 'Nguyễn Minh Khôi',
      'Lớp': '10A1',
      'Khối': 10,
      'Giới tính (Nam/Nữ)': 'Nam',
      'Năm sinh': 2011,
      'Tuổi': 15,
      'Ghi chú sức khỏe': 'Bình thường',
    },
    {
      'STT': 2,
      'Mã học sinh': 'HS10A102',
      'Họ và tên': 'Trần Ngọc Thảo Vy',
      'Lớp': '10A1',
      'Khối': 10,
      'Giới tính (Nam/Nữ)': 'Nữ',
      'Năm sinh': 2011,
      'Tuổi': 15,
      'Ghi chú sức khỏe': '',
    },
    {
      'STT': 3,
      'Mã học sinh': 'HS11A201',
      'Họ và tên': 'Lê Hoàng Gia Bảo',
      'Lớp': '11A2',
      'Khối': 11,
      'Giới tính (Nam/Nữ)': 'Nam',
      'Năm sinh': 2010,
      'Tuổi': 16,
      'Ghi chú sức khỏe': '',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 24 },
    { wch: 10 },
    { wch: 8 },
    { wch: 20 },
    { wch: 10 },
    { wch: 8 },
    { wch: 24 },
  ];

  const guideRows = [
    { 'Cột dữ liệu': 'Mã học sinh', 'Quy định nhập': 'Mã định danh học sinh (hệ thống tự tạo nếu để trống)' },
    { 'Cột dữ liệu': 'Họ và tên', 'Quy định nhập': 'Bắt buộc nhập đầy đủ họ và tên học sinh' },
    { 'Cột dữ liệu': 'Lớp', 'Quy định nhập': 'Ví dụ: 10A1, 11A2, 12A3' },
    { 'Cột dữ liệu': 'Khối', 'Quy định nhập': 'Nhập số 10, 11 hoặc 12' },
    { 'Cột dữ liệu': 'Giới tính (Nam/Nữ)', 'Quy định nhập': 'Nhập "Nam" hoặc "Nữ" để áp dụng bảng chuẩn QĐ 53/2008' },
    { 'Cột dữ liệu': 'Năm sinh / Tuổi', 'Quy định nhập': 'Độ tuổi THPT từ 15 đến 18 tuổi' },
  ];
  const guideWs = XLSX.utils.json_to_sheet(guideRows);
  guideWs['!cols'] = [{ wch: 22 }, { wch: 64 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSachHocSinh');
  XLSX.utils.book_append_sheet(wb, guideWs, 'HuongDan');
  XLSX.writeFile(wb, 'Mau_Danh_Sach_Hoc_Sinh_THPT.xlsx');
}

export async function parseStudentsExcel(file: File): Promise<ParsedExcelRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error('Tệp Excel không có trang tính nào.');
  }
  const sheet = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (rawRows.length === 0) {
    throw new Error('Không tìm thấy dữ liệu học sinh trong tệp Excel.');
  }

  const currentYear = new Date().getFullYear();

  return rawRows.map((row, idx) => {
    const mapped: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      mapped[normalizeHeader(k)] = String(v ?? '').trim();
    }

    const fullName =
      mapped.hovaten || mapped.hoten || mapped.tenhocsinh || mapped.ten || mapped.fullname || '';
    const studentCode =
      mapped.mahocsinh || mapped.mahs || mapped.masinhvien || mapped.ma || `HS${idx + 1}`;
    const className = mapped.lop || mapped.tenlop || mapped.class || '10A1';
    const rawGrade = Number(mapped.khoi || mapped.grade || 0);
    const gradeLevel: GradeLevel =
      rawGrade === 10 || rawGrade === 11 || rawGrade === 12
        ? (rawGrade as GradeLevel)
        : inferGradeFromClass(className);
    const gender = parseGender(mapped.gioitinhnamnu || mapped.gioitinh || mapped.phai || mapped.gender || 'Nam');
    const rawBirthYear = Number(mapped.namsinh || mapped.birthyear || 0);
    const rawAge = Number(mapped.tuoi || mapped.age || 0);

    const age =
      rawAge >= 14 && rawAge <= 20
        ? Math.round(rawAge)
        : rawBirthYear >= 1995 && rawBirthYear <= 2020
          ? Math.min(20, Math.max(14, currentYear - rawBirthYear))
          : gradeLevel + 5;
    const birthYear =
      rawBirthYear >= 1995 && rawBirthYear <= 2020 ? Math.round(rawBirthYear) : currentYear - age;
    const notes = mapped.ghichusuckhoe || mapped.ghichu || mapped.notes || '';

    const valid = fullName.length >= 2 && className.length >= 1;
    return {
      rowIndex: idx + 2,
      studentCode,
      fullName,
      className,
      gradeLevel,
      gender,
      birthYear,
      age,
      notes,
      valid,
      error: valid ? undefined : 'Thiếu họ tên hoặc tên lớp',
    };
  });
}

export function convertExcelRowsToStudents(
  rows: ParsedExcelRow[],
  schoolId: string,
  ownerUid: string
): StudentProfile[] {
  return rows
    .filter((r) => r.valid)
    .map((r) => ({
      id: createSafeId('stu'),
      schoolId,
      studentCode: r.studentCode,
      fullName: r.fullName,
      className: r.className,
      gradeLevel: r.gradeLevel,
      gender: r.gender,
      birthYear: r.birthYear,
      age: r.age,
      notes: r.notes,
      ownerUid,
      authorizedUids: [ownerUid],
    }));
}

export function exportResultsExcel(params: {
  students: StudentProfile[];
  assessments: FitnessAssessment[];
  schoolConfig: SchoolAdminConfig;
}): void {
  const latestMap = new Map<string, FitnessAssessment>();
  for (const a of params.assessments) {
    const existing = latestMap.get(a.studentId);
    if (!existing || a.testedAt >= existing.testedAt) {
      latestMap.set(a.studentId, a);
    }
  }

  const rows = params.students.map((s, idx) => {
    const a = latestMap.get(s.id);
    return {
      'STT': idx + 1,
      'Mã HS': s.studentCode,
      'Họ và tên': s.fullName,
      'Lớp': s.className,
      'Khối': s.gradeLevel,
      'Giới tính': formatGenderLabel(s.gender),
      'Tuổi': a ? a.ageAtTest : s.age,
      'Đợt kiểm tra': a ? a.termLabel : 'Chưa kiểm tra',
      'Ngày đo': a ? a.testedAt : '',
      'Chiều cao (cm)': a ? a.heightCm : '',
      'Cân nặng (kg)': a ? a.weightKg : '',
      'BMI': a ? a.bmi : '',
      'Phân loại BMI': a ? a.bmiCategory : '',
      'Gập bụng (lần/30s)': a ? a.situpsCount : '',
      'XL Gập bụng': a ? formatGradeLabel(a.situpsGrade) : '',
      'Bật xa (cm)': a ? a.longJumpCm : '',
      'XL Bật xa': a ? formatGradeLabel(a.longJumpGrade) : '',
      'Chạy bền': a ? formatEnduranceDisplay(a.enduranceValue, a.enduranceMode, s.gender) : '',
      'XL Chạy bền': a ? formatGradeLabel(a.enduranceGrade) : '',
      'Xếp loại chung (53/2008)': a ? formatGradeLabel(a.overallGrade) : 'Chưa có',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'KetQuaTheLuc');
  const safeYear = (params.schoolConfig.schoolYear || 'THPT').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `KetQua_TheLuc_53_2008_${safeYear}.xlsx`);
}
