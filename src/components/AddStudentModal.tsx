import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Gender, GradeLevel, SchoolLevel, StudentProfile } from '../types/fitness';
import { createSafeId } from '../services/storageService';
import { SCHOOL_LEVEL_OPTIONS, getGradeOptionsForLevel } from '../utils/qd53Standards';

interface Props {
  open: boolean;
  onClose: () => void;
  schoolId: string;
  schoolLevel?: SchoolLevel;
  ownerUid: string;
  onSaveStudent: (student: StudentProfile) => void;
}

export const AddStudentModal: React.FC<Props> = ({
  open,
  onClose,
  schoolId,
  schoolLevel = 'thpt',
  ownerUid,
  onSaveStudent,
}) => {
  const [modalLevel, setModalLevel] = useState<SchoolLevel>(schoolLevel);
  const [studentCode, setStudentCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState('10A1');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>(10);
  const [gender, setGender] = useState<Gender>('nam');
  const [birthYear, setBirthYear] = useState(2011);
  const [age, setAge] = useState(15);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setModalLevel(schoolLevel);
    const opts = getGradeOptionsForLevel(schoolLevel);
    const first = opts[0] ?? { value: 10, defaultAge: 15 };
    setGradeLevel(first.value);
    setAge(first.defaultAge);
    setBirthYear(new Date().getFullYear() - first.defaultAge);
    setClassName(first.value >= 13 ? `K${first.value - 12}-A1` : `${first.value}A1`);
  }, [open, schoolLevel]);

  if (!open) return null;

  const gradeOptions = getGradeOptionsForLevel(modalLevel);

  const handleLevelChange = (nextLevel: SchoolLevel) => {
    setModalLevel(nextLevel);
    const opts = getGradeOptionsForLevel(nextLevel);
    if (!opts.some((o) => o.value === gradeLevel) && opts[0]) {
      setGradeLevel(opts[0].value);
      setAge(opts[0].defaultAge);
      setBirthYear(new Date().getFullYear() - opts[0].defaultAge);
      setClassName(opts[0].value >= 13 ? `K${opts[0].value - 12}-A1` : `${opts[0].value}A1`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !className.trim()) return;
    onSaveStudent({
      id: createSafeId('stu'),
      schoolId,
      studentCode: studentCode.trim() || `HS${Date.now().toString().slice(-5)}`,
      fullName: fullName.trim(),
      className: className.trim(),
      gradeLevel,
      gender,
      birthYear,
      age,
      notes: notes.trim(),
      ownerUid,
      authorizedUids: [ownerUid],
    });
    setStudentCode('');
    setFullName('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-xl">
        <div className="shrink-0 px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">Thêm học sinh / sinh viên mới</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Đóng cửa sổ thêm học sinh"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs col-span-2">
                <span className="font-medium text-slate-700">Cấp học (QĐ 53/2008)</span>
                <select
                  value={modalLevel}
                  onChange={(e) => handleLevelChange(e.target.value as SchoolLevel)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[42px]"
                >
                  {SCHOOL_LEVEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs col-span-2">
                <span className="font-medium text-slate-700">Họ và tên *</span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="VD: Nguyễn Văn An"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
                />
              </label>
              <label className="block text-xs">
                <span className="font-medium text-slate-700">Mã học sinh / SV</span>
                <input
                  type="text"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  placeholder="VD: HS10A101"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
                />
              </label>
              <label className="block text-xs">
                <span className="font-medium text-slate-700">Lớp *</span>
                <input
                  type="text"
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
                />
              </label>
              <label className="block text-xs">
                <span className="font-medium text-slate-700">Khối / Năm học</span>
                <select
                  value={gradeLevel}
                  onChange={(e) => {
                    const g = Number(e.target.value);
                    setGradeLevel(g);
                    const found = gradeOptions.find((o) => o.value === g);
                    const inferredAge = found?.defaultAge ?? (g >= 13 ? g + 6 : g + 5);
                    setAge(inferredAge);
                    setBirthYear(new Date().getFullYear() - inferredAge);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[42px]"
                >
                  {gradeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                <span className="font-medium text-slate-700">Giới tính</span>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[42px]"
                >
                  <option value="nam">Nam</option>
                  <option value="nu">Nữ</option>
                </select>
              </label>
              <label className="block text-xs">
                <span className="font-medium text-slate-700">Năm sinh</span>
                <input
                  type="number"
                  min="1985"
                  max="2025"
                  value={birthYear}
                  onChange={(e) => {
                    const by = Number(e.target.value);
                    setBirthYear(by);
                    setAge(Math.min(35, Math.max(5, new Date().getFullYear() - by)));
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
                />
              </label>
              <label className="block text-xs">
                <span className="font-medium text-slate-700">Tuổi đánh giá (53/2008)</span>
                <input
                  type="number"
                  min="5"
                  max="35"
                  value={age}
                  onChange={(e) => setAge(Math.min(35, Math.max(5, Number(e.target.value) || 15)))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
                />
              </label>
              <label className="block text-xs col-span-2">
                <span className="font-medium text-slate-700">Ghi chú sức khỏe</span>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="VD: Miễn chạy bền nếu có bệnh lý tim mạch..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
                />
              </label>
            </div>
          </div>
          <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/70 rounded-lg min-h-[44px]"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg min-h-[44px]"
            >
              Thêm học sinh
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
