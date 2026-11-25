import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Camera,
  CheckCircle2,
  Cloud,
  Download,
  FileSpreadsheet,
  FileText,
  FolderCog,
  FolderOpen,
  LayoutDashboard,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, BOOTSTRAP_SUPER_ADMIN_EMAIL, googleProvider } from './firebase';
import type {
  FitnessAssessment,
  LocalWorkspaceBundle,
  SchoolAdminConfig,
  StudentProfile,
  UserAccount,
} from './types/fitness';
import {
  canUserCloudSync,
  defaultSchoolConfig,
  deleteStudentsAndAssessmentsFromCloud,
  ensureUserAccount,
  loadLocalCache,
  parseWorkspaceJsonFile,
  pullWorkspaceFromCloud,
  saveLocalCache,
  saveWorkspaceAsJson,
} from './services/storageService';
import {
  formatEnduranceDisplay,
  formatGenderLabel,
  formatGradeLabel,
} from './utils/qd53Standards';
import { buildSampleDataset } from './utils/sampleData';
import { downloadExcelTemplate } from './services/excelService';
import { Qd53ReferenceModal } from './components/Qd53ReferenceModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { AddStudentModal } from './components/AddStudentModal';
import { StudentDetailModal } from './components/StudentDetailModal';
import { CameraPoseTester } from './components/CameraPoseTester';
import { AdminReportPanel } from './components/AdminReportPanel';
import { RbacAndStoragePanel } from './components/RbacAndStoragePanel';

