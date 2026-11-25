import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Gender, GradeLevel, StudentProfile } from '../types/fitness';
import { createSafeId } from '../services/storageService';

interface Props {
  open: boolean;
  onClose: () => void;
  schoolId: string;
  ownerUid: string;
  onSaveStudent: (student: StudentProfile) => void;
}

export const AddStudentModal: React.FC<Props> = ({
  open,
  onClose,
  schoolId,
  ownerUid,
  onSaveStudent,
}) => {
  const [studentCode, setStudentCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState('10A1');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>(10);
  const [gender, setGender] = useState<Gender>('nam');
  const [birthYear, setBirthYear] = useState(2011);
  const [age, setAge] = useState(15);
  const [notes, setNotes] = useState('');

  if (!open) return null;

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
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Thêm học sinh mới</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs sm:col-span-2">
              <span className="font-medium text-slate-700">Họ và tên học sinh *</span>
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
              <span className="font-medium text-slate-700">Mã học sinh</span>
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
              <span className="font-medium text-slate-700">Khối lớp</span>
              <select
                value={gradeLevel}
                onChange={(e) => {
                  const g = Number(e.target.value) as GradeLevel;
                  setGradeLevel(g);
                  const inferredAge = g === 10 ? 15 : g === 11 ? 16 : 17;
                  setAge(inferredAge);
                  setBirthYear(new Date().getFullYear() - inferredAge);
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[42px]"
              >
                <option value={10}>Khối 10</option>
                <option value={11}>Khối 11</option>
                <option value={12}>Khối 12</option>
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
                min="1995"
                max="2020"
                value={birthYear}
                onChange={(e) => {
                  const by = Number(e.target.value);
                  setBirthYear(by);
                  setAge(Math.min(20, Math.max(14, new Date().getFullYear() - by)));
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
              />
            </label>
            <label className="block text-xs">
              <span className="font-medium text-slate-700">Tuổi đánh giá (53/2008)</span>
              <input
                type="number"
                min="14"
                max="20"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
              />
            </label>
            <label className="block text-xs sm:col-span-2">
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
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg min-h-[44px]"
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
