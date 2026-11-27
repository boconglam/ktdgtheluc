import React, { useMemo, useState } from 'react';
import { Camera, Plus, Trash2, X, Lock, Unlock } from 'lucide-react';
import type {
  EnduranceMode,
  FitnessAssessment,
  SchoolAdminConfig,
  StudentProfile,
  UserAccount,
} from '../types/fitness';
import {
  calculateBmi,
  classifyBmi,
  evaluateEndurance,
  evaluateLongJump,
  evaluateOverallQd53,
  evaluateSitups,
  extractBmiConfigFromSchool,
  formatEnduranceDisplay,
  formatGenderLabel,
  formatGradeLabel,
  formatGradeLevelLabel,
  getThreshold,
} from '../utils/qd53Standards';
import { createSafeId } from '../services/storageService';
import { ProgressCharts } from './ProgressCharts';

interface Props {
  student: StudentProfile | null;
  assessments: FitnessAssessment[];
  schoolYear: string;
  schoolConfig?: SchoolAdminConfig;
  currentUid: string;
  account: UserAccount | null;
  canRecordTests: boolean;
  onClose: () => void;
  onSaveAssessment: (assessment: FitnessAssessment) => void;
  onDeleteAssessment: (assessmentId: string) => void;
  onToggleFinalize?: (assessmentId: string) => void;
  onLaunchCameraTest: (studentId: string) => void;
}

