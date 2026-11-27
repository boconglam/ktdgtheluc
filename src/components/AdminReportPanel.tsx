import React, { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
import type {
  BmiStandardPreset,
  FitnessAssessment,
  SchoolAdminConfig,
  SchoolLevel,
  StudentProfile,
} from '../types/fitness';
import { buildAdministrativeHtml, exportAdministrativePdf } from '../services/pdfReportService';
import { exportResultsExcel } from '../services/excelService';
import {
  SCHOOL_LEVEL_OPTIONS,
  formatGradeLevelLabel,
  getDefaultBmiStandard,
  getGradeOptionsForLevel,
} from '../utils/qd53Standards';

interface Props {
  schoolConfig: SchoolAdminConfig;
  onUpdateSchoolConfig: (next: SchoolAdminConfig) => void;
  students: StudentProfile[];
  assessments: FitnessAssessment[];
  canExportPdf: boolean;
}

export const AdminReportPanel: React.FC<Props> = ({
  schoolConfig,
  onUpdateSchoolConfig,
  students,
  assessments,
  canExportPdf,
}) => {
  const [scopeType, setScopeType] = useState<'all' | 'grade' | 'class'>('all');
  const [selectedGrade, setSelectedGrade] = useState<number>(10);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('all');
  const [reportTitle, setReportTitle] = useState(
    'BÁO CÁO KẾT QUẢ KIỂM TRA, ĐÁNH GIÁ THỂ LỰC HỌC SINH'
  );
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [exporting, setExporting] = useState(false);

  const gradeOptions = useMemo(
    () => getGradeOptionsForLevel(schoolConfig.schoolLevel || 'tat_ca'),
    [schoolConfig.schoolLevel]
  );

  const uniqueClasses = useMemo(
    () => Array.from(new Set(students.map((s) => s.className))).sort(),
    [students]
  );

  const uniqueTerms = useMemo(
    () => Array.from(new Set(assessments.map((a) => a.termLabel))).filter(Boolean),
    [assessments]
  );

  const filteredStudents = useMemo(() => {
    if (scopeType === 'grade') {
      return students.filter((s) => s.gradeLevel === selectedGrade);
    }
    if (scopeType === 'class' && selectedClass) {
      return students.filter((s) => s.className === selectedClass);
    }
    return students;
  }, [students, scopeType, selectedGrade, selectedClass]);

  const filteredAssessments = useMemo(() => {
    const ids = new Set(filteredStudents.map((s) => s.id));
    return assessments.filter((a) => {
      if (!ids.has(a.studentId)) return false;
      if (selectedTerm !== 'all' && a.termLabel !== selectedTerm) return false;
      return true;
    });
  }, [assessments, filteredStudents, selectedTerm]);

  const scopeLabel =
    scopeType === 'grade'
      ? formatGradeLevelLabel(selectedGrade)
      : scopeType === 'class' && selectedClass
        ? `Lớp ${selectedClass}`
        : 'Toàn đơn vị';

  const termLabel = selectedTerm === 'all' ? 'Tổng hợp gần nhất' : selectedTerm;

  const previewHtml = useMemo(
    () =>
      buildAdministrativeHtml({
        schoolConfig,
        reportTitle,
        scopeLabel,
        termLabel,
        reportDate,
        students: filteredStudents,
        assessments: filteredAssessments,
      }),
    [
      schoolConfig,
      reportTitle,
      scopeLabel,
      termLabel,
      reportDate,
      filteredStudents,
      filteredAssessments,
    ]
  );

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await exportAdministrativePdf({
        schoolConfig,
        reportTitle,
        scopeLabel,
        termLabel,
        reportDate,
        students: filteredStudents,
        assessments: filteredAssessments,
      });
    } finally {
      setExporting(false);
    }
  };

  const updateField = (key: keyof SchoolAdminConfig, value: string) => {
    onUpdateSchoolConfig({ ...schoolConfig, [key]: value });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Left: Administrative Fields & Filters */}
      <div className="xl:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Thông tin thể thức hành chính &amp; Xuất báo cáo
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Nhập thủ công thông tin đơn vị chủ quản, cơ sở giáo dục, năm học, cấp học QĐ 53/2008, chức vụ và người lập báo cáo.
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="font-medium text-slate-700">Cấp học (QĐ 53/2008)</span>
              <select
                value={schoolConfig.schoolLevel || 'thpt'}
                onChange={(e) => {
                  const nextLevel = e.target.value as SchoolLevel;
                  const firstGrade = getGradeOptionsForLevel(nextLevel)[0]?.value ?? 10;
                  setSelectedGrade(firstGrade);
                  onUpdateSchoolConfig({ ...schoolConfig, schoolLevel: nextLevel });
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[42px]"
              >
                {SCHOOL_LEVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.shortLabel} ({opt.ageRangeLabel})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs">
              <span className="font-medium text-slate-700">Chuẩn phân loại BMI</span>
              <select
                value={schoolConfig.bmiPreset || 'vn_wpro'}
                onChange={(e) => {
                  const preset = e.target.value as BmiStandardPreset;
                  const std = getDefaultBmiStandard(preset);
                  onUpdateSchoolConfig({
                    ...schoolConfig,
                    bmiPreset: std.preset,
                    bmiCountryLabel: std.countryLabel,
                    bmiUnderweightMax: std.underweightMax,
                    bmiNormalMax: std.normalMax,
                    bmiOverweightMax: std.overweightMax,
                    bmiObese1Max: std.obese1Max,
                    bmiAgeAdjust: std.ageAdjustUnder18,
                  });
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[42px]"
              >
                <option value="vn_wpro">Việt Nam / Châu Á (IDI &amp; WPRO)</option>
                <option value="who_global">WHO Quốc tế (Châu Âu)</option>
                <option value="custom">Tùy chỉnh ({schoolConfig.bmiCountryLabel || 'Quốc gia khác'})</option>
              </select>
            </label>
          </div>

          <label className="block text-xs">
            <span className="font-medium text-slate-700">Tên cơ quan / cơ sở chủ quản</span>
            <input
              type="text"
              value={schoolConfig.managingAuthority}
              onChange={(e) => updateField('managingAuthority', e.target.value)}
              placeholder="VD: SỞ GIÁO DỤC VÀ ĐÀO TẠO ..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
            />
          </label>

          <label className="block text-xs">
            <span className="font-medium text-slate-700">Tên cơ sở giáo dục</span>
            <input
              type="text"
              value={schoolConfig.schoolName}
              onChange={(e) => updateField('schoolName', e.target.value)}
              placeholder="VD: TRƯỜNG TIỂU HỌC / THCS / THPT / ĐẠI HỌC ..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="font-medium text-slate-700">Năm học</span>
              <input
                type="text"
                value={schoolConfig.schoolYear}
                onChange={(e) => updateField('schoolYear', e.target.value)}
                placeholder="VD: 2025 - 2026"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
              />
            </label>
            <label className="block text-xs">
              <span className="font-medium text-slate-700">Số / Ký hiệu văn bản</span>
              <input
                type="text"
                value={schoolConfig.documentCode}
                onChange={(e) => updateField('documentCode', e.target.value)}
                placeholder="VD: Số: .../BC-GDTC"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="font-medium text-slate-700">Địa danh lập báo cáo</span>
              <input
                type="text"
                value={schoolConfig.locationName}
                onChange={(e) => updateField('locationName', e.target.value)}
                placeholder="VD: Hà Nội"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
              />
            </label>
            <label className="block text-xs">
              <span className="font-medium text-slate-700">Ngày lập báo cáo</span>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
              />
            </label>
          </div>

          <label className="block text-xs">
            <span className="font-medium text-slate-700">Tiêu đề báo cáo</span>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
            <label className="block text-xs">
              <span className="font-medium text-slate-700">Chức vụ ký duyệt (mặc định Thủ trưởng đơn vị)</span>
              <input
                type="text"
                value={schoolConfig.signerTitle}
                onChange={(e) => updateField('signerTitle', e.target.value)}
                placeholder="THỦ TRƯỞNG ĐƠN VỊ"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
              />
            </label>
            <label className="block text-xs">
              <span className="font-medium text-slate-700">Họ tên người ký duyệt</span>
              <input
                type="text"
                value={schoolConfig.signerName}
                onChange={(e) => updateField('signerName', e.target.value)}
                placeholder="Có thể để trống để ký tay"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
              />
            </label>
          </div>

          <label className="block text-xs">
            <span className="font-medium text-slate-700">Tên người lập báo cáo (nhập thủ công)</span>
            <input
              type="text"
              value={schoolConfig.preparerName}
              onChange={(e) => updateField('preparerName', e.target.value)}
              placeholder="Nhập họ và tên người lập báo cáo"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
            />
          </label>

          {/* Scope Filters */}
          <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="font-medium text-slate-700">Phạm vi báo cáo</span>
              <select
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value as 'all' | 'grade' | 'class')}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[42px]"
              >
                <option value="all">Toàn đơn vị ({students.length} HS/SV)</option>
                <option value="grade">Theo Khối / Năm</option>
                <option value="class">Theo Lớp cụ thể</option>
              </select>
            </label>

            {scopeType === 'grade' && (
              <label className="block text-xs">
                <span className="font-medium text-slate-700">Chọn khối / năm</span>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[42px]"
                >
                  {gradeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {scopeType === 'class' && (
              <label className="block text-xs">
                <span className="font-medium text-slate-700">Chọn lớp</span>
                <select
                  value={selectedClass || uniqueClasses[0] || ''}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[42px]"
                >
                  {uniqueClasses.map((c) => (
                    <option key={c} value={c}>
                      Lớp {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block text-xs">
              <span className="font-medium text-slate-700">Đợt kiểm tra</span>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[42px]"
              >
                <option value="all">Mới nhất của từng học sinh</option>
                {uniqueTerms.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            disabled={!canExportPdf || exporting}
            onClick={() => void handleExportPdf()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 rounded-xl min-h-[44px] whitespace-nowrap"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {exporting ? 'Đang tạo PDF...' : 'Xuất báo cáo PDF'}
          </button>

          <button
            type="button"
            disabled={!canExportPdf}
            onClick={() =>
              exportResultsExcel({
                students: filteredStudents,
                assessments: filteredAssessments,
                schoolConfig,
              })
            }
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl min-h-[44px] whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Right: Live A4 Administrative Document Preview */}
      <div className="xl:col-span-7 bg-slate-100 border border-slate-200 rounded-2xl p-4 overflow-x-auto">
        <div className="text-xs font-medium text-slate-600 mb-3 flex items-center justify-between">
          <span>Xem trước bản in hành chính khổ A4</span>
          <span className="font-mono tabular-nums">{filteredStudents.length} học sinh</span>
        </div>
        <div className="bg-white shadow-sm border border-slate-300 mx-auto w-fit origin-top">
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      </div>
    </div>
  );
};
