import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import type { FitnessAssessment, SchoolAdminConfig, StudentProfile } from '../types/fitness';
import { formatEnduranceDisplay, formatGenderLabel, formatGradeLabel } from '../utils/qd53Standards';

export interface ReportExportPayload {
  schoolConfig: SchoolAdminConfig;
  reportTitle: string;
  scopeLabel: string;
  termLabel: string;
  reportDate: string; // YYYY-MM-DD
  students: StudentProfile[];
  assessments: FitnessAssessment[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatVietnameseDateParts(isoDate: string): { day: string; month: string; year: string } {
  const d = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return {
      day: String(now.getDate()).padStart(2, '0'),
      month: String(now.getMonth() + 1).padStart(2, '0'),
      year: String(now.getFullYear()),
    };
  }
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: String(d.getMonth() + 1).padStart(2, '0'),
    year: String(d.getFullYear()),
  };
}

export function buildReportSummary(students: StudentProfile[], assessments: FitnessAssessment[]) {
  const latestByStudent = new Map<string, FitnessAssessment>();
  for (const a of assessments) {
    const prev = latestByStudent.get(a.studentId);
    if (!prev || a.testedAt >= prev.testedAt) {
      latestByStudent.set(a.studentId, a);
    }
  }

  let tot = 0;
  let dat = 0;
  let chuaDat = 0;
  let tested = 0;
  let bmiSum = 0;

  const rows = students.map((s, index) => {
    const a = latestByStudent.get(s.id) ?? null;
    if (a) {
      tested += 1;
      bmiSum += a.bmi;
      if (a.overallGrade === 'tot') tot += 1;
      else if (a.overallGrade === 'dat') dat += 1;
      else chuaDat += 1;
    }
    return { index: index + 1, student: s, assessment: a };
  });

  const avgBmi = tested > 0 ? Math.round((bmiSum / tested) * 10) / 10 : 0;
  return {
    rows,
    totalStudents: students.length,
    testedCount: tested,
    totCount: tot,
    datCount: dat,
    chuaDatCount: chuaDat,
    avgBmi,
    passRate: tested > 0 ? Math.round(((tot + dat) / tested) * 1000) / 10 : 0,
  };
}

/**
 * Tạo HTML thể thức văn bản hành chính Việt Nam (Nghị định 30/2020/NĐ-CP)
 */
