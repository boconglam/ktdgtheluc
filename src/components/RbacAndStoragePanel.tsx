import React, { useEffect, useRef, useState } from 'react';
import {
  Cloud,
  CloudOff,
  Edit3,
  FolderOpen,
  LogIn,
  LogOut,
  Plus,
  Save,
  Shield,
  Trash2,
  UploadCloud,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import type {
  FitnessAssessment,
  LocalWorkspaceBundle,
  SchoolAdminConfig,
  StudentProfile,
  UserAccount,
  UserInvite,
  UserRole,
} from '../types/fitness';
import { BOOTSTRAP_SUPER_ADMIN_EMAIL } from '../firebase';
import {
  canUserCloudSync,
  createUserInvite,
  deleteUserAccount,
  deleteUserInvite,
  fetchAllUserInvitesForSuperAdmin,
  fetchAllUsersForSuperAdmin,
  parseWorkspaceJsonFile,
  pullWorkspaceFromCloud,
  saveWorkspaceAsJson,
  syncWorkspaceToCloud,
  updateUserInvite,
  updateUserPermissions,
} from '../services/storageService';

interface Props {
  isOnline: boolean;
  firebaseUser: { uid: string; email: string; displayName: string } | null;
  account: UserAccount | null;
  schoolConfig: SchoolAdminConfig;
  students: StudentProfile[];
  assessments: FitnessAssessment[];
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onRestoreWorkspace: (bundle: LocalWorkspaceBundle) => void;
  onRefreshAccount: () => Promise<void>;
}

export const RbacAndStoragePanel: React.FC<Props> = ({
  isOnline,
  firebaseUser,
  account,
  schoolConfig,
  students,
  assessments,
  onSignInGoogle,
  onSignOut,
  onRestoreWorkspace,
  onRefreshAccount,
}) => {
  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const [customJsonName, setCustomJsonName] = useState(
    `the_luc_thpt_${new Date().toISOString().slice(0, 10)}`
  );
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Super Admin User Directory & Invites
  const [managedUsers, setManagedUsers] = useState<UserAccount[]>([]);
  const [managedInvites, setManagedInvites] = useState<UserInvite[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Add / Edit Permission Modal & Inline Delete Confirm
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [permModalMode, setPermModalMode] = useState<'create_invite' | 'edit_user' | 'edit_invite'>('create_invite');
  const [editingUserTarget, setEditingUserTarget] = useState<UserAccount | null>(null);
  const [editingInviteTarget, setEditingInviteTarget] = useState<UserInvite | null>(null);
  const [permForm, setPermForm] = useState({
    email: '',
    displayName: '',
    role: 'staff' as UserRole,
    canCloudSync: false,
    canViewStudents: true,
    canEditStudents: true,
    canRecordTests: true,
    canExportPdf: true,
    assignedClassesText: '*',
    status: 'active' as 'active' | 'disabled',
  });
  const [savingPerm, setSavingPerm] = useState(false);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  const isBootstrapUser =
    firebaseUser?.email?.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase();
  const cloudAllowed = canUserCloudSync(account) || isBootstrapUser;
  const isSuperAdmin = account?.role === 'super_admin' || isBootstrapUser;
  const needsBootstrapRestore = Boolean(isBootstrapUser && account && account.role !== 'super_admin');

  const loadManagedUsers = async () => {
    if (!isSuperAdmin || !isOnline) return;
    setLoadingUsers(true);
    try {
      const [userList, inviteList] = await Promise.all([
        fetchAllUsersForSuperAdmin(),
        fetchAllUserInvitesForSuperAdmin(),
      ]);
      setManagedUsers(userList);
      setManagedInvites(inviteList);
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể tải danh sách tài khoản.',
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin && isOnline) {
      void loadManagedUsers();
    }
  }, [isSuperAdmin, isOnline]);

  const handleSaveJson = async () => {
    setStatusMsg(null);
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
      const savedName = await saveWorkspaceAsJson(bundle, customJsonName);
      setStatusMsg({
        type: 'ok',
        text: `Đã lưu dữ liệu cục bộ thành tệp "${savedName}" (${students.length} học sinh, ${assessments.length} bản ghi).`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Lỗi khi lưu tệp JSON.',
      });
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMsg(null);
    try {
      const bundle = await parseWorkspaceJsonFile(file);
      onRestoreWorkspace(bundle);
      setStatusMsg({
        type: 'ok',
        text: `Đã nạp thành công tệp "${file.name}" (${bundle.students.length} học sinh, ${bundle.assessments.length} lượt kiểm tra).`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể đọc tệp JSON.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleCloudPush = async () => {
    if (!account) return;
    setSyncing(true);
    setStatusMsg(null);
    try {
      const authorizedUids = managedUsers
        .filter((u) => u.status === 'active' && (u.role === 'super_admin' || u.canCloudSync))
        .map((u) => u.uid);

      const res = await syncWorkspaceToCloud({
        account,
        schoolConfig,
        students,
        assessments,
        cloudAuthorizedUids: authorizedUids,
      });
      setStatusMsg({
        type: 'ok',
        text: `Đã đồng bộ an toàn lên đám mây: ${res.syncedStudents} học sinh và ${res.syncedAssessments} kết quả kiểm tra.`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Đồng bộ đám mây thất bại.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleCloudPull = async () => {
    if (!account) return;
    setSyncing(true);
    setStatusMsg(null);
    try {
      const data = await pullWorkspaceFromCloud(account);
      onRestoreWorkspace({
        format: 'the-luc-thpt-53-2008-workspace',
        version: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: account.displayName,
        schoolConfig: data.schoolConfig ?? schoolConfig,
        students: data.students,
        assessments: data.assessments,
      });
      setStatusMsg({
        type: 'ok',
        text: `Đã tải từ đám mây: ${data.students.length} học sinh và ${data.assessments.length} lượt kiểm tra.`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể tải dữ liệu từ đám mây.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateUser = async (
    target: UserAccount,
    updates: Partial<UserAccount>
  ) => {
    setStatusMsg(null);
    try {
      await updateUserPermissions(target, updates);
      await loadManagedUsers();
      if (target.uid === account?.uid) {
        await onRefreshAccount();
      }
      setStatusMsg({
        type: 'ok',
        text: `Đã cập nhật phân quyền cho ${target.displayName}.`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Lỗi cập nhật phân quyền.',
      });
    }
  };

  const openCreateInviteModal = () => {
    setPermModalMode('create_invite');
    setEditingUserTarget(null);
    setEditingInviteTarget(null);
    setPermForm({
      email: '',
      displayName: '',
      role: 'staff',
      canCloudSync: false,
      canViewStudents: true,
      canEditStudents: false,
      canRecordTests: true,
      canExportPdf: true,
      assignedClassesText: '*',
      status: 'active',
    });
    setPermModalOpen(true);
  };

  const openEditUserModal = (u: UserAccount) => {
    setPermModalMode('edit_user');
    setEditingUserTarget(u);
    setEditingInviteTarget(null);
    setPermForm({
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      canCloudSync: u.canCloudSync,
      canViewStudents: u.canViewStudents,
      canEditStudents: u.canEditStudents,
      canRecordTests: u.canRecordTests,
      canExportPdf: u.canExportPdf,
      assignedClassesText: u.assignedClasses.join(', ') || '*',
      status: u.status,
    });
    setPermModalOpen(true);
  };

  const openEditInviteModal = (inv: UserInvite) => {
    setPermModalMode('edit_invite');
    setEditingUserTarget(null);
    setEditingInviteTarget(inv);
    setPermForm({
      email: inv.email,
      displayName: inv.displayName,
      role: inv.role,
      canCloudSync: inv.canCloudSync,
      canViewStudents: inv.canViewStudents,
      canEditStudents: inv.canEditStudents,
      canRecordTests: inv.canRecordTests,
      canExportPdf: inv.canExportPdf,
      assignedClassesText: inv.assignedClasses.join(', ') || '*',
      status: inv.status,
    });
    setPermModalOpen(true);
  };

  const handleSubmitPermModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    setSavingPerm(true);
    setStatusMsg(null);
    const parsedClasses = permForm.assignedClassesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const assignedClasses = parsedClasses.length > 0 ? parsedClasses : ['*'];

    try {
      if (permModalMode === 'create_invite') {
        const created = await createUserInvite(account.uid, {
          email: permForm.email,
          displayName: permForm.displayName,
          role: permForm.role === 'admin' ? 'admin' : 'staff',
          canCloudSync: permForm.canCloudSync,
          canViewStudents: permForm.canViewStudents,
          canEditStudents: permForm.canEditStudents,
          canRecordTests: permForm.canRecordTests,
          canExportPdf: permForm.canExportPdf,
          assignedClasses,
          status: permForm.status,
        });
        setStatusMsg({
          type: 'ok',
          text: `Đã thêm phân quyền chờ kích hoạt cho ${created.email}.`,
        });
      } else if (permModalMode === 'edit_user' && editingUserTarget) {
        await updateUserPermissions(editingUserTarget, {
          displayName: permForm.displayName,
          role: permForm.role,
          canCloudSync: permForm.canCloudSync,
          canViewStudents: permForm.canViewStudents,
          canEditStudents: permForm.canEditStudents,
          canRecordTests: permForm.canRecordTests,
          canExportPdf: permForm.canExportPdf,
          assignedClasses,
          status: permForm.status,
        });
        if (editingUserTarget.uid === account.uid) {
          await onRefreshAccount();
        }
        setStatusMsg({
          type: 'ok',
          text: `Đã lưu thay đổi phân quyền cho ${permForm.displayName}.`,
        });
      } else if (permModalMode === 'edit_invite' && editingInviteTarget) {
        await updateUserInvite(editingInviteTarget, {
          email: permForm.email,
          displayName: permForm.displayName,
          role: permForm.role === 'admin' ? 'admin' : 'staff',
          canCloudSync: permForm.canCloudSync,
          canViewStudents: permForm.canViewStudents,
          canEditStudents: permForm.canEditStudents,
          canRecordTests: permForm.canRecordTests,
          canExportPdf: permForm.canExportPdf,
          assignedClasses,
          status: permForm.status,
        });
        setStatusMsg({
          type: 'ok',
          text: `Đã cập nhật phân quyền cho ${permForm.email}.`,
        });
      }
      setPermModalOpen(false);
      await loadManagedUsers();
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể lưu phân quyền người dùng.',
      });
    } finally {
      setSavingPerm(false);
    }
  };

  const handleDeleteUser = async (target: UserAccount) => {
    if (!account) return;
    setStatusMsg(null);
    try {
      await deleteUserAccount(target, account.uid);
      setConfirmDeleteKey(null);
      await loadManagedUsers();
      setStatusMsg({
        type: 'ok',
        text: `Đã xóa phân quyền tài khoản ${target.email}.`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể xóa tài khoản.',
      });
    }
  };

  const handleDeleteInvite = async (invite: UserInvite) => {
    setStatusMsg(null);
    try {
      await deleteUserInvite(invite);
      setConfirmDeleteKey(null);
      await loadManagedUsers();
      setStatusMsg({
        type: 'ok',
        text: `Đã xóa phân quyền email ${invite.email}.`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể xóa phân quyền email.',
      });
    }
  };

  const roleLabel = (role?: UserRole) => {
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'admin') return 'Admin';
    if (role === 'staff') return 'Nhân viên';
    return 'Chế độ Cục bộ (Chưa đăng nhập)';
  };

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div
          className={`flex items-center gap-2 text-xs rounded-xl p-3.5 border ${
            statusMsg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {statusMsg.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Top Grid: Local *.json Storage + Cloud Sync Gate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Local JSON Storage (Always available for everyone) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Lưu trữ cục bộ (*.json theo tên tự đặt)
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Dành cho mọi tài khoản (đặc biệt Nhân viên chưa cấp quyền đồng bộ đám mây hoặc khi làm việc ngoại tuyến). Dữ liệu được xuất thành tệp JSON riêng tư trên thiết bị của bạn.
            </p>
          </div>

          <label className="block text-xs">
            <span className="font-medium text-slate-700">Tên tệp dữ liệu cục bộ (.json)</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="text"
                value={customJsonName}
                onChange={(e) => setCustomJsonName(e.target.value)}
                placeholder="nhap_ten_tep_cua_ban"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
              />
              <span className="text-xs font-mono text-slate-500">.json</span>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void handleSaveJson()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl min-h-[44px] whitespace-nowrap"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>Lưu</span>
            </button>

            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportJson}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => jsonInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl min-h-[44px] whitespace-nowrap"
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              <span>Mở</span>
            </button>
          </div>
        </div>

        {/* Cloud Sync & Authentication Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Đồng bộ Đám mây &amp; Xác thực bảo mật
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Kết nối mạng:{' '}
                <strong className={isOnline ? 'text-emerald-700' : 'text-amber-700'}>
                  {isOnline ? 'Đang trực tuyến (Internet sẵn sàng)' : 'Ngoại tuyến (Tự động khóa đồng bộ)'}
                </strong>
              </p>
            </div>
            {isOnline && cloudAllowed ? (
              <Cloud className="w-6 h-6 text-teal-700 shrink-0" />
            ) : (
              <CloudOff className="w-6 h-6 text-slate-400 shrink-0" />
            )}
          </div>

          {!firebaseUser ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Đăng nhập bằng tài khoản Google để xác thực vai trò (Super Admin / Admin / Nhân viên) và sử dụng đồng bộ đám mây nếu được cấp quyền.
              </p>
              <button
                type="button"
                disabled={!isOnline}
                onClick={() => void onSignInGoogle()}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 rounded-xl min-h-[44px]"
              >
                <LogIn className="w-4 h-4" />
                Đăng nhập Google
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{account?.displayName || firebaseUser.displayName}</span>
                  <button
                    type="button"
                    onClick={() => void onSignOut()}
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-rose-700 font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Đăng xuất
                  </button>
                </div>
                <div className="text-slate-500">
                  {firebaseUser.email} · Vai trò:{' '}
                  <strong className="text-slate-800">
                    {isBootstrapUser ? 'Super Admin (Cố định)' : roleLabel(account?.role)}
                  </strong>
                </div>
                {needsBootstrapRestore && (
                  <div className="pt-1.5">
                    <button
                      type="button"
                      onClick={() => void onRefreshAccount().then(loadManagedUsers)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
                    >
                      Khôi phục quyền Super Admin trên Đám mây ngay
                    </button>
                  </div>
                )}
                <div className="text-slate-500">
                  Quyền đồng bộ đám mây:{' '}
                  <strong className={cloudAllowed ? 'text-emerald-700' : 'text-amber-700'}>
                    {cloudAllowed ? 'Đã cấp quyền' : 'Chưa được cấp (Chỉ lưu *.json cục bộ)'}
                  </strong>
                </div>
              </div>

              {cloudAllowed ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={!isOnline || syncing}
                    onClick={() => void handleCloudPush()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 rounded-xl min-h-[44px]"
                  >
                    <UploadCloud className="w-4 h-4" />
                    {syncing ? 'Đang đồng bộ...' : 'Đẩy dữ liệu lên Đám mây'}
                  </button>
                  <button
                    type="button"
                    disabled={!isOnline || syncing}
                    onClick={() => void handleCloudPull()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl min-h-[44px]"
                  >
                    <Cloud className="w-4 h-4" />
                    Tải từ Đám mây
                  </button>
                </div>
              ) : (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  Tài khoản của bạn hiện không có quyền đồng bộ đám mây. Liên hệ Super Admin để được cấp quyền, hoặc sử dụng tính năng lưu tệp <strong>*.json</strong> cục bộ bên cạnh.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Super Admin RBAC Matrix */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-teal-700" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Phân quyền người dùng &amp; Cấp quyền đồng bộ đám mây
              </h3>
              <p className="text-xs text-slate-500">
                Super Admin quản lý vai trò (Super Admin / Admin / Nhân viên), phạm vi lớp phụ trách và quyền đồng bộ đám mây.
              </p>
            </div>
          </div>
          {isSuperAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!isOnline}
                onClick={openCreateInviteModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 rounded-lg min-h-[40px]"
              >
                <Plus className="w-4 h-4" />
                Thêm phân quyền
              </button>
              <button
                type="button"
                onClick={() => void loadManagedUsers()}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg min-h-[40px]"
              >
                {loadingUsers ? 'Đang tải...' : 'Làm mới danh sách'}
              </button>
            </div>
          )}
        </div>

        {!isSuperAdmin ? (
          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
            <p className="font-semibold text-slate-900">Quyền hạn hiện tại của bạn:</p>
            <p>
              Vai trò: <strong>{roleLabel(account?.role)}</strong> · Xem học sinh:{' '}
              <strong>{account ? (account.canViewStudents ? 'Có' : 'Không') : 'Có (Cục bộ)'}</strong> ·
              Thêm/Sửa DS: <strong>{account ? (account.canEditStudents ? 'Có' : 'Không') : 'Có (Cục bộ)'}</strong> ·
              Kiểm tra &amp; Nhập điểm: <strong>{account ? (account.canRecordTests ? 'Có' : 'Không') : 'Có (Cục bộ)'}</strong> ·
              Xuất PDF: <strong>{account ? (account.canExportPdf ? 'Có' : 'Không') : 'Có (Cục bộ)'}</strong> ·
              Đồng bộ Đám mây: <strong>{cloudAllowed ? 'Có' : 'Không'}</strong>
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Table 1: Active Registered Accounts */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-3">Người dùng</th>
                    <th className="py-2.5 px-3">Vai trò</th>
                    <th className="py-2.5 px-3">Đám mây</th>
                    <th className="py-2.5 px-3">Sửa HS</th>
                    <th className="py-2.5 px-3">Đo thể lực</th>
                    <th className="py-2.5 px-3">Xuất PDF</th>
                    <th className="py-2.5 px-3">Lớp phụ trách</th>
                    <th className="py-2.5 px-3">Trạng thái</th>
                    <th className="py-2.5 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {managedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-500">
                        <Users className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                        Chưa có nhân viên/admin nào khác đăng nhập vào hệ thống.
                      </td>
                    </tr>
                  ) : (
                    managedUsers.map((u) => {
                      const isRootSuperAdmin =
                        u.email.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase();
                      const isSelf = u.uid === account?.uid;
                      const delKey = `user:${u.uid}`;
                      return (
                        <tr key={u.uid} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-900">{u.displayName}</div>
                            <div className="text-slate-500">
                              {u.email}
                              {isRootSuperAdmin && (
                                <span className="ml-1.5 text-[11px] font-medium text-teal-700">
                                  · Cố định (Không thể đổi/xóa)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={isRootSuperAdmin ? 'super_admin' : u.role}
                              disabled={isRootSuperAdmin}
                              onChange={(e) =>
                                void handleUpdateUser(u, { role: e.target.value as UserRole })
                              }
                              className="rounded border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-500 px-2 py-1.5 text-xs"
                            >
                              <option value="super_admin">Super Admin</option>
                              <option value="admin">Admin</option>
                              <option value="staff">Nhân viên</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={isRootSuperAdmin || u.role === 'super_admin' || u.canCloudSync}
                              disabled={isRootSuperAdmin || u.role === 'super_admin'}
                              onChange={(e) =>
                                void handleUpdateUser(u, { canCloudSync: e.target.checked })
                              }
                              className="w-4 h-4 accent-teal-700 disabled:opacity-60"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={isRootSuperAdmin || u.canEditStudents}
                              disabled={isRootSuperAdmin}
                              onChange={(e) =>
                                void handleUpdateUser(u, { canEditStudents: e.target.checked })
                              }
                              className="w-4 h-4 accent-teal-700 disabled:opacity-60"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={isRootSuperAdmin || u.canRecordTests}
                              disabled={isRootSuperAdmin}
                              onChange={(e) =>
                                void handleUpdateUser(u, { canRecordTests: e.target.checked })
                              }
                              className="w-4 h-4 accent-teal-700 disabled:opacity-60"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={isRootSuperAdmin || u.canExportPdf}
                              disabled={isRootSuperAdmin}
                              onChange={(e) =>
                                void handleUpdateUser(u, { canExportPdf: e.target.checked })
                              }
                              className="w-4 h-4 accent-teal-700 disabled:opacity-60"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              defaultValue={isRootSuperAdmin ? '*' : u.assignedClasses.join(', ')}
                              disabled={isRootSuperAdmin}
                              onBlur={(e) => {
                                const arr = e.target.value
                                  .split(',')
                                  .map((s) => s.trim())
                                  .filter(Boolean);
                                void handleUpdateUser(u, {
                                  assignedClasses: arr.length ? arr : ['*'],
                                });
                              }}
                              placeholder="* hoặc 10A1, 10A2"
                              className="w-24 rounded border border-slate-300 disabled:bg-slate-100 disabled:text-slate-500 px-2 py-1 text-xs font-mono"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={isRootSuperAdmin ? 'active' : u.status}
                              disabled={isRootSuperAdmin}
                              onChange={(e) =>
                                void handleUpdateUser(u, {
                                  status: e.target.value as 'active' | 'disabled',
                                })
                              }
                              className="rounded border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-500 px-2 py-1 text-xs"
                            >
                              <option value="active">Hoạt động</option>
                              <option value="disabled">Khóa</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {isRootSuperAdmin ? (
                              <span className="text-[11px] text-slate-400">Được bảo vệ</span>
                            ) : confirmDeleteKey === delKey ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteUser(u)}
                                  className="px-2 py-1 text-[11px] font-medium text-white bg-rose-700 hover:bg-rose-800 rounded"
                                >
                                  Xác nhận
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteKey(null)}
                                  className="px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100 rounded"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditUserModal(u)}
                                  className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded"
                                  title="Sửa phân quyền"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {!isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteKey(delKey)}
                                    className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                                    title="Xóa tài khoản"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table 2: Pre-authorized Email Invites */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-800">
                  Danh sách phân quyền chờ kích hoạt theo Email ({managedInvites.length})
                </h4>
                <span className="text-[11px] text-slate-500">
                  Tự động áp dụng khi giáo viên/admin đăng nhập Google lần đầu
                </span>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="py-2 px-3">Email &amp; Họ tên</th>
                      <th className="py-2 px-3">Vai trò</th>
                      <th className="py-2 px-3">Quyền hạn</th>
                      <th className="py-2 px-3">Lớp</th>
                      <th className="py-2 px-3">Trạng thái</th>
                      <th className="py-2 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {managedInvites.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-500">
                          Chưa có phân quyền chờ kích hoạt. Nhấn &quot;+ Thêm phân quyền&quot; để cấp trước cho email mới.
                        </td>
                      </tr>
                    ) : (
                      managedInvites.map((inv) => {
                        const delKey = `invite:${inv.id}`;
                        const caps = [
                          inv.canCloudSync ? 'Đám mây' : null,
                          inv.canViewStudents ? 'Xem HS' : null,
                          inv.canEditStudents ? 'Sửa HS' : null,
                          inv.canRecordTests ? 'Đo thể lực' : null,
                          inv.canExportPdf ? 'Xuất PDF' : null,
                        ]
                          .filter(Boolean)
                          .join(' · ');
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3">
                              <div className="font-medium text-slate-900">{inv.displayName}</div>
                              <div className="text-slate-500">{inv.email}</div>
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-700">
                              {roleLabel(inv.role)}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{caps || 'Chỉ xem'}</td>
                            <td className="py-2 px-3 font-mono text-slate-700">
                              {inv.assignedClasses.join(', ')}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={
                                  inv.status === 'active'
                                    ? 'text-emerald-700 font-medium'
                                    : 'text-rose-700 font-medium'
                                }
                              >
                                {inv.status === 'active' ? 'Hoạt động' : 'Khóa'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              {confirmDeleteKey === delKey ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteInvite(inv)}
                                    className="px-2 py-1 text-[11px] font-medium text-white bg-rose-700 hover:bg-rose-800 rounded"
                                  >
                                    Xác nhận
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteKey(null)}
                                    className="px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100 rounded"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditInviteModal(inv)}
                                    className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded"
                                    title="Sửa phân quyền email"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteKey(delKey)}
                                    className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                                    title="Xóa phân quyền email"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
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
      </div>

      {/* Add / Edit Permission Modal */}
      {permModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {permModalMode === 'create_invite'
                  ? 'Thêm phân quyền người dùng mới'
                  : permModalMode === 'edit_user'
                    ? 'Cập nhật phân quyền tài khoản'
                    : 'Sửa phân quyền chờ kích hoạt'}
              </h3>
              <button
                type="button"
                onClick={() => setPermModalOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmitPermModal(e)} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-medium text-slate-700">Email Google *</span>
                  <input
                    type="email"
                    required
                    disabled={permModalMode === 'edit_user'}
                    value={permForm.email}
                    onChange={(e) => setPermForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="giaovien@truong.edu.vn"
                    className="mt-1 w-full rounded-lg border border-slate-300 disabled:bg-slate-100 px-3 py-2 text-sm min-h-[42px]"
                  />
                </label>
                <label className="block">
                  <span className="font-medium text-slate-700">Họ và tên *</span>
                  <input
                    type="text"
                    required
                    value={permForm.displayName}
                    onChange={(e) => setPermForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="Nguyễn Văn A"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="font-medium text-slate-700">Vai trò</span>
                  <select
                    value={permForm.role}
                    onChange={(e) =>
                      setPermForm((f) => ({
                        ...f,
                        role: e.target.value as UserRole,
                        canCloudSync: e.target.value === 'super_admin' ? true : f.canCloudSync,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[42px]"
                  >
                    {permModalMode === 'edit_user' && (
                      <option value="super_admin">Super Admin</option>
                    )}
                    <option value="admin">Admin</option>
                    <option value="staff">Nhân viên</option>
                  </select>
                </label>
                <label className="block">
                  <span className="font-medium text-slate-700">Lớp phụ trách</span>
                  <input
                    type="text"
                    value={permForm.assignedClassesText}
                    onChange={(e) =>
                      setPermForm((f) => ({ ...f, assignedClassesText: e.target.value }))
                    }
                    placeholder="* hoặc 10A1, 10A2"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
                  />
                </label>
                <label className="block">
                  <span className="font-medium text-slate-700">Trạng thái</span>
                  <select
                    value={permForm.status}
                    onChange={(e) =>
                      setPermForm((f) => ({
                        ...f,
                        status: e.target.value as 'active' | 'disabled',
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[42px]"
                  >
                    <option value="active">Hoạt động</option>
                    <option value="disabled">Khóa</option>
                  </select>
                </label>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="font-medium text-slate-800">Quyền truy cập chi tiết</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { key: 'canCloudSync', label: 'Đồng bộ Đám mây (Firestore)' },
                    { key: 'canViewStudents', label: 'Xem danh sách học sinh' },
                    { key: 'canEditStudents', label: 'Thêm / Sửa / Xóa học sinh' },
                    { key: 'canRecordTests', label: 'Kiểm tra & Nhập kết quả' },
                    { key: 'canExportPdf', label: 'Xuất báo cáo PDF' },
                  ].map((item) => (
                    <label key={item.key} className="inline-flex items-center gap-2 py-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(permForm[item.key as keyof typeof permForm])}
                        onChange={(e) =>
                          setPermForm((f) => ({ ...f, [item.key]: e.target.checked }))
                        }
                        className="w-4 h-4 accent-teal-700"
                      />
                      <span className="text-slate-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPermModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg min-h-[42px]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingPerm}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg min-h-[42px]"
                >
                  <Save className="w-4 h-4" />
                  {savingPerm ? 'Đang lưu...' : 'Lưu phân quyền'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