export const StudentDetailModal: React.FC<Props> = ({
  student,
  assessments,
  schoolYear,
  schoolConfig,
  currentUid,
  account,
  canRecordTests,
  onClose,
  onSaveAssessment,
  onDeleteAssessment,
  onToggleFinalize,
  onLaunchCameraTest,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [termLabel, setTermLabel] = useState('Giữa kỳ I');
  const [testedAt, setTestedAt] = useState(new Date().toISOString().slice(0, 10));
  const [heightCm, setHeightCm] = useState('165');
  const [weightKg, setWeightKg] = useState('55');
  const [situpsCount, setSitupsCount] = useState('18');
  const [longJumpCm, setLongJumpCm] = useState('190');
  const [enduranceMode, setEnduranceMode] = useState<EnduranceMode>('5min_m');
  const [enduranceValue, setEnduranceValue] = useState('950');

  const studentAssessments = useMemo(() => {
    if (!student) return [];
    return assessments
      .filter((a) => a.studentId === student.id)
      .sort((a, b) => b.testedAt.localeCompare(a.testedAt));
  }, [assessments, student]);

  if (!student) return null;

  const latest = studentAssessments[0];
  const isAdminOrSuper =
    account?.role === 'super_admin' || account?.role === 'admin' || !account;
  const bmiConfig = extractBmiConfigFromSchool(schoolConfig);
  const threshold = getThreshold(student.age, student.gender);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const h = Math.min(240, Math.max(60, Number(heightCm) || 165));
    const w = Math.min(200, Math.max(10, Number(weightKg) || 55));
    const s = Math.min(120, Math.max(0, Math.round(Number(situpsCount) || 0)));
    const j = Math.min(450, Math.max(0, Number(longJumpCm) || 0));
    const ev = Math.min(5000, Math.max(0, Number(enduranceValue) || 0));

    const bmi = calculateBmi(h, w);
    const bmiEval = classifyBmi(bmi, student.age, bmiConfig);
    const situpsGrade = evaluateSitups(s, student.age, student.gender);
    const longJumpGrade = evaluateLongJump(j, student.age, student.gender);
    const enduranceGrade = evaluateEndurance(ev, enduranceMode, student.age, student.gender);
    const overallGrade = evaluateOverallQd53(situpsGrade, longJumpGrade, enduranceGrade);

    onSaveAssessment({
      id: createSafeId('asm'),
      studentId: student.id,
      schoolId: student.schoolId,
      termLabel: termLabel.trim() || 'Định kỳ',
      schoolYear,
      testedAt,
      ageAtTest: student.age,
      gender: student.gender,
      heightCm: h,
      weightKg: w,
      bmi,
      bmiCategory: bmiEval.category,
      situpsCount: s,
      situpsGrade,
      longJumpCm: j,
      longJumpGrade,
      enduranceMode,
      enduranceValue: ev,
      enduranceGrade,
      overallGrade,
      captureMethod: 'manual',
      status: 'draft',
      recordedByUid: currentUid,
      authorizedUids: student.authorizedUids.length ? student.authorizedUids : [currentUid],
    });
    setShowAddForm(false);
  };

  const gradeTextClass = (g: 'tot' | 'dat' | 'chua_dat') =>
    g === 'tot' ? 'text-emerald-700 font-semibold' : g === 'dat' ? 'text-amber-700 font-semibold' : 'text-rose-700 font-semibold';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{student.fullName}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
              <span className="font-mono tabular-nums">{student.studentCode}</span>
              <span aria-hidden="true">·</span>
              <span>Lớp {student.className} ({formatGradeLevelLabel(student.gradeLevel)})</span>
              <span aria-hidden="true">·</span>
              <span>{formatGenderLabel(student.gender)}</span>
              <span aria-hidden="true">·</span>
              <span>{student.age} tuổi ({student.birthYear})</span>
              {latest && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className={gradeTextClass(latest.overallGrade)}>
                    Xếp loại gần nhất: {formatGradeLabel(latest.overallGrade)}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Đóng hồ sơ học sinh"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Action bar */}
          {canRecordTests && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLaunchCameraTest(student.id);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg min-h-[44px] whitespace-nowrap"
              >
                <Camera className="w-4 h-4" />
                Kiểm tra bằng Camera AI
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm((v) => !v)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg min-h-[44px] whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                {showAddForm ? 'Đóng biểu mẫu nhập tay' : 'Nhập kết quả thủ công'}
              </button>
            </div>
          )}

          {/* Manual Entry Form */}
          {showAddForm && (
            <form
              onSubmit={handleManualSubmit}
              className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4"
            >
              <div className="text-sm font-semibold text-slate-900">
                Ghi nhận đợt kiểm tra thể lực mới ({bmiConfig.countryLabel})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="block text-xs">
                  <span className="text-slate-600 font-medium">Đợt kiểm tra</span>
                  <input
                    type="text"
                    required
                    value={termLabel}
                    onChange={(e) => setTermLabel(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="VD: Cuối kỳ I"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-slate-600 font-medium">Ngày kiểm tra</span>
                  <input
                    type="date"
                    required
                    value={testedAt}
                    onChange={(e) => setTestedAt(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-slate-600 font-medium">Chiều cao (cm)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="60"
                    max="240"
                    required
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-slate-600 font-medium">Cân nặng (kg)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="10"
                    max="200"
                    required
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-slate-600 font-medium">Gập bụng (lần / 30s)</span>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    required
                    value={situpsCount}
                    onChange={(e) => setSitupsCount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-slate-600 font-medium">Bật xa tại chỗ (cm)</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="450"
                    required
                    value={longJumpCm}
                    onChange={(e) => setLongJumpCm(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-slate-600 font-medium">Hình thức chạy bền</span>
                  <select
                    value={enduranceMode}
                    onChange={(e) => setEnduranceMode(e.target.value as EnduranceMode)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="5min_m">Chạy tùy sức 5 phút (mét)</option>
                    <option value="distance_s">
                      Chạy {threshold.enduranceDistanceSec.distanceMeters}m (giây)
                    </option>
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="text-slate-600 font-medium">
                    {enduranceMode === '5min_m' ? 'Quãng đường (m)' : 'Thời gian (giây)'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="5000"
                    required
                    value={enduranceValue}
                    onChange={(e) => setEnduranceValue(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg min-h-[40px]"
                >
                  Lưu kết quả đánh giá
                </button>
              </div>
            </form>
          )}

          {/* Longitudinal Charts */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">
              Biểu đồ tiến trình sức khỏe &amp; thể lực qua thời gian
            </h4>
            <ProgressCharts student={student} assessments={studentAssessments} />
          </div>

          {/* Assessment History Table */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">
              Lịch sử các lần đo ({studentAssessments.length})
            </h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-3">Đợt / Ngày</th>
                    <th className="py-2.5 px-3">Cao / Nặng</th>
                    <th className="py-2.5 px-3">BMI</th>
                    <th className="py-2.5 px-3">Gập bụng</th>
                    <th className="py-2.5 px-3">Bật xa</th>
                    <th className="py-2.5 px-3">Chạy bền</th>
                    <th className="py-2.5 px-3">Xếp loại 53/2008</th>
                    <th className="py-2.5 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {studentAssessments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Học sinh chưa có kết quả kiểm tra nào. Hãy thực hiện đo bằng Camera AI hoặc nhập thủ công.
                      </td>
                    </tr>
                  ) : (
                    studentAssessments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-900">{a.termLabel}</div>
                          <div className="text-slate-500 font-mono tabular-nums">{a.testedAt}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">
                          {a.heightCm} cm · {a.weightKg} kg
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono tabular-nums font-semibold">{a.bmi}</span>
                          <div className="text-slate-500">{a.bmiCategory}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">
                          {a.situpsCount} lần
                          <div className={gradeTextClass(a.situpsGrade)}>
                            {formatGradeLabel(a.situpsGrade)}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">
                          {a.longJumpCm} cm
                          <div className={gradeTextClass(a.longJumpGrade)}>
                            {formatGradeLabel(a.longJumpGrade)}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">
                          {formatEnduranceDisplay(a.enduranceValue, a.enduranceMode, a.gender, a.ageAtTest)}
                          <div className={gradeTextClass(a.enduranceGrade)}>
                            {formatGradeLabel(a.enduranceGrade)}
                          </div>
                        </td>
                        <td className={`py-2.5 px-3 ${gradeTextClass(a.overallGrade)}`}>
                          {formatGradeLabel(a.overallGrade)}
                          <div className="text-[11px] font-normal text-slate-500">
                            {a.captureMethod === 'camera_ai' ? 'Camera AI' : 'Nhập tay'}
                            {a.status === 'finalized' ? ' · Đã khóa sổ' : ''}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            {onToggleFinalize && isAdminOrSuper && (
                              <button
                                type="button"
                                onClick={() => onToggleFinalize(a.id)}
                                title={a.status === 'finalized' ? 'Mở khóa bản ghi' : 'Chốt sổ bản ghi'}
                                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                              >
                                {a.status === 'finalized' ? (
                                  <Lock className="w-4 h-4 text-amber-700" />
                                ) : (
                                  <Unlock className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            {canRecordTests && (a.status !== 'finalized' || isAdminOrSuper) && (
                              <button
                                type="button"
                                onClick={() => onDeleteAssessment(a.id)}
                                title="Xóa lần đo"
                                className="p-2 text-slate-400 hover:text-rose-700 rounded-lg hover:bg-rose-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