export function buildAdministrativeHtml(payload: ReportExportPayload): string {
  const summary = buildReportSummary(payload.students, payload.assessments);
  const { day, month, year } = formatVietnameseDateParts(payload.reportDate);
  const authority = escapeHtml(payload.schoolConfig.managingAuthority || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO ...');
  const school = escapeHtml(payload.schoolConfig.schoolName || 'TRƯỜNG THPT ...');
  const docCode = escapeHtml(payload.schoolConfig.documentCode || 'Số: .../BC-TLHS');
  const location = escapeHtml(payload.schoolConfig.locationName || 'Địa danh');
  const schoolYear = escapeHtml(payload.schoolConfig.schoolYear || '2025 - 2026');
  const signerTitle = escapeHtml(payload.schoolConfig.signerTitle || 'THỦ TRƯỞNG ĐƠN VỊ');
  const signerName = escapeHtml(payload.schoolConfig.signerName || '');
  const preparerName = escapeHtml(payload.schoolConfig.preparerName || '');

  const tableRowsHtml = summary.rows
    .map(({ index, student, assessment }) => {
      const gradeText = assessment ? formatGradeLabel(assessment.overallGrade) : 'Chưa đo';
      const gradeColor =
        assessment?.overallGrade === 'tot'
          ? '#15803d'
          : assessment?.overallGrade === 'dat'
            ? '#b45309'
            : assessment?.overallGrade === 'chua_dat'
              ? '#b91c1c'
              : '#475569';
      return `
        <tr>
          <td style="border:1px solid #334155;padding:5px 4px;text-align:center;">${index}</td>
          <td style="border:1px solid #334155;padding:5px 6px;">${escapeHtml(student.studentCode)}</td>
          <td style="border:1px solid #334155;padding:5px 6px;font-weight:600;">${escapeHtml(student.fullName)}</td>
          <td style="border:1px solid #334155;padding:5px 4px;text-align:center;">${escapeHtml(student.className)}</td>
          <td style="border:1px solid #334155;padding:5px 4px;text-align:center;">${formatGenderLabel(student.gender)} / ${assessment ? assessment.ageAtTest : student.age}</td>
          <td style="border:1px solid #334155;padding:5px 4px;text-align:center;">${assessment ? `${assessment.heightCm} / ${assessment.weightKg}` : '—'}</td>
          <td style="border:1px solid #334155;padding:5px 4px;text-align:center;">${assessment ? `${assessment.bmi} (${escapeHtml(assessment.bmiCategory)})` : '—'}</td>
          <td style="border:1px solid #334155;padding:5px 4px;text-align:center;">${assessment ? `${assessment.situpsCount} (${formatGradeLabel(assessment.situpsGrade)})` : '—'}</td>
          <td style="border:1px solid #334155;padding:5px 4px;text-align:center;">${assessment ? `${assessment.longJumpCm}cm (${formatGradeLabel(assessment.longJumpGrade)})` : '—'}</td>
          <td style="border:1px solid #334155;padding:5px 4px;text-align:center;">${assessment ? `${formatEnduranceDisplay(assessment.enduranceValue, assessment.enduranceMode, student.gender)} (${formatGradeLabel(assessment.enduranceGrade)})` : '—'}</td>
          <td style="border:1px solid #334155;padding:5px 4px;text-align:center;font-weight:700;color:${gradeColor};">${gradeText}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="width:794px;background:#ffffff;color:#0f172a;font-family:'Times New Roman',Georgia,serif;padding:42px 48px;box-sizing:border-box;line-height:1.45;font-size:13px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
        <tr>
          <td style="width:46%;vertical-align:top;text-align:center;padding-right:10px;">
            <div style="font-size:12px;text-transform:uppercase;">${authority}</div>
            <div style="font-size:13px;font-weight:700;text-transform:uppercase;margin-top:2px;">${school}</div>
            <div style="width:110px;height:1px;background:#0f172a;margin:4px auto 6px;"></div>
            <div style="font-size:12px;">${docCode}</div>
          </td>
          <td style="width:54%;vertical-align:top;text-align:center;padding-left:10px;">
            <div style="font-size:12.5px;font-weight:700;text-transform:uppercase;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div style="font-size:13px;font-weight:700;margin-top:2px;">Độc lập - Tự do - Hạnh phúc</div>
            <div style="width:155px;height:1px;background:#0f172a;margin:4px auto 8px;"></div>
            <div style="font-size:12.5px;font-style:italic;">${location}, ngày ${day} tháng ${month} năm ${year}</div>
          </td>
        </tr>
      </table>

      <div style="text-align:center;margin:18px 0 16px;">
        <div style="font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">${escapeHtml(payload.reportTitle)}</div>
        <div style="font-size:12.5px;font-weight:700;margin-top:4px;">Theo Quyết định số 53/2008/QĐ-BGDĐT ngày 17/09/2008 của Bộ Giáo dục và Đào tạo</div>
        <div style="font-size:12.5px;margin-top:3px;">Năm học: <strong>${schoolYear}</strong> &nbsp;|&nbsp; Đợt kiểm tra: <strong>${escapeHtml(payload.termLabel)}</strong> &nbsp;|&nbsp; Phạm vi: <strong>${escapeHtml(payload.scopeLabel)}</strong></div>
      </div>

      <div style="margin-bottom:14px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:6px;">I. TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ CHUNG</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <tr style="background:#f1f5f9;">
            <th style="border:1px solid #334155;padding:6px;">Tổng số HS</th>
            <th style="border:1px solid #334155;padding:6px;">Đã kiểm tra</th>
            <th style="border:1px solid #334155;padding:6px;">Xếp loại Tốt</th>
            <th style="border:1px solid #334155;padding:6px;">Xếp loại Đạt</th>
            <th style="border:1px solid #334155;padding:6px;">Chưa đạt</th>
            <th style="border:1px solid #334155;padding:6px;">Tỷ lệ Đạt trở lên</th>
            <th style="border:1px solid #334155;padding:6px;">BMI trung bình</th>
          </tr>
          <tr>
            <td style="border:1px solid #334155;padding:6px;text-align:center;font-weight:700;">${summary.totalStudents}</td>
            <td style="border:1px solid #334155;padding:6px;text-align:center;">${summary.testedCount}</td>
            <td style="border:1px solid #334155;padding:6px;text-align:center;color:#15803d;font-weight:700;">${summary.totCount} (${summary.testedCount ? Math.round((summary.totCount / summary.testedCount) * 1000) / 10 : 0}%)</td>
            <td style="border:1px solid #334155;padding:6px;text-align:center;color:#b45309;font-weight:700;">${summary.datCount} (${summary.testedCount ? Math.round((summary.datCount / summary.testedCount) * 1000) / 10 : 0}%)</td>
            <td style="border:1px solid #334155;padding:6px;text-align:center;color:#b91c1c;font-weight:700;">${summary.chuaDatCount} (${summary.testedCount ? Math.round((summary.chuaDatCount / summary.testedCount) * 1000) / 10 : 0}%)</td>
            <td style="border:1px solid #334155;padding:6px;text-align:center;font-weight:700;">${summary.passRate}%</td>
            <td style="border:1px solid #334155;padding:6px;text-align:center;">${summary.avgBmi || '—'}</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:6px;">II. CHI TIẾT CHỈ SỐ THỂ LỰC VÀ SỨC KHỎE HỌC SINH</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="border:1px solid #334155;padding:5px 4px;">STT</th>
              <th style="border:1px solid #334155;padding:5px 6px;">Mã HS</th>
              <th style="border:1px solid #334155;padding:5px 6px;text-align:left;">Họ và tên</th>
              <th style="border:1px solid #334155;padding:5px 4px;">Lớp</th>
              <th style="border:1px solid #334155;padding:5px 4px;">GT / Tuổi</th>
              <th style="border:1px solid #334155;padding:5px 4px;">Cao/Nặng</th>
              <th style="border:1px solid #334155;padding:5px 4px;">BMI</th>
              <th style="border:1px solid #334155;padding:5px 4px;">Gập bụng</th>
              <th style="border:1px solid #334155;padding:5px 4px;">Bật xa</th>
              <th style="border:1px solid #334155;padding:5px 4px;">Chạy bền</th>
              <th style="border:1px solid #334155;padding:5px 4px;">Xếp loại</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml || '<tr><td colspan="11" style="border:1px solid #334155;padding:10px;text-align:center;">Chưa có dữ liệu học sinh trong phạm vi lọc.</td></tr>'}
          </tbody>
        </table>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:22px;page-break-inside:avoid;">
        <tr>
          <td style="width:50%;vertical-align:top;text-align:center;">
            <div style="font-weight:700;text-transform:uppercase;">NGƯỜI LẬP BÁO CÁO</div>
            <div style="font-size:11.5px;font-style:italic;margin-top:2px;">(Ký, ghi rõ họ tên)</div>
            <div style="height:64px;"></div>
            <div style="font-weight:700;">${preparerName || '........................................'}</div>
          </td>
          <td style="width:50%;vertical-align:top;text-align:center;">
            <div style="font-weight:700;text-transform:uppercase;">${signerTitle}</div>
            <div style="font-size:11.5px;font-style:italic;margin-top:2px;">(Ký tên, đóng dấu)</div>
            <div style="height:64px;"></div>
            <div style="font-weight:700;">${signerName || '........................................'}</div>
          </td>
        </tr>
      </table>
    </div>
  `;
}

export async function exportAdministrativePdf(payload: ReportExportPayload): Promise<void> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.zIndex = '-1';
  container.innerHTML = buildAdministrativeHtml(payload);
  document.body.appendChild(container);

  try {
    const target = container.firstElementChild as HTMLElement;
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const imgData = canvas.toDataURL('image/png');
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 2) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const safeScope = payload.scopeLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    pdf.save(`Bao_Cao_The_Luc_53_2008_${safeScope}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