type NavTab = 'overview' | 'students' | 'camera' | 'reports' | 'storage';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Auth & RBAC state
  const [firebaseUser, setFirebaseUser] = useState<{
    uid: string;
    email: string;
    displayName: string;
  } | null>(null);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Core workspace data
  const initialCache = useMemo(() => loadLocalCache(), []);
  const [schoolConfig, setSchoolConfig] = useState<SchoolAdminConfig>(
    () => initialCache?.schoolConfig ?? defaultSchoolConfig()
  );
  const [students, setStudents] = useState<StudentProfile[]>(
    () => initialCache?.students ?? []
  );
  const [assessments, setAssessments] = useState<FitnessAssessment[]>(
    () => initialCache?.assessments ?? []
  );

  // Modals & filters
  const [showQd53Modal, setShowQd53Modal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showSaveJsonModal, setShowSaveJsonModal] = useState(false);
  const [quickJsonName, setQuickJsonName] = useState(
    `the_luc_thpt_${new Date().toISOString().slice(0, 10)}`
  );
  const [quickNotice, setQuickNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const quickOpenInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [cameraStudentId, setCameraStudentId] = useState<string | undefined>(undefined);

  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'all' | 10 | 11 | 12>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Track online/offline state
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Persist local cache automatically
  useEffect(() => {
    saveLocalCache({
      format: 'the-luc-thpt-53-2008-workspace',
      version: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: account?.displayName || firebaseUser?.email || 'Người dùng cục bộ',
      schoolConfig,
      students,
      assessments,
    });
  }, [schoolConfig, students, assessments, account, firebaseUser]);

  const loadAccountProfile = useCallback(
    async (user: { uid: string; email: string; displayName: string; emailVerified: boolean }) => {
      try {
        const acc = await ensureUserAccount(user);
        setAccount(acc);
        if (canUserCloudSync(acc) && navigator.onLine) {
          const cloudData = await pullWorkspaceFromCloud(acc).catch(() => null);
          if (cloudData && (cloudData.students.length > 0 || cloudData.schoolConfig)) {
            setSchoolConfig((prev) => cloudData.schoolConfig ?? prev);
            if (cloudData.students.length > 0) setStudents(cloudData.students);
            if (cloudData.assessments.length > 0) setAssessments(cloudData.assessments);
          }
        }
      } catch {
        setAccount(null);
      }
    },
    []
  );

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && user.email) {
        const basic = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
        };
        setFirebaseUser(basic);
        void loadAccountProfile({ ...basic, emailVerified: user.emailVerified }).finally(() =>
          setAuthReady(true)
        );
      } else {
        setFirebaseUser(null);
        setAccount(null);
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, [loadAccountProfile]);

  const handleSignInGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setAccount(null);
  };

  const currentUid = firebaseUser?.uid || 'local_user';

  // Effective RBAC Permissions (local mode allows full local offline work; signed-in mode enforces account permissions)
  const effectivePermissions = useMemo(() => {
    const isBootstrap =
      firebaseUser?.email?.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase();
    if (isBootstrap) {
      return {
        canViewStudents: true,
        canEditStudents: true,
        canRecordTests: true,
        canExportPdf: true,
        assignedClasses: ['*'],
      };
    }
    if (!account) {
      return {
        canViewStudents: true,
        canEditStudents: true,
        canRecordTests: true,
        canExportPdf: true,
        assignedClasses: ['*'],
      };
    }
    if (account.status === 'disabled') {
      return {
        canViewStudents: false,
        canEditStudents: false,
        canRecordTests: false,
        canExportPdf: false,
        assignedClasses: [] as string[],
      };
    }
    if (account.role === 'super_admin') {
      return {
        canViewStudents: true,
        canEditStudents: true,
        canRecordTests: true,
        canExportPdf: true,
        assignedClasses: ['*'],
      };
    }
    return {
      canViewStudents: account.canViewStudents,
      canEditStudents: account.canEditStudents,
      canRecordTests: account.canRecordTests,
      canExportPdf: account.canExportPdf,
      assignedClasses: account.assignedClasses,
    };
  }, [account, firebaseUser]);

  // Filter students by RBAC assignedClasses
  const accessibleStudents = useMemo(() => {
    if (!effectivePermissions.canViewStudents) return [];
    const allowed = effectivePermissions.assignedClasses;
    if (allowed.includes('*')) return students;
    const set = new Set(allowed.map((c) => c.toLowerCase()));
    return students.filter((s) => set.has(s.className.toLowerCase()));
  }, [students, effectivePermissions]);

  const accessibleStudentIds = useMemo(
    () => new Set(accessibleStudents.map((s) => s.id)),
    [accessibleStudents]
  );

  const accessibleAssessments = useMemo(
    () => assessments.filter((a) => accessibleStudentIds.has(a.studentId)),
    [assessments, accessibleStudentIds]
  );

  const latestAssessmentMap = useMemo(() => {
    const map = new Map<string, FitnessAssessment>();
    for (const a of accessibleAssessments) {
      const prev = map.get(a.studentId);
      if (!prev || a.testedAt >= prev.testedAt) {
        map.set(a.studentId, a);
      }
    }
    return map;
  }, [accessibleAssessments]);

  // Overview KPIs
  const kpis = useMemo(() => {
    const total = accessibleStudents.length;
    let tested = 0;
    let tot = 0;
    let dat = 0;
    let chuaDat = 0;
    let bmiSum = 0;

    for (const s of accessibleStudents) {
      const latest = latestAssessmentMap.get(s.id);
      if (latest) {
        tested += 1;
        bmiSum += latest.bmi;
        if (latest.overallGrade === 'tot') tot += 1;
        else if (latest.overallGrade === 'dat') dat += 1;
        else chuaDat += 1;
      }
    }

    return {
      total,
      tested,
      tot,
      dat,
      chuaDat,
      passRate: tested > 0 ? Math.round(((tot + dat) / tested) * 1000) / 10 : 0,
      totRate: tested > 0 ? Math.round((tot / tested) * 1000) / 10 : 0,
      avgBmi: tested > 0 ? Math.round((bmiSum / tested) * 10) / 10 : 0,
    };
  }, [accessibleStudents, latestAssessmentMap]);

  const uniqueClasses = useMemo(
    () => Array.from(new Set(accessibleStudents.map((s) => s.className))).sort(),
    [accessibleStudents]
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accessibleStudents.filter((s) => {
      if (gradeFilter !== 'all' && s.gradeLevel !== gradeFilter) return false;
      if (classFilter !== 'all' && s.className !== classFilter) return false;
      if (q) {
        const match =
          s.fullName.toLowerCase().includes(q) ||
          s.studentCode.toLowerCase().includes(q) ||
          s.className.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [accessibleStudents, gradeFilter, classFilter, searchQuery]);

  const selectedStudent = useMemo(
    () => accessibleStudents.find((s) => s.id === selectedStudentId) ?? null,
    [accessibleStudents, selectedStudentId]
  );

  // Handlers
  const handleAddStudent = (student: StudentProfile) => {
    setStudents((prev) => [student, ...prev]);
  };

  const handleImportStudents = (imported: StudentProfile[]) => {
    setStudents((prev) => [...imported, ...prev]);
  };

  const handleDeleteStudent = (studentId: string) => {
    const deletedAssessmentIds = assessments
      .filter((a) => a.studentId === studentId)
      .map((a) => a.id);
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    setAssessments((prev) => prev.filter((a) => a.studentId !== studentId));
    setSelectedStudentIds((prev) => {
      if (!prev.has(studentId)) return prev;
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });
    void deleteStudentsAndAssessmentsFromCloud(account, [studentId], deletedAssessmentIds);
  };

  const handleToggleSelectStudent = (studentId: string) => {
    setConfirmBulkDelete(false);
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const allFilteredSelected =
    filteredStudents.length > 0 && filteredStudents.every((s) => selectedStudentIds.has(s.id));

  const handleToggleSelectAllFiltered = () => {
    setConfirmBulkDelete(false);
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredStudents.forEach((s) => next.delete(s.id));
      } else {
        filteredStudents.forEach((s) => next.add(s.id));
      }
      return next;
    });
  };

  const handleBulkDeleteStudents = () => {
    const idsToDelete = Array.from(selectedStudentIds);
    if (idsToDelete.length === 0) return;
    const idSet = new Set(idsToDelete);
    const deletedAssessmentIds = assessments
      .filter((a) => idSet.has(a.studentId))
      .map((a) => a.id);

    setStudents((prev) => prev.filter((s) => !idSet.has(s.id)));
    setAssessments((prev) => prev.filter((a) => !idSet.has(a.studentId)));
    if (selectedStudentId && idSet.has(selectedStudentId)) {
      setSelectedStudentId(null);
    }
    setSelectedStudentIds(new Set());
    setConfirmBulkDelete(false);
    void deleteStudentsAndAssessmentsFromCloud(account, idsToDelete, deletedAssessmentIds);

    setQuickNotice({
      type: 'ok',
      text: `Đã xóa hàng loạt ${idsToDelete.length} học sinh và ${deletedAssessmentIds.length} bản ghi đánh giá liên quan.`,
    });
    window.setTimeout(() => setQuickNotice(null), 5000);
  };

  const handleSaveAssessment = (assessment: FitnessAssessment) => {
    setAssessments((prev) => [assessment, ...prev]);
  };

  const handleDeleteAssessment = (assessmentId: string) => {
    setAssessments((prev) => prev.filter((a) => a.id !== assessmentId));
  };

  const handleToggleFinalize = (assessmentId: string) => {
    setAssessments((prev) =>
      prev.map((a) =>
        a.id === assessmentId
          ? { ...a, status: a.status === 'finalized' ? 'draft' : 'finalized' }
          : a
      )
    );
  };

  const handleRestoreWorkspace = (bundle: LocalWorkspaceBundle) => {
    setSchoolConfig(bundle.schoolConfig);
    setStudents(bundle.students);
    setAssessments(bundle.assessments);
  };

  const handleLoadSampleData = () => {
    const sample = buildSampleDataset(currentUid);
    setSchoolConfig((prev) => (prev.schoolName ? prev : sample.schoolConfig));
    setStudents(sample.students);
    setAssessments(sample.assessments);
  };

  const handleQuickSaveJson = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const bundle: LocalWorkspaceBundle = {
        format: 'the-luc-thpt-53-2008-workspace',
        version: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: account?.displayName || firebaseUser?.email || 'Người dùng cục bộ',
        schoolConfig,
        students,
        assessments,
      };
      const savedName = await saveWorkspaceAsJson(bundle, quickJsonName);
      setShowSaveJsonModal(false);
      setQuickNotice({
        type: 'ok',
        text: `Đã lưu tệp cục bộ "${savedName}" (${students.length} học sinh, ${assessments.length} bản ghi).`,
      });
      window.setTimeout(() => setQuickNotice(null), 5000);
    } catch (err) {
      setQuickNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể lưu tệp JSON.',
      });
    }
  };

  const handleQuickOpenJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const bundle = await parseWorkspaceJsonFile(file);
      handleRestoreWorkspace(bundle);
      setQuickNotice({
        type: 'ok',
        text: `Đã mở tệp "${file.name}" (${bundle.students.length} học sinh, ${bundle.assessments.length} lượt kiểm tra).`,
      });
      window.setTimeout(() => setQuickNotice(null), 5000);
    } catch (err) {
      setQuickNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể đọc tệp JSON.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const navItems: Array<{ id: NavTab; label: string; shortLabel?: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Tổng quan', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'students', label: 'Học sinh', icon: <Users className="w-5 h-5" /> },
    { id: 'camera', label: 'Camera AI', icon: <Camera className="w-5 h-5" /> },
    { id: 'reports', label: 'Báo cáo PDF', icon: <FileText className="w-5 h-5" /> },
    { id: 'storage', label: 'Phân quyền & Lưu', shortLabel: 'Phân quyền', icon: <FolderCog className="w-5 h-5" /> },
  ];

  const gradeTextClass = (g: 'tot' | 'dat' | 'chua_dat') =>
    g === 'tot'
      ? 'text-emerald-700 font-semibold'
      : g === 'dat'
        ? 'text-amber-700 font-semibold'
        : 'text-rose-700 font-semibold';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-200">
          <div className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Thể Lực THPT 53/2008
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {schoolConfig.schoolName || 'Quản lý đánh giá thể lực'}
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] whitespace-nowrap ${
                  active
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2.5 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowSaveJsonModal(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg min-h-[40px] whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5 shrink-0" />
              <span>Lưu</span>
            </button>
            <button
              type="button"
              onClick={() => quickOpenInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg min-h-[40px] whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              <span>Mở</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowQd53Modal(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg min-h-[40px] whitespace-nowrap"
          >
            <BookOpen className="w-4 h-4" />
            Bảng chuẩn 53/2008
          </button>
          <div className="text-[11px] text-slate-500 leading-snug">
            {!authReady
              ? 'Đang kiểm tra phiên...'
              : account
                ? `${account.displayName} · ${account.role === 'super_admin' ? 'Super Admin' : account.role === 'admin' ? 'Admin' : 'Nhân viên'}`
                : 'Chế độ cục bộ (*.json)'}
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        {/* Compact Top Header (Mobile <= 52px, Desktop contextual bar) */}
        <header className="sticky top-0 z-30 h-[52px] lg:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="lg:hidden font-display text-base font-bold text-slate-900 truncate">
              Thể Lực THPT 53/2008
            </span>
            <div className="hidden lg:flex items-center gap-2 text-sm text-slate-500 whitespace-nowrap">
              <span className="font-medium text-slate-900">
                {navItems.find((n) => n.id === activeTab)?.label}
              </span>
              <span aria-hidden="true">/</span>
              <span>Năm học {schoolConfig.schoolYear || '2025 - 2026'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-500 whitespace-nowrap">
              {isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
              <span aria-hidden="true"> · </span>
              {canUserCloudSync(account) ? 'Có quyền Đám mây' : 'Lưu *.json cục bộ'}
            </span>
            <button
              type="button"
              onClick={() => setShowQd53Modal(true)}
              className="lg:hidden min-h-[40px] px-3 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg whitespace-nowrap"
            >
              Chuẩn 53/2008
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg min-h-[40px] whitespace-nowrap shrink-0"
            >
              <Camera className="w-4 h-4" />
              Đo Camera AI
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <input
            ref={quickOpenInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleQuickOpenJson}
            className="hidden"
          />

          {quickNotice && (
            <div
              className={`flex items-center justify-between gap-3 text-xs rounded-xl p-3.5 border ${
                quickNotice.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {quickNotice.type === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{quickNotice.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setQuickNotice(null)}
                className="p-1 rounded hover:bg-black/5"
                aria-label="Đóng thông báo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* VIEW 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Empty state onboarding */}
              {students.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-slate-900">
                      Bắt đầu quản lý thể lực học sinh THPT
                    </h2>
                    <p className="text-sm text-slate-600 max-w-2xl">
                      Nhập danh sách học sinh từ tệp Excel, thêm thủ công, mở tệp *.json đã lưu hoặc nạp bộ dữ liệu minh họa theo Quyết định 53/2008/QĐ-BGDĐT.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={downloadExcelTemplate}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl min-h-[44px] whitespace-nowrap"
                    >
                      <Download className="w-4 h-4" />
                      Xuất file Excel mẫu
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowExcelModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-xl min-h-[44px] whitespace-nowrap"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Nhập Excel
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadSampleData}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl min-h-[44px] whitespace-nowrap"
                    >
                      <Sparkles className="w-4 h-4" />
                      Nạp dữ liệu mẫu
                    </button>
                  </div>
                </div>
              )}

              {/* KPI Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="text-xs text-slate-500">Tổng số học sinh</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {kpis.total}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Đã kiểm tra: <span className="font-mono tabular-nums">{kpis.tested}</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="text-xs text-slate-500">Tỷ lệ Đạt chuẩn 53/2008</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-teal-700 mt-1">
                    {kpis.passRate}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Tốt + Đạt ({kpis.tot + kpis.dat}/{kpis.tested})
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="text-xs text-slate-500">Xếp loại Tốt</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                    {kpis.totRate}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {kpis.tot} học sinh đạt mức Tốt
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="text-xs text-slate-500">BMI trung bình</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {kpis.avgBmi || '—'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Đơn vị kg/m²</div>
                </div>
              </div>

              {/* Distribution Breakdown & Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                  <h3 className="text-base font-semibold text-slate-900">
                    Phân bố xếp loại thể lực (QĐ 53/2008/QĐ-BGDĐT)
                  </h3>
                  <div className="space-y-3">
                    {[
                      {
                        label: 'Xếp loại Tốt',
                        count: kpis.tot,
                        barClass: 'bg-emerald-600',
                        textClass: 'text-emerald-700',
                      },
                      {
                        label: 'Xếp loại Đạt',
                        count: kpis.dat,
                        barClass: 'bg-amber-500',
                        textClass: 'text-amber-700',
                      },
                      {
                        label: 'Chưa đạt',
                        count: kpis.chuaDat,
                        barClass: 'bg-rose-600',
                        textClass: 'text-rose-700',
                      },
                    ].map((row) => {
                      const pct = kpis.tested > 0 ? Math.round((row.count / kpis.tested) * 100) : 0;
                      return (
                        <div key={row.label} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-medium ${row.textClass}`}>{row.label}</span>
                            <span className="font-mono tabular-nums text-slate-700">
                              {row.count} HS ({pct}%)
                            </span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${row.barClass} rounded-full transition-all`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                  <h3 className="text-base font-semibold text-slate-900">Tác vụ nhanh</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('camera')}
                      className="flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-xl min-h-[44px]"
                    >
                      <Camera className="w-4 h-4 shrink-0" />
                      <span>Kiểm tra thể lực bằng Camera AI</span>
                    </button>
                    <button
                      type="button"
                      disabled={!effectivePermissions.canEditStudents}
                      onClick={() => setShowExcelModal(true)}
                      className="flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl min-h-[44px]"
                    >
                      <FileSpreadsheet className="w-4 h-4 shrink-0" />
                      <span>Nhập danh sách học sinh từ Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadExcelTemplate}
                      className="flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl min-h-[44px]"
                    >
                      <Download className="w-4 h-4 shrink-0" />
                      <span>Xuất file Excel mẫu (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('reports')}
                      className="flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl min-h-[44px]"
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      <span>Xuất báo cáo hành chính PDF</span>
                    </button>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setShowSaveJsonModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl min-h-[44px] whitespace-nowrap"
                      >
                        <Save className="w-4 h-4 shrink-0" />
                        <span>Lưu</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => quickOpenInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl min-h-[44px] whitespace-nowrap"
                      >
                        <FolderOpen className="w-4 h-4 shrink-0" />
                        <span>Mở</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('storage')}
                      className="flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl min-h-[44px]"
                    >
                      <Cloud className="w-4 h-4 shrink-0" />
                      <span>Phân quyền &amp; Đồng bộ Đám mây</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Assessments */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">
                    Kết quả kiểm tra gần đây
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('students')}
                    className="text-xs font-medium text-teal-700 hover:text-teal-800"
                  >
                    Xem tất cả học sinh
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-2.5 px-4">Học sinh</th>
                        <th className="py-2.5 px-4">Đợt / Ngày</th>
                        <th className="py-2.5 px-4">BMI</th>
                        <th className="py-2.5 px-4">Gập bụng</th>
                        <th className="py-2.5 px-4">Bật xa</th>
                        <th className="py-2.5 px-4">Chạy bền</th>
                        <th className="py-2.5 px-4">Xếp loại</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {accessibleAssessments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            Chưa có lượt kiểm tra nào được ghi nhận.
                          </td>
                        </tr>
                      ) : (
                        accessibleAssessments.slice(0, 8).map((a) => {
                          const stu = accessibleStudents.find((s) => s.id === a.studentId);
                          if (!stu) return null;
                          return (
                            <tr
                              key={a.id}
                              onClick={() => setSelectedStudentId(stu.id)}
                              className="hover:bg-slate-50 cursor-pointer"
                            >
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-900">{stu.fullName}</div>
                                <div className="text-slate-500">
                                  {stu.className} · {formatGenderLabel(stu.gender)} · {a.ageAtTest}t
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div>{a.termLabel}</div>
                                <div className="text-slate-500 font-mono tabular-nums">{a.testedAt}</div>
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums">
                                {a.bmi} ({a.bmiCategory})
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums">{a.situpsCount} lần</td>
                              <td className="py-3 px-4 font-mono tabular-nums">{a.longJumpCm} cm</td>
                              <td className="py-3 px-4 font-mono tabular-nums">
                                {formatEnduranceDisplay(a.enduranceValue, a.enduranceMode, a.gender)}
                              </td>
                              <td className={`py-3 px-4 ${gradeTextClass(a.overallGrade)}`}>
                                {formatGradeLabel(a.overallGrade)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: STUDENTS ROSTER & PROGRESS */}
          {activeTab === 'students' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm tên, mã HS, lớp..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg min-h-[42px]"
                    />
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    {(['all', 10, 11, 12] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGradeFilter(g)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap min-h-[34px] ${
                          gradeFilter === g
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {g === 'all' ? 'Tất cả' : `Khối ${g}`}
                      </button>
                    ))}
                  </div>

                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs min-h-[42px]"
                  >
                    <option value="all">Tất cả lớp</option>
                    {uniqueClasses.map((c) => (
                      <option key={c} value={c}>
                        Lớp {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={downloadExcelTemplate}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg min-h-[42px] whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    Xuất Excel mẫu
                  </button>
                  {effectivePermissions.canEditStudents && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowExcelModal(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg min-h-[42px] whitespace-nowrap"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        Nhập Excel
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddStudentModal(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg min-h-[42px] whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4" />
                        Thêm học sinh
                      </button>
                    </>
                  )}
                </div>
              </div>

              {effectivePermissions.canEditStudents && selectedStudentIds.size > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-medium text-rose-900">
                    Đã chọn <strong className="font-mono">{selectedStudentIds.size}</strong> học sinh
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentIds(new Set());
                        setConfirmBulkDelete(false);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg min-h-[36px]"
                    >
                      Bỏ chọn
                    </button>
                    {confirmBulkDelete ? (
                      <>
                        <button
                          type="button"
                          onClick={handleBulkDeleteStudents}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg min-h-[36px]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Xác nhận xóa {selectedStudentIds.size} học sinh
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmBulkDelete(false)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg min-h-[36px]"
                        >
                          Hủy
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmBulkDelete(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg min-h-[36px]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Xóa hàng loạt
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        {effectivePermissions.canEditStudents && (
                          <th className="py-3 pl-4 pr-2 w-10">
                            <input
                              type="checkbox"
                              checked={allFilteredSelected}
                              onChange={handleToggleSelectAllFiltered}
                              aria-label="Chọn tất cả học sinh đang lọc"
                              className="w-4 h-4 accent-teal-700 cursor-pointer"
                            />
                          </th>
                        )}
                        <th className="py-3 px-4">Học sinh</th>
                        <th className="py-3 px-4">Lớp / Giới tính</th>
                        <th className="py-3 px-4">BMI gần nhất</th>
                        <th className="py-3 px-4">Gập bụng</th>
                        <th className="py-3 px-4">Bật xa</th>
                        <th className="py-3 px-4">Chạy bền</th>
                        <th className="py-3 px-4">Xếp loại 53/2008</th>
                        <th className="py-3 px-4 text-right">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td
                            colSpan={effectivePermissions.canEditStudents ? 9 : 8}
                            className="py-10 text-center text-slate-500"
                          >
                            Không tìm thấy học sinh phù hợp. Nhấp &quot;Thêm học sinh&quot; hoặc &quot;Nhập Excel&quot; để bắt đầu.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((s) => {
                          const latest = latestAssessmentMap.get(s.id);
                          const isSelected = selectedStudentIds.has(s.id);
                          return (
                            <tr
                              key={s.id}
                              onClick={() => setSelectedStudentId(s.id)}
                              className={`cursor-pointer ${
                                isSelected ? 'bg-teal-50/50 hover:bg-teal-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              {effectivePermissions.canEditStudents && (
                                <td
                                  className="py-3 pl-4 pr-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectStudent(s.id)}
                                    aria-label={`Chọn ${s.fullName}`}
                                    className="w-4 h-4 accent-teal-700 cursor-pointer"
                                  />
                                </td>
                              )}
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-900">{s.fullName}</div>
                                <div className="text-slate-500 font-mono tabular-nums">
                                  {s.studentCode}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div>
                                  Lớp {s.className} · Khối {s.gradeLevel}
                                </div>
                                <div className="text-slate-500">
                                  {formatGenderLabel(s.gender)} · {s.age} tuổi
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums">
                                {latest ? `${latest.bmi} (${latest.bmiCategory})` : '—'}
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums">
                                {latest ? `${latest.situpsCount} lần` : '—'}
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums">
                                {latest ? `${latest.longJumpCm} cm` : '—'}
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums">
                                {latest
                                  ? formatEnduranceDisplay(
                                      latest.enduranceValue,
                                      latest.enduranceMode,
                                      s.gender
                                    )
                                  : '—'}
                              </td>
                              <td className="py-3 px-4">
                                {latest ? (
                                  <span className={gradeTextClass(latest.overallGrade)}>
                                    {formatGradeLabel(latest.overallGrade)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Chưa đo</span>
                                )}
                              </td>
                              <td
                                className="py-3 px-4 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedStudentId(s.id)}
                                    className="px-2.5 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50 rounded-lg min-h-[36px]"
                                  >
                                    Biểu đồ &amp; Đo
                                  </button>
                                  {effectivePermissions.canEditStudents && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteStudent(s.id)}
                                      className="p-2 text-slate-400 hover:text-rose-700 rounded-lg hover:bg-rose-50"
                                      title="Xóa học sinh"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: CAMERA AI POSE TESTER */}
          {activeTab === 'camera' && (
            <CameraPoseTester
              students={accessibleStudents}
              initialStudentId={cameraStudentId}
              schoolYear={schoolConfig.schoolYear}
              currentUid={currentUid}
              canRecordTests={effectivePermissions.canRecordTests}
              onSaveAssessment={handleSaveAssessment}
            />
          )}

          {/* VIEW 4: ADMIN REPORT & PDF EXPORT */}
          {activeTab === 'reports' && (
            <AdminReportPanel
              schoolConfig={schoolConfig}
              onUpdateSchoolConfig={setSchoolConfig}
              students={accessibleStudents}
              assessments={accessibleAssessments}
              canExportPdf={effectivePermissions.canExportPdf}
            />
          )}

          {/* VIEW 5: RBAC & STORAGE */}
          {activeTab === 'storage' && (
            <RbacAndStoragePanel
              isOnline={isOnline}
              firebaseUser={firebaseUser}
              account={account}
              schoolConfig={schoolConfig}
              students={students}
              assessments={assessments}
              onSignInGoogle={handleSignInGoogle}
              onSignOut={handleSignOut}
              onRestoreWorkspace={handleRestoreWorkspace}
              onRefreshAccount={async () => {
                if (auth.currentUser?.email) {
                  await loadAccountProfile({
                    uid: auth.currentUser.uid,
                    email: auth.currentUser.email,
                    displayName: auth.currentUser.displayName || auth.currentUser.email,
                    emailVerified: auth.currentUser.emailVerified,
                  });
                }
              }}
            />
          )}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (<= 64px + 52px header stays well within 15% cap) */}
      <nav
        aria-label="Điều hướng chính trên di động"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="grid grid-cols-5 h-16 items-center">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium transition-colors ${
                  active ? 'text-teal-700' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span className="mt-1 truncate max-w-[68px]">{item.shortLabel || item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      <Qd53ReferenceModal open={showQd53Modal} onClose={() => setShowQd53Modal(false)} />

      <ExcelImportModal
        open={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        schoolId={schoolConfig.id || 'school_default'}
        ownerUid={currentUid}
        onImportStudents={handleImportStudents}
      />

      <AddStudentModal
        open={showAddStudentModal}
        onClose={() => setShowAddStudentModal(false)}
        schoolId={schoolConfig.id || 'school_default'}
        ownerUid={currentUid}
        onSaveStudent={handleAddStudent}
      />

      <StudentDetailModal
        student={selectedStudent}
        assessments={accessibleAssessments}
        schoolYear={schoolConfig.schoolYear}
        currentUid={currentUid}
        account={account}
        canRecordTests={effectivePermissions.canRecordTests}
        onClose={() => setSelectedStudentId(null)}
        onSaveAssessment={handleSaveAssessment}
        onDeleteAssessment={handleDeleteAssessment}
        onToggleFinalize={handleToggleFinalize}
        onLaunchCameraTest={(sid) => {
          setCameraStudentId(sid);
          setActiveTab('camera');
        }}
      />

      {showSaveJsonModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Lưu dữ liệu cục bộ (*.json)</h3>
              <button
                type="button"
                onClick={() => setShowSaveJsonModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Đóng hộp thoại lưu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleQuickSaveJson(e)} className="p-5 space-y-4">
              <label className="block text-xs">
                <span className="font-medium text-slate-700">Đặt tên tệp lưu trữ</span>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={quickJsonName}
                    onChange={(e) => setQuickJsonName(e.target.value)}
                    placeholder="nhap_ten_tep_cua_ban"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
                  />
                  <span className="text-xs font-mono text-slate-500">.json</span>
                </div>
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSaveJsonModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg min-h-[44px]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg min-h-[44px]"
                >
                  <Save className="w-4 h-4" />
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
