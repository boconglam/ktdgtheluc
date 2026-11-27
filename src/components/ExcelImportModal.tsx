import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  convertExcelRowsToStudents,
  downloadExcelTemplate,
  parseStudentsExcel,
  type ParsedExcelRow,
} from '../services/excelService';
import type { StudentProfile } from '../types/fitness';
import { formatGenderLabel, formatGradeLevelLabel } from '../utils/qd53Standards';

interface Props {
  open: boolean;
  onClose: () => void;
  schoolId: string;
  ownerUid: string;
  onImportStudents: (students: StudentProfile[]) => void;
}

export const ExcelImportModal: React.FC<Props> = ({
  open,
  onClose,
  schoolId,
  ownerUid,
  onImportStudents,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<ParsedExcelRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setFileName(file.name);
    try {
      const parsed = await parseStudentsExcel(file);
      setRows(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đọc tệp Excel.');
      setRows([]);
    }
  };

  const validCount = rows.filter((r) => r.valid).length;

  const handleConfirmImport = () => {
    const students = convertExcelRowsToStudents(rows, schoolId, ownerUid);
    if (students.length === 0) return;
    onImportStudents(students);
    setRows([]);
    setFileName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Nhập danh sách học sinh từ tệp Excel
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Hỗ trợ định dạng .xlsx, .xls, .csv · Tự động nhận diện cột Họ tên, Lớp, Khối, Giới tính, Tuổi
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Đóng cửa sổ nhập Excel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-600">
              Chưa có mẫu danh sách? Tải tệp Excel chuẩn cột để nhập nhanh.
            </div>
            <button
              type="button"
              onClick={downloadExcelTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-teal-800 bg-white border border-teal-300 rounded-lg hover:bg-teal-50 transition-colors min-h-[40px] whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              Tải tệp Excel mẫu (.xlsx)
            </button>
          </div>

          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-teal-600 rounded-xl p-6 text-center cursor-pointer transition-colors"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <FileSpreadsheet className="w-8 h-8 text-teal-700 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-900">
              {fileName ? `Đã chọn: ${fileName}` : 'Chạm hoặc nhấp để chọn tệp Excel danh sách học sinh'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Các cột đề xuất: Mã học sinh, Họ và tên, Lớp, Khối, Giới tính, Năm sinh, Tuổi
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>
                  Xem trước: <strong className="text-slate-900">{validCount}</strong>/{rows.length} dòng hợp lệ
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-2 px-3">Dòng</th>
                      <th className="py-2 px-3">Mã HS</th>
                      <th className="py-2 px-3">Họ và tên</th>
                      <th className="py-2 px-3">Lớp / Khối</th>
                      <th className="py-2 px-3">Giới tính / Tuổi</th>
                      <th className="py-2 px-3">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {rows.map((r) => (
                      <tr key={r.rowIndex} className={r.valid ? '' : 'bg-rose-50/50'}>
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-500">{r.rowIndex}</td>
                        <td className="py-2 px-3 font-mono tabular-nums">{r.studentCode}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{r.fullName || '—'}</td>
                        <td className="py-2 px-3">
                          {r.className} ({formatGradeLevelLabel(r.gradeLevel)})
                        </td>
                        <td className="py-2 px-3">
                          {formatGenderLabel(r.gender)} · {r.age} tuổi
                        </td>
                        <td className="py-2 px-3">
                          {r.valid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Hợp lệ
                            </span>
                          ) : (
                            <span className="text-rose-700 font-medium">{r.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-end gap-3 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/70 rounded-lg min-h-[44px]"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={validCount === 0}
            onClick={handleConfirmImport}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg min-h-[44px]"
          >
            <Upload className="w-4 h-4" />
            Nhập {validCount} học sinh
          </button>
        </div>
      </div>
    </div>
  );
};
