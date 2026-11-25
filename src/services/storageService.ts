import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BOOTSTRAP_SUPER_ADMIN_EMAIL,
  OperationType,
  db,
  handleFirestoreError,
} from '../firebase';
import {
  BLUEPRINT_LIMITS,
  type FitnessAssessment,
  type LocalWorkspaceBundle,
  type SchoolAdminConfig,
  type StudentProfile,
  type UserAccount,
  type UserInvite,
} from '../types/fitness';
import {
  calculateBmi,
  classifyBmi,
  evaluateEndurance,
  evaluateLongJump,
  evaluateOverallQd53,
  evaluateSitups,
} from '../utils/qd53Standards';

const LOCAL_CACHE_KEY = 'the_luc_thpt_local_workspace_v1';

export function sanitizeId(raw: string, fallbackPrefix = 'id'): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, BLUEPRINT_LIMITS.ID_MAX);
  if (cleaned.length > 0 && BLUEPRINT_LIMITS.ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createSafeId(prefix: string): string {
  return sanitizeId(`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, prefix);
}

export function truncateStr(val: string | undefined | null, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

export function defaultSchoolConfig(ownerUid = 'local_user'): SchoolAdminConfig {
  return {
    id: 'school_default',
    managingAuthority: '',
    schoolName: '',
    schoolYear: '2025 - 2026',
    locationName: '',
    documentCode: '',
    signerTitle: 'THỦ TRƯỞNG ĐƠN VỊ',
    signerName: '',
    preparerName: '',
    ownerUid: sanitizeId(ownerUid, 'local_user'),
    authorizedUids: [sanitizeId(ownerUid, 'local_user')],
  };
}

export function loadLocalCache(): LocalWorkspaceBundle | null {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalWorkspaceBundle;
    if (parsed && parsed.format === 'the-luc-thpt-53-2008-workspace') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveLocalCache(bundle: LocalWorkspaceBundle): void {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(bundle));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

/**
 * Lưu dữ liệu cục bộ dạng *.json với tên tệp do người dùng đặt.
 */
export async function saveWorkspaceAsJson(
  bundle: LocalWorkspaceBundle,
  rawFileName: string
): Promise<string> {
  const trimmed = rawFileName.trim() || `du_lieu_the_luc_${new Date().toISOString().slice(0, 10)}`;
  const normalizedName = trimmed.toLowerCase().endsWith('.json') ? trimmed : `${trimmed}.json`;
  const jsonContent = JSON.stringify(bundle, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });

  const win = window as unknown as {
    showSaveFilePicker?: (opts: {
      suggestedName: string;
      types: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<{
      createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
    }>;
  };

  if (typeof win.showSaveFilePicker === 'function') {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: normalizedName,
        types: [
          {
            description: 'Tệp dữ liệu thể lực JSON (*.json)',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return (handle as { name?: string }).name || normalizedName;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Đã hủy lưu tệp cục bộ.');
      }
      // Fallback to anchor download inside restricted iframes
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = normalizedName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return normalizedName;
}

export async function parseWorkspaceJsonFile(file: File): Promise<LocalWorkspaceBundle> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Tệp JSON không hợp lệ hoặc bị hỏng cấu trúc.');
  }

  const obj = parsed as Partial<LocalWorkspaceBundle>;
  if (!obj || obj.format !== 'the-luc-thpt-53-2008-workspace' || !Array.isArray(obj.students) || !Array.isArray(obj.assessments)) {
    throw new Error('Tệp JSON không đúng định dạng dữ liệu của ứng dụng Thể Lực THPT 53/2008.');
  }

  return {
    format: 'the-luc-thpt-53-2008-workspace',
    version: 1,
    exportedAt: obj.exportedAt || new Date().toISOString(),
    exportedBy: obj.exportedBy || 'Người dùng cục bộ',
    schoolConfig: {
      ...defaultSchoolConfig(),
      ...(obj.schoolConfig || {}),
      signerTitle: obj.schoolConfig?.signerTitle || 'THỦ TRƯỞNG ĐƠN VỊ',
    },
    students: obj.students,
    assessments: obj.assessments,
  };
}

// =========================================================================
// FIRESTORE RBAC & AUTHORIZED CLOUD SYNC
// =========================================================================

export function canUserCloudSync(account: UserAccount | null): boolean {
  if (!account) return false;
  if (account.email.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase()) return true;
  if (account.status !== 'active') return false;
  return account.role === 'super_admin' || account.canCloudSync === true;
}

export async function ensureUserAccount(params: {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}): Promise<UserAccount> {
  const safeUid = sanitizeId(params.uid, 'user');
  const userRef = doc(db, 'users', safeUid);
  const path = `users/${safeUid}`;
  const isBootstrap =
    params.emailVerified &&
    params.email.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase();

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const existingData = snap.data() as UserAccount;
      if (
        isBootstrap &&
        (existingData.role !== 'super_admin' ||
          !existingData.canCloudSync ||
          !existingData.canViewStudents ||
          !existingData.canEditStudents ||
          !existingData.canRecordTests ||
          !existingData.canExportPdf ||
          !existingData.assignedClasses?.includes('*') ||
          existingData.status !== 'active')
      ) {
        const restored = {
          role: 'super_admin' as const,
          canCloudSync: true,
          canViewStudents: true,
          canEditStudents: true,
          canRecordTests: true,
          canExportPdf: true,
          assignedClasses: ['*'],
          status: 'active' as const,
          updatedAt: serverTimestamp(),
        };
        await updateDoc(userRef, restored);
        return {
          ...existingData,
          ...restored,
          updatedAt: new Date().toISOString(),
        };
      }
      return existingData;
    }

    let matchedInvite: UserInvite | null = null;
    if (!isBootstrap && params.emailVerified) {
      try {
        const inviteSnap = await getDocs(
          query(collection(db, 'user_invites'), where('email', '==', params.email.toLowerCase()))
        );
        if (!inviteSnap.empty) {
          matchedInvite = inviteSnap.docs[0].data() as UserInvite;
        }
      } catch {
        matchedInvite = null;
      }
    }

    const newAccount: UserAccount = matchedInvite
      ? {
          uid: safeUid,
          email: truncateStr(params.email, BLUEPRINT_LIMITS.EMAIL_MAX),
          displayName:
            truncateStr(
              params.displayName || matchedInvite.displayName || params.email.split('@')[0],
              BLUEPRINT_LIMITS.NAME_MAX
            ) || 'Giáo viên',
          role: matchedInvite.role,
          canCloudSync: matchedInvite.canCloudSync,
          canViewStudents: matchedInvite.canViewStudents,
          canEditStudents: matchedInvite.canEditStudents,
          canRecordTests: matchedInvite.canRecordTests,
          canExportPdf: matchedInvite.canExportPdf,
          assignedClasses: matchedInvite.assignedClasses.length
            ? matchedInvite.assignedClasses
            : ['*'],
          status: matchedInvite.status,
          inviteId: matchedInvite.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      : {
          uid: safeUid,
          email: truncateStr(params.email, BLUEPRINT_LIMITS.EMAIL_MAX),
          displayName:
            truncateStr(
              params.displayName || params.email.split('@')[0],
              BLUEPRINT_LIMITS.NAME_MAX
            ) || 'Giáo viên',
          role: isBootstrap ? 'super_admin' : 'staff',
          canCloudSync: isBootstrap,
          canViewStudents: true,
          canEditStudents: isBootstrap,
          canRecordTests: true,
          canExportPdf: true,
          assignedClasses: ['*'],
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

    await setDoc(userRef, newAccount);
    return {
      ...newAccount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchAllUsersForSuperAdmin(): Promise<UserAccount[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => d.data() as UserAccount);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function updateUserPermissions(
  targetUser: UserAccount,
  updates: Partial<
    Pick<
      UserAccount,
      | 'role'
      | 'canCloudSync'
      | 'canViewStudents'
      | 'canEditStudents'
      | 'canRecordTests'
      | 'canExportPdf'
      | 'assignedClasses'
      | 'status'
      | 'displayName'
    >
  >
): Promise<void> {
  if (targetUser.email.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase()) {
    throw new Error(
      `Tài khoản Super Admin gốc (${BOOTSTRAP_SUPER_ADMIN_EMAIL}) được khóa cố định, không thể thay đổi quyền hạn hoặc trạng thái.`
    );
  }
  const safeUid = sanitizeId(targetUser.uid, 'user');
  const path = `users/${safeUid}`;
  try {
    const nextRole = updates.role ?? targetUser.role;
    const nextCloudSync = nextRole === 'super_admin' ? true : (updates.canCloudSync ?? targetUser.canCloudSync);
    const assigned = (updates.assignedClasses ?? targetUser.assignedClasses)
      .slice(0, BLUEPRINT_LIMITS.MAX_ASSIGNED_CLASSES)
      .map((c) => truncateStr(c, BLUEPRINT_LIMITS.CLASS_NAME_MAX))
      .filter(Boolean);

    await updateDoc(doc(db, 'users', safeUid), {
      displayName: truncateStr(updates.displayName ?? targetUser.displayName, BLUEPRINT_LIMITS.NAME_MAX) || 'Giáo viên',
      role: nextRole,
      canCloudSync: nextCloudSync,
      canViewStudents: updates.canViewStudents ?? targetUser.canViewStudents,
      canEditStudents: updates.canEditStudents ?? targetUser.canEditStudents,
      canRecordTests: updates.canRecordTests ?? targetUser.canRecordTests,
      canExportPdf: updates.canExportPdf ?? targetUser.canExportPdf,
      assignedClasses: assigned.length > 0 ? assigned : ['*'],
      status: updates.status ?? targetUser.status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteUserAccount(targetUser: UserAccount, currentUid: string): Promise<void> {
  if (targetUser.email.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase()) {
    throw new Error(
      `Không thể xóa tài khoản Super Admin gốc (${BOOTSTRAP_SUPER_ADMIN_EMAIL}).`
    );
  }
  if (targetUser.uid === currentUid) {
    throw new Error('Không thể tự xóa tài khoản đang đăng nhập.');
  }
  const safeUid = sanitizeId(targetUser.uid, 'user');
  const path = `users/${safeUid}`;
  try {
    await deleteDoc(doc(db, 'users', safeUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchAllUserInvitesForSuperAdmin(): Promise<UserInvite[]> {
  const path = 'user_invites';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => d.data() as UserInvite);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createUserInvite(
  creatorUid: string,
  input: Omit<UserInvite, 'id' | 'createdByUid' | 'createdAt' | 'updatedAt'>
): Promise<UserInvite> {
  const emailLower = truncateStr(input.email, BLUEPRINT_LIMITS.EMAIL_MAX).toLowerCase();
  if (!emailLower || !emailLower.includes('@')) {
    throw new Error('Email người dùng không hợp lệ.');
  }
  if (emailLower === BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase()) {
    throw new Error(`Tài khoản ${BOOTSTRAP_SUPER_ADMIN_EMAIL} là Super Admin cố định.`);
  }
  const id = createSafeId('inv');
  const path = `user_invites/${id}`;
  const assigned = input.assignedClasses
    .slice(0, BLUEPRINT_LIMITS.MAX_ASSIGNED_CLASSES)
    .map((c) => truncateStr(c, BLUEPRINT_LIMITS.CLASS_NAME_MAX))
    .filter(Boolean);

  const payload = {
    id,
    email: emailLower,
    displayName: truncateStr(input.displayName || emailLower.split('@')[0], BLUEPRINT_LIMITS.NAME_MAX) || 'Giáo viên',
    role: input.role === 'admin' ? 'admin' : 'staff',
    canCloudSync: Boolean(input.canCloudSync),
    canViewStudents: Boolean(input.canViewStudents),
    canEditStudents: Boolean(input.canEditStudents),
    canRecordTests: Boolean(input.canRecordTests),
    canExportPdf: Boolean(input.canExportPdf),
    assignedClasses: assigned.length > 0 ? assigned : ['*'],
    status: input.status === 'disabled' ? 'disabled' : 'active',
    createdByUid: sanitizeId(creatorUid, 'user'),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'user_invites', id), payload);
    return {
      ...payload,
      role: payload.role as 'admin' | 'staff',
      status: payload.status as 'active' | 'disabled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateUserInvite(
  invite: UserInvite,
  updates: Partial<Omit<UserInvite, 'id' | 'createdByUid' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const emailLower = truncateStr(updates.email ?? invite.email, BLUEPRINT_LIMITS.EMAIL_MAX).toLowerCase();
  if (emailLower === BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase()) {
    throw new Error(`Không thể thay đổi quyền Super Admin gốc (${BOOTSTRAP_SUPER_ADMIN_EMAIL}).`);
  }
  const safeId = sanitizeId(invite.id, 'inv');
  const path = `user_invites/${safeId}`;
  const assigned = (updates.assignedClasses ?? invite.assignedClasses)
    .slice(0, BLUEPRINT_LIMITS.MAX_ASSIGNED_CLASSES)
    .map((c) => truncateStr(c, BLUEPRINT_LIMITS.CLASS_NAME_MAX))
    .filter(Boolean);

  try {
    await updateDoc(doc(db, 'user_invites', safeId), {
      email: emailLower,
      displayName: truncateStr(updates.displayName ?? invite.displayName, BLUEPRINT_LIMITS.NAME_MAX) || 'Giáo viên',
      role: (updates.role ?? invite.role) === 'admin' ? 'admin' : 'staff',
      canCloudSync: updates.canCloudSync ?? invite.canCloudSync,
      canViewStudents: updates.canViewStudents ?? invite.canViewStudents,
      canEditStudents: updates.canEditStudents ?? invite.canEditStudents,
      canRecordTests: updates.canRecordTests ?? invite.canRecordTests,
      canExportPdf: updates.canExportPdf ?? invite.canExportPdf,
      assignedClasses: assigned.length > 0 ? assigned : ['*'],
      status: (updates.status ?? invite.status) === 'disabled' ? 'disabled' : 'active',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteUserInvite(invite: UserInvite): Promise<void> {
  if (invite.email.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase()) {
    throw new Error(`Không thể xóa phân quyền của ${BOOTSTRAP_SUPER_ADMIN_EMAIL}.`);
  }
  const safeId = sanitizeId(invite.id, 'inv');
  const path = `user_invites/${safeId}`;
  try {
    await deleteDoc(doc(db, 'user_invites', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function buildAuthorizedUids(currentUid: string, existingUids?: string[], extraSyncedUids: string[] = []): string[] {
  const merged = new Set<string>([
    sanitizeId(currentUid, 'user'),
    ...(existingUids || []).map((u) => sanitizeId(u, 'user')),
    ...extraSyncedUids.map((u) => sanitizeId(u, 'user')),
  ]);
  return Array.from(merged).slice(0, BLUEPRINT_LIMITS.MAX_AUTHORIZED_UIDS);
}

export async function syncWorkspaceToCloud(params: {
  account: UserAccount;
  schoolConfig: SchoolAdminConfig;
  students: StudentProfile[];
  assessments: FitnessAssessment[];
  cloudAuthorizedUids?: string[];
}): Promise<{ syncedStudents: number; syncedAssessments: number }> {
  if (!navigator.onLine) {
    throw new Error('Không có kết nối Internet. Vui lòng lưu dữ liệu cục bộ dạng *.json.');
  }
  if (!canUserCloudSync(params.account)) {
    throw new Error('Tài khoản chưa được Super Admin cấp quyền đồng bộ đám mây. Chỉ có thể lưu tệp *.json cục bộ.');
  }

  const uid = sanitizeId(params.account.uid, 'user');
  const schoolId = sanitizeId(params.schoolConfig.id || 'school_default', 'school');
  const authUids = buildAuthorizedUids(
    uid,
    params.schoolConfig.authorizedUids,
    params.cloudAuthorizedUids || []
  );

  // 1. Upsert School Admin Config
  const schoolPath = `schools/${schoolId}`;
  try {
    const schoolRef = doc(db, 'schools', schoolId);
    const existingSchool = await getDoc(schoolRef);
    const schoolPayload = {
      id: schoolId,
      managingAuthority: truncateStr(params.schoolConfig.managingAuthority, BLUEPRINT_LIMITS.MANAGING_AUTHORITY_MAX),
      schoolName: truncateStr(params.schoolConfig.schoolName, BLUEPRINT_LIMITS.SCHOOL_NAME_MAX),
      schoolYear: truncateStr(params.schoolConfig.schoolYear || '2025 - 2026', BLUEPRINT_LIMITS.SCHOOL_YEAR_MAX),
      locationName: truncateStr(params.schoolConfig.locationName, BLUEPRINT_LIMITS.LOCATION_MAX),
      documentCode: truncateStr(params.schoolConfig.documentCode, BLUEPRINT_LIMITS.DOC_CODE_MAX),
      signerTitle: truncateStr(params.schoolConfig.signerTitle || 'THỦ TRƯỞNG ĐƠN VỊ', BLUEPRINT_LIMITS.SIGNER_TITLE_MAX),
      signerName: truncateStr(params.schoolConfig.signerName, BLUEPRINT_LIMITS.NAME_MAX),
      preparerName: truncateStr(params.schoolConfig.preparerName, BLUEPRINT_LIMITS.NAME_MAX),
      ownerUid: existingSchool.exists() ? (existingSchool.data().ownerUid as string) : uid,
      authorizedUids: authUids,
      createdAt: existingSchool.exists() ? existingSchool.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(schoolRef, schoolPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, schoolPath);
  }

  // 2. Batch upsert students (<= 400 ops per Firestore batch)
  const validStudentIds = new Set<string>();
  const studentChunks: StudentProfile[][] = [];
  for (let i = 0; i < params.students.length; i += 350) {
    studentChunks.push(params.students.slice(i, i + 350));
  }

  for (const chunk of studentChunks) {
    const batch = writeBatch(db);
    for (const s of chunk) {
      const sid = sanitizeId(s.id, 'stu');
      validStudentIds.add(sid);
      const ref = doc(db, 'students', sid);
      const existingSnap = await getDoc(ref).catch(() => null);
      const ownerUid = existingSnap?.exists() ? (existingSnap.data().ownerUid as string) : uid;
      const createdAt = existingSnap?.exists() ? existingSnap.data().createdAt : serverTimestamp();
      const studentAuthUids = buildAuthorizedUids(uid, s.authorizedUids, authUids);
      const age = Math.min(20, Math.max(14, Math.round(s.age || 16)));
      const gradeLevel = ([10, 11, 12].includes(s.gradeLevel) ? s.gradeLevel : 10) as 10 | 11 | 12;

      batch.set(ref, {
        id: sid,
        schoolId,
        studentCode: truncateStr(s.studentCode, BLUEPRINT_LIMITS.STUDENT_CODE_MAX),
        fullName: truncateStr(s.fullName, BLUEPRINT_LIMITS.NAME_MAX) || 'Học sinh',
        className: truncateStr(s.className, BLUEPRINT_LIMITS.CLASS_NAME_MAX) || '10A1',
        gradeLevel,
        gender: s.gender === 'nu' ? 'nu' : 'nam',
        birthYear: Math.min(2020, Math.max(1995, Math.round(s.birthYear || 2009))),
        age,
        notes: truncateStr(s.notes, BLUEPRINT_LIMITS.NOTES_MAX),
        ownerUid,
        authorizedUids: studentAuthUids,
        createdAt,
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'students');
    }
  }

  // 3. Batch upsert assessments
  const assessChunks: FitnessAssessment[][] = [];
  const filteredAssessments = params.assessments.filter((a) =>
    validStudentIds.has(sanitizeId(a.studentId, 'stu'))
  );
  for (let i = 0; i < filteredAssessments.length; i += 350) {
    assessChunks.push(filteredAssessments.slice(i, i + 350));
  }

  for (const chunk of assessChunks) {
    const batch = writeBatch(db);
    for (const a of chunk) {
      const aid = sanitizeId(a.id, 'asm');
      const sid = sanitizeId(a.studentId, 'stu');
      const ref = doc(db, 'assessments', aid);
      const existingSnap = await getDoc(ref).catch(() => null);
      const recordedByUid = existingSnap?.exists() ? (existingSnap.data().recordedByUid as string) : uid;
      const createdAt = existingSnap?.exists() ? existingSnap.data().createdAt : serverTimestamp();
      const assessAuthUids = buildAuthorizedUids(uid, a.authorizedUids, authUids);

      const heightCm = Math.min(230, Math.max(100, Number(a.heightCm) || 165));
      const weightKg = Math.min(180, Math.max(20, Number(a.weightKg) || 55));
      const ageAtTest = Math.min(20, Math.max(14, Math.round(a.ageAtTest || 16)));
      const gender = a.gender === 'nu' ? 'nu' : 'nam';
      const bmi = calculateBmi(heightCm, weightKg);
      const bmiEval = classifyBmi(bmi, ageAtTest);
      const situpsCount = Math.min(120, Math.max(0, Math.round(a.situpsCount || 0)));
      const longJumpCm = Math.min(450, Math.max(0, Number(a.longJumpCm) || 0));
      const enduranceMode = a.enduranceMode === 'distance_s' ? 'distance_s' : '5min_m';
      const enduranceValue = Math.min(5000, Math.max(0, Number(a.enduranceValue) || 0));

      const situpsGrade = evaluateSitups(situpsCount, ageAtTest, gender);
      const longJumpGrade = evaluateLongJump(longJumpCm, ageAtTest, gender);
      const enduranceGrade = evaluateEndurance(enduranceValue, enduranceMode, ageAtTest, gender);
      const overallGrade = evaluateOverallQd53(situpsGrade, longJumpGrade, enduranceGrade);

      batch.set(ref, {
        id: aid,
        studentId: sid,
        schoolId,
        termLabel: truncateStr(a.termLabel || 'Định kỳ', BLUEPRINT_LIMITS.TERM_LABEL_MAX),
        schoolYear: truncateStr(a.schoolYear || params.schoolConfig.schoolYear || '2025 - 2026', BLUEPRINT_LIMITS.SCHOOL_YEAR_MAX),
        testedAt: truncateStr(a.testedAt || new Date().toISOString().slice(0, 10), BLUEPRINT_LIMITS.TESTED_AT_MAX),
        ageAtTest,
        gender,
        heightCm,
        weightKg,
        bmi,
        bmiCategory: truncateStr(bmiEval.category, BLUEPRINT_LIMITS.BMI_CATEGORY_MAX),
        situpsCount,
        situpsGrade,
        longJumpCm,
        longJumpGrade,
        enduranceMode,
        enduranceValue,
        enduranceGrade,
        overallGrade,
        captureMethod: a.captureMethod === 'camera_ai' ? 'camera_ai' : 'manual',
        status: a.status === 'finalized' ? 'finalized' : 'draft',
        recordedByUid,
        authorizedUids: assessAuthUids,
        createdAt,
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'assessments');
    }
  }

  return {
    syncedStudents: params.students.length,
    syncedAssessments: filteredAssessments.length,
  };
}

export async function pullWorkspaceFromCloud(account: UserAccount): Promise<{
  schoolConfig: SchoolAdminConfig | null;
  students: StudentProfile[];
  assessments: FitnessAssessment[];
}> {
  if (!navigator.onLine) {
    throw new Error('Không có kết nối Internet để tải dữ liệu từ đám mây.');
  }
  if (!canUserCloudSync(account)) {
    throw new Error('Tài khoản chưa được cấp quyền đồng bộ đám mây.');
  }

  const isBootstrap = account.email.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase();
  const uid = sanitizeId(account.uid, 'user');

  let schoolsSnap;
  try {
    const q = isBootstrap
      ? collection(db, 'schools')
      : query(collection(db, 'schools'), where('authorizedUids', 'array-contains', uid));
    schoolsSnap = await getDocs(q);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'schools');
  }

  let studentsSnap;
  try {
    const q = isBootstrap
      ? collection(db, 'students')
      : query(collection(db, 'students'), where('authorizedUids', 'array-contains', uid));
    studentsSnap = await getDocs(q);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'students');
  }

  let assessmentsSnap;
  try {
    const q = isBootstrap
      ? collection(db, 'assessments')
      : query(collection(db, 'assessments'), where('authorizedUids', 'array-contains', uid));
    assessmentsSnap = await getDocs(q);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'assessments');
  }

  const schoolConfig = schoolsSnap.docs[0]
    ? (schoolsSnap.docs[0].data() as SchoolAdminConfig)
    : null;
  const students = studentsSnap.docs.map((d) => d.data() as StudentProfile);
  const assessments = assessmentsSnap.docs.map((d) => d.data() as FitnessAssessment);

  return { schoolConfig, students, assessments };
}

export async function deleteStudentsAndAssessmentsFromCloud(
  account: UserAccount | null,
  studentIds: string[],
  assessmentIds: string[]
): Promise<void> {
  if (!navigator.onLine || !canUserCloudSync(account)) return;
  const ops: Array<{ col: 'students' | 'assessments'; id: string }> = [
    ...studentIds.map((id) => ({ col: 'students' as const, id: sanitizeId(id, 'stu') })),
    ...assessmentIds.map((id) => ({ col: 'assessments' as const, id: sanitizeId(id, 'asm') })),
  ];
  for (let i = 0; i < ops.length; i += 350) {
    const batch = writeBatch(db);
    for (const item of ops.slice(i, i + 350)) {
      batch.delete(doc(db, item.col, item.id));
    }
    try {
      await batch.commit();
    } catch {
      // Ignore if docs were local-only and not yet synced to cloud
    }
  }
}
