import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  FlipHorizontal2,
  Pause,
  Play,
  RotateCcw,
  Save,
  ShieldAlert,
  Square,
  Volume2,
  VolumeX,
  AlertCircle,
  Ruler,
} from 'lucide-react';
import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import type {
  EnduranceMode,
  FitnessAssessment,
  StudentProfile,
} from '../types/fitness';
import {
  calculateBmi,
  classifyBmi,
  evaluateEndurance,
  evaluateLongJump,
  evaluateOverallQd53,
  evaluateSitups,
  formatGradeLabel,
  formatSecondsToMinSec,
  getThreshold,
} from '../utils/qd53Standards';
import { createSafeId } from '../services/storageService';

type ActiveTestTab = 'situps' | 'long_jump' | 'endurance' | 'bmi';

interface Props {
  students: StudentProfile[];
  initialStudentId?: string;
  schoolYear: string;
  currentUid: string;
  canRecordTests: boolean;
  onSaveAssessment: (assessment: FitnessAssessment) => void;
}

const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [28, 30],
  [29, 31],
  [30, 32],
];

function computeAngleDeg(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark
): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magA = Math.hypot(abx, aby);
  const magC = Math.hypot(cbx, cby);
  if (magA === 0 || magC === 0) return 180;
  const cosVal = Math.max(-1, Math.min(1, dot / (magA * magC)));
  return Math.round((Math.acos(cosVal) * 180) / Math.PI);
}

interface ToneStep {
  freq: number;
  durationMs: number;
  delayMs?: number;
  type?: OscillatorType;
  gain?: number;
}

function playToneSequence(steps: ToneStep[]) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    let maxEndMs = 0;

    steps.forEach((step) => {
      const startSec = ctx.currentTime + (step.delayMs ?? 0) / 1000;
      const durSec = step.durationMs / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = step.type ?? 'sine';
      osc.frequency.setValueAtTime(step.freq, startSec);
      gain.gain.setValueAtTime(step.gain ?? 0.09, startSec);
      gain.gain.exponentialRampToValueAtTime(0.001, startSec + durSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startSec);
      osc.stop(startSec + durSec + 0.02);
      const endMs = (step.delayMs ?? 0) + step.durationMs + 50;
      if (endMs > maxEndMs) maxEndMs = endMs;
    });

    window.setTimeout(() => {
      void ctx.close();
    }, maxEndMs + 100);
  } catch {
    // Ignore audio context restrictions
  }
}

function playReadyChime() {
  playToneSequence([
    { freq: 587, durationMs: 90, delayMs: 0, type: 'sine', gain: 0.08 },
    { freq: 880, durationMs: 140, delayMs: 95, type: 'sine', gain: 0.1 },
  ]);
}

function playSuccessCue() {
  playToneSequence([
    { freq: 988, durationMs: 85, delayMs: 0, type: 'triangle', gain: 0.1 },
    { freq: 1318, durationMs: 130, delayMs: 90, type: 'triangle', gain: 0.11 },
  ]);
}

function playTimerEndAlarm() {
  playToneSequence([
    { freq: 660, durationMs: 180, delayMs: 0, type: 'square', gain: 0.08 },
    { freq: 660, durationMs: 180, delayMs: 240, type: 'square', gain: 0.08 },
    { freq: 880, durationMs: 320, delayMs: 480, type: 'square', gain: 0.09 },
  ]);
}

function playShakeWarningTone() {
  playToneSequence([
    { freq: 240, durationMs: 140, delayMs: 0, type: 'sawtooth', gain: 0.09 },
    { freq: 180, durationMs: 200, delayMs: 160, type: 'sawtooth', gain: 0.09 },
  ]);
}

export const CameraPoseTester: React.FC<Props> = ({
  students,
  initialStudentId,
  schoolYear,
  currentUid,
  canRecordTests,
  onSaveAssessment,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || students[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<ActiveTestTab>('situps');
  const [termLabel, setTermLabel] = useState('Giữa kỳ I');
  const [testedAt, setTestedAt] = useState(new Date().toISOString().slice(0, 10));

  // Camera & Pose Landmarker state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [cameraError, setCameraError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [deviceTiltDeg, setDeviceTiltDeg] = useState<number>(0);

  // Alignment & Distance Telemetry
  const [alignmentInfo, setAlignmentInfo] = useState<{
    poseDetected: boolean;
    distanceStatus: 'chuan' | 'qua_gan' | 'qua_xa' | 'thieu_khung';
    distanceLabel: string;
    angleTiltDeg: number;
    angleOk: boolean;
    bodyRatio: number;
  }>({
    poseDetected: false,
    distanceStatus: 'thieu_khung',
    distanceLabel: 'Đưa học sinh vào khung vạch chuẩn',
    angleTiltDeg: 0,
    angleOk: false,
    bodyRatio: 0,
  });

  // 4 Test Values (can be populated automatically by Camera AI OR fine-tuned manually)
  const [heightCm, setHeightCm] = useState<number>(165);
  const [weightKg, setWeightKg] = useState<number>(55);
  const [situpsCount, setSitupsCount] = useState<number>(0);
  const [longJumpCm, setLongJumpCm] = useState<number>(185);
  const [enduranceMode, setEnduranceMode] = useState<EnduranceMode>('5min_m');
  const [enduranceValue, setEnduranceValue] = useState<number>(920);
  const [usedCameraAi, setUsedCameraAi] = useState<boolean>(false);

  // Sit-ups live session state
  const [situpsRunning, setSitupsRunning] = useState(false);
  const [situpsTimeLeft, setSitupsTimeLeft] = useState(30);
  const situpPhaseRef = useRef<'down' | 'up'>('down');
  const situpsRunningRef = useRef(false);
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;
  situpsRunningRef.current = situpsRunning;

  // Long jump calibration state
  const [jumpSpanCm, setJumpSpanCm] = useState<number>(250); // Total ground ruler span visible in frame
  const [jumpStartNormX, setJumpStartNormX] = useState<number>(0.22);
  const [jumpTracking, setJumpTracking] = useState<boolean>(false);
  const jumpPeakXRef = useRef<number>(0.22);

  // Endurance camera gate + timer state
  const [enduranceRunning, setEnduranceRunning] = useState(false);
  const [enduranceElapsedSec, setEnduranceElapsedSec] = useState(0);
  const [enduranceLaps, setEnduranceLaps] = useState(0);
  const [lapLengthMeters, setLapLengthMeters] = useState(100);
  const lastGateCrossRef = useRef<number>(0);
  const prevHipXRef = useRef<number | null>(null);
  const enduranceRunningRef = useRef(false);
  enduranceRunningRef.current = enduranceRunning;

  // BMI Camera Height Calibration (known camera reference frame height in cm)
  const [bmiFrameHeightCm, setBmiFrameHeightCm] = useState<number>(210);
  const bmiReadyCueAtRef = useRef<number>(0);

  // Audio feedback & Anti-cheat shake detection state
  const [audioCueNotice, setAudioCueNotice] = useState<string>('');
  const wasAlignedReadyRef = useRef<boolean>(false);
  const lastReadyChimeAtRef = useRef<number>(0);

  const [shakeWarningActive, setShakeWarningActive] = useState<boolean>(false);
  const [shakeViolations, setShakeViolations] = useState<number>(0);
  const [shakeReason, setShakeReason] = useState<string>('');
  const shakeCooldownUntilRef = useRef<number>(0);
  const lastShakeBeepAtRef = useRef<number>(0);
  const prevAccelRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const prevOrientRef = useRef<{ beta: number; gamma: number; ts: number } | null>(null);
  const prevAnchorPosRef = useRef<{ hipX: number; hipY: number; ankleX: number; ankleY: number } | null>(null);
  const activeTabRef = useRef<ActiveTestTab>(activeTab);
  activeTabRef.current = activeTab;

  const [saveNotice, setSaveNotice] = useState('');

  const triggerCueBanner = useCallback((msg: string) => {
    setAudioCueNotice(msg);
    window.setTimeout(() => {
      setAudioCueNotice((cur) => (cur === msg ? '' : cur));
    }, 3200);
  }, []);

  const triggerShakeAlert = useCallback((reason: string) => {
    const now = Date.now();
    const alreadyCooling = now < shakeCooldownUntilRef.current;
    shakeCooldownUntilRef.current = now + 2500;
    setShakeWarningActive(true);
    setShakeReason(reason);
    if (!alreadyCooling) {
      setShakeViolations((v) => v + 1);
    }
    if (soundRef.current && now - lastShakeBeepAtRef.current > 1500) {
      lastShakeBeepAtRef.current = now;
      playShakeWarningTone();
    }
  }, []);

  useEffect(() => {
    if (!shakeWarningActive) return;
    const t = window.setInterval(() => {
      if (Date.now() >= shakeCooldownUntilRef.current) {
        setShakeWarningActive(false);
      }
    }, 300);
    return () => window.clearInterval(t);
  }, [shakeWarningActive]);

  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
    }
  }, [initialStudentId]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? students[0] ?? null,
    [students, selectedStudentId]
  );

  // Request optional iOS motion permission when user starts camera or test
  const requestMotionPermissionIfNeeded = useCallback(async () => {
    try {
      const dm = window.DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (dm && typeof dm.requestPermission === 'function') {
        await dm.requestPermission();
      }
    } catch {
      // Ignore permission errors on unsupported browsers
    }
  }, []);

  // Device orientation & DeviceMotion anti-cheat listeners
  useEffect(() => {
    const orientationHandler = (e: DeviceOrientationEvent) => {
      if (typeof e.gamma === 'number') {
        setDeviceTiltDeg(Math.round(Math.abs(e.gamma)));
      }
      if (activeTabRef.current === 'situps' && situpsRunningRef.current) {
        const beta = typeof e.beta === 'number' ? e.beta : 0;
        const gamma = typeof e.gamma === 'number' ? e.gamma : 0;
        const now = Date.now();
        if (prevOrientRef.current && now - prevOrientRef.current.ts <= 350) {
          const dBeta = Math.abs(beta - prevOrientRef.current.beta);
          const dGamma = Math.abs(gamma - prevOrientRef.current.gamma);
          if (dBeta > 12 || dGamma > 12) {
            triggerShakeAlert('Phát hiện xoay/lắc góc nghiêng điện thoại đột ngột khi kiểm tra gập bụng.');
          }
        }
        prevOrientRef.current = { beta, gamma, ts: now };
      } else {
        prevOrientRef.current = null;
      }
    };

    const motionHandler = (e: DeviceMotionEvent) => {
      if (activeTabRef.current !== 'situps' || !situpsRunningRef.current) {
        prevAccelRef.current = null;
        return;
      }

      const lin = e.acceleration;
      if (lin && typeof lin.x === 'number' && typeof lin.y === 'number' && typeof lin.z === 'number') {
        const mag = Math.hypot(lin.x, lin.y, lin.z);
        if (mag > 3.2) {
          triggerShakeAlert('Phát hiện rung/lắc điện thoại (cảm biến gia tốc vượt ngưỡng) — Tạm khóa đếm.');
          return;
        }
      }

      const accG = e.accelerationIncludingGravity;
      if (accG && typeof accG.x === 'number' && typeof accG.y === 'number' && typeof accG.z === 'number') {
        if (prevAccelRef.current) {
          const delta = Math.hypot(
            accG.x - prevAccelRef.current.x,
            accG.y - prevAccelRef.current.y,
            accG.z - prevAccelRef.current.z
          );
          if (delta > 4.2) {
            triggerShakeAlert('Phát hiện lắc thiết bị trong khi đếm gập bụng — Vui lòng đặt máy cố định!');
          }
        }
        prevAccelRef.current = { x: accG.x, y: accG.y, z: accG.z };
      }

      const rot = e.rotationRate;
      if (rot) {
        const rotMag = Math.hypot(rot.alpha ?? 0, rot.beta ?? 0, rot.gamma ?? 0);
        if (rotMag > 120) {
          triggerShakeAlert('Phát hiện xoay/rung lắc thiết bị — Đã tạm dừng cộng lượt gập bụng.');
        }
      }
    };

    window.addEventListener('deviceorientation', orientationHandler);
    window.addEventListener('devicemotion', motionHandler);
    return () => {
      window.removeEventListener('deviceorientation', orientationHandler);
      window.removeEventListener('devicemotion', motionHandler);
    };
  }, [triggerShakeAlert]);

  // Reset posture ready edge when switching test tab
  useEffect(() => {
    wasAlignedReadyRef.current = false;
    prevAnchorPosRef.current = null;
    setShakeWarningActive(false);
  }, [activeTab]);

  // Sit-ups 30s countdown timer
  useEffect(() => {
    if (!situpsRunning) return;
    const timer = window.setInterval(() => {
      setSitupsTimeLeft((prev) => {
        if (prev <= 1) {
          setSitupsRunning(false);
          if (soundRef.current) playTimerEndAlarm();
          triggerCueBanner('Hết thời gian 30 giây kiểm tra gập bụng!');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [situpsRunning, triggerCueBanner]);

  // Endurance stopwatch / 5-minute countdown
  useEffect(() => {
    if (!enduranceRunning) return;
    const timer = window.setInterval(() => {
      setEnduranceElapsedSec((prev) => {
        const next = prev + 1;
        if (enduranceMode === 'distance_s') {
          setEnduranceValue(next);
        } else if (next >= 300) {
          setEnduranceRunning(false);
          if (soundRef.current) playTimerEndAlarm();
          triggerCueBanner('Hết thời gian 5 phút chạy bền!');
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [enduranceRunning, enduranceMode, triggerCueBanner]);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, [stopCamera]);

  const ensureLandmarker = async (): Promise<PoseLandmarker | null> => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setModelStatus('loading');
    try {
      const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      let landmarker: PoseLandmarker;
      try {
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
      } catch {
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
      }
      landmarkerRef.current = landmarker;
      setModelStatus('ready');
      return landmarker;
    } catch {
      setModelStatus('fallback');
      return null;
    }
  };

  const drawAlignmentAndPose = useCallback(
    (landmarks: NormalizedLandmark[] | null, w: number, h: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      // 1. Vạch chuẩn căn chỉnh khung & góc độ (Grid + Framing Guides)
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      // Center vertical & horizontal crosshairs
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Framing margin box (distance guide)
      const topGuideY = h * 0.12;
      const bottomGuideY = h * 0.88;
      const leftGuideX = w * 0.16;
      const rightGuideX = w * 0.84;

      let angleTilt = deviceTiltDeg;
      let bodyRatio = 0;
      let poseDetected = false;
      let distanceStatus: 'chuan' | 'qua_gan' | 'qua_xa' | 'thieu_khung' = 'thieu_khung';
      let distanceLabel = 'Đưa toàn thân vào vùng vạch chuẩn';

      if (landmarks && landmarks.length >= 33) {
        poseDetected = true;
        const nose = landmarks[0];
        const lShoulder = landmarks[11];
        const rShoulder = landmarks[12];
        const lHip = landmarks[23];
        const rHip = landmarks[24];
        const lKnee = landmarks[25];
        const lAnkle = landmarks[27];
        const rAnkle = landmarks[28];

        const ys = landmarks
          .filter((lm) => (lm.visibility ?? 1) > 0.35)
          .map((lm) => lm.y);
        const minY = ys.length ? Math.min(...ys) : nose.y;
        const maxY = ys.length ? Math.max(...ys) : Math.max(lAnkle.y, rAnkle.y);
        bodyRatio = Math.max(0, Math.min(1, maxY - minY));

        const shoulderAngle = Math.abs(
          (Math.atan2((rShoulder.y - lShoulder.y) * h, (rShoulder.x - lShoulder.x) * w) * 180) /
            Math.PI
        );
        const normalizedTilt = Math.min(shoulderAngle, Math.abs(180 - shoulderAngle));
        angleTilt = deviceTiltDeg > 0 ? deviceTiltDeg : Math.round(normalizedTilt);

        const headCut = minY < 0.04;
        const feetCut = maxY > 0.96;

        if (headCut || feetCut) {
          distanceStatus = 'thieu_khung';
          distanceLabel = 'Chưa thấy đủ đầu/chân — Điều chỉnh góc máy';
        } else if (bodyRatio > 0.86) {
          distanceStatus = 'qua_gan';
          distanceLabel = 'Quá gần — Lùi camera ra xa hơn';
        } else if (bodyRatio < 0.45 && activeTab !== 'situps') {
          distanceStatus = 'qua_xa';
          distanceLabel = 'Quá xa — Đưa camera lại gần hơn';
        } else {
          distanceStatus = 'chuan';
          distanceLabel = 'Khoảng cách & khung hình đạt chuẩn';
        }

        // Draw skeleton connections
        ctx.setLineDash([]);
        ctx.strokeStyle = distanceStatus === 'chuan' ? '#10b981' : '#f59e0b';
        ctx.lineWidth = 3;
        for (const [i, j] of POSE_CONNECTIONS) {
          const p1 = landmarks[i];
          const p2 = landmarks[j];
          if ((p1.visibility ?? 1) > 0.35 && (p2.visibility ?? 1) > 0.35) {
            ctx.beginPath();
            ctx.moveTo(p1.x * w, p1.y * h);
            ctx.lineTo(p2.x * w, p2.y * h);
            ctx.stroke();
          }
        }

        // Draw key joints
        for (const idx of [0, 11, 12, 23, 24, 25, 26, 27, 28]) {
          const lm = landmarks[idx];
          if ((lm.visibility ?? 1) > 0.35) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(lm.x * w, lm.y * h, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0f766e';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }

        // Test-specific AI posture measurements
        if (activeTab === 'situps') {
          const torsoAngle = computeAngleDeg(lShoulder, lHip, lKnee);
          const hipCenterX = (lHip.x + rHip.x) / 2;
          const hipCenterY = (lHip.y + rHip.y) / 2;
          const ankleCenterX = (lAnkle.x + rAnkle.x) / 2;
          const ankleCenterY = (lAnkle.y + rAnkle.y) / 2;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
          ctx.fillRect(lHip.x * w + 10, lHip.y * h - 22, 92, 26);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 13px "JetBrains Mono", monospace';
          ctx.fillText(`${torsoAngle}°`, lHip.x * w + 18, lHip.y * h - 5);

          if (situpsRunningRef.current) {
            // Visual camera-shake anti-cheat check: if both hip & ankle anchor shift abruptly in unison
            if (prevAnchorPosRef.current) {
              const hipShift = Math.hypot(
                hipCenterX - prevAnchorPosRef.current.hipX,
                hipCenterY - prevAnchorPosRef.current.hipY
              );
              const ankleShift = Math.hypot(
                ankleCenterX - prevAnchorPosRef.current.ankleX,
                ankleCenterY - prevAnchorPosRef.current.ankleY
              );
              if (hipShift > 0.085 && ankleShift > 0.085) {
                triggerShakeAlert('Khung hình dịch chuyển đột ngột — Phát hiện lắc camera khi gập bụng!');
              }
            }
            prevAnchorPosRef.current = {
              hipX: hipCenterX,
              hipY: hipCenterY,
              ankleX: ankleCenterX,
              ankleY: ankleCenterY,
            };

            const shakeBlocked = Date.now() < shakeCooldownUntilRef.current;
            if (!shakeBlocked) {
              if (situpPhaseRef.current === 'down' && torsoAngle <= 75) {
                situpPhaseRef.current = 'up';
                setSitupsCount((c) => c + 1);
                setUsedCameraAi(true);
                if (soundRef.current) playSuccessCue();
                triggerCueBanner('Đạt tư thế gập bụng hợp lệ (+1 lần)');
              } else if (situpPhaseRef.current === 'up' && torsoAngle >= 120) {
                situpPhaseRef.current = 'down';
              }
            }
          } else {
            prevAnchorPosRef.current = null;
          }
        } else if (activeTab === 'long_jump') {
          const ankleX = (lAnkle.x + rAnkle.x) / 2;
          if (jumpTracking && ankleX > jumpPeakXRef.current) {
            jumpPeakXRef.current = ankleX;
            const normDelta = Math.max(0, ankleX - jumpStartNormX);
            const estimatedCm = Math.round((normDelta / (1 - jumpStartNormX)) * jumpSpanCm);
            setLongJumpCm(Math.min(350, Math.max(50, estimatedCm)));
            setUsedCameraAi(true);
          }
        } else if (activeTab === 'endurance') {
          const hipCenterX = (lHip.x + rHip.x) / 2;
          const gateX = 0.5;
          if (enduranceRunningRef.current && prevHipXRef.current !== null) {
            const crossed =
              (prevHipXRef.current < gateX && hipCenterX >= gateX) ||
              (prevHipXRef.current > gateX && hipCenterX <= gateX);
            const now = Date.now();
            if (crossed && now - lastGateCrossRef.current > 2500) {
              lastGateCrossRef.current = now;
              setEnduranceLaps((laps) => {
                const nextLaps = laps + 1;
                if (enduranceMode === '5min_m') {
                  setEnduranceValue(nextLaps * lapLengthMeters);
                }
                setUsedCameraAi(true);
                return nextLaps;
              });
              if (soundRef.current) playSuccessCue();
              triggerCueBanner('Đã ghi nhận 1 vòng chạy qua vạch đích');
            }
          }
          prevHipXRef.current = hipCenterX;
        } else if (activeTab === 'bmi') {
          // Estimate height from calibrated full-frame vertical span when alignment is chuẩn
          if (distanceStatus === 'chuan') {
            const estimatedH = Math.round(bodyRatio * bmiFrameHeightCm);
            if (estimatedH >= 135 && estimatedH <= 210) {
              setHeightCm(estimatedH);
              setUsedCameraAi(true);
              const now = Date.now();
              if (now - bmiReadyCueAtRef.current > 5000) {
                bmiReadyCueAtRef.current = now;
                if (soundRef.current) playSuccessCue();
                triggerCueBanner(`Đã đo chiều cao chuẩn: ${estimatedH} cm`);
              }
            }
          }
        }
      }

      // Draw framing reference lines (Green when chuẩn, Amber otherwise)
      const frameColor =
        poseDetected && distanceStatus === 'chuan' ? '#10b981' : '#f59e0b';
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = frameColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        leftGuideX,
        topGuideY,
        rightGuideX - leftGuideX,
        bottomGuideY - topGuideY
      );

      // Draw Test-specific Vạch chuẩn
      ctx.setLineDash([]);
      if (activeTab === 'situps') {
        // Horizontal mat baseline at bottom 82%
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(w * 0.1, h * 0.82);
        ctx.lineTo(w * 0.9, h * 0.82);
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.font = '600 11px "Be Vietnam Pro", sans-serif';
        ctx.fillText('VẠCH CHUẨN THẢM NẰM (Đặt camera ngang hông)', w * 0.11, h * 0.82 - 8);
      } else if (activeTab === 'long_jump') {
        const startPx = jumpStartNormX * w;
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(startPx, h * 0.2);
        ctx.lineTo(startPx, h * 0.92);
        ctx.stroke();
        ctx.fillStyle = '#f43f5e';
        ctx.font = '600 11px "Be Vietnam Pro", sans-serif';
        ctx.fillText('VẠCH XUẤT PHÁT (0 cm)', startPx + 6, h * 0.24);

        // Ground ruler baseline
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startPx, h * 0.86);
        ctx.lineTo(w * 0.94, h * 0.86);
        ctx.stroke();
      } else if (activeTab === 'endurance') {
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w * 0.5, h * 0.08);
        ctx.lineTo(w * 0.5, h * 0.92);
        ctx.stroke();
        ctx.fillStyle = '#f97316';
        ctx.font = '600 11px "Be Vietnam Pro", sans-serif';
        ctx.fillText('VẠCH ĐÍCH / CỔNG CẢM BIẾN VÒNG', w * 0.5 + 8, h * 0.14);
      } else if (activeTab === 'bmi') {
        ctx.fillStyle = frameColor;
        ctx.font = '600 11px "Be Vietnam Pro", sans-serif';
        ctx.fillText('VẠCH ĐỈNH ĐẦU', leftGuideX + 8, topGuideY - 6);
        ctx.fillText('VẠCH GÓT CHÂN', leftGuideX + 8, bottomGuideY + 15);
      }

      // Horizon tilt level bar at top-center
      const levelW = 120;
      const levelX = w / 2 - levelW / 2;
      const levelY = 18;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.fillRect(levelX, levelY, levelW, 20);
      ctx.strokeStyle = angleTilt <= 4 ? '#10b981' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(levelX + 12, levelY + 10);
      ctx.lineTo(levelX + levelW - 12, levelY + 10);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillText(`GÓC: ${angleTilt}°`, levelX + 34, levelY + 14);

      // Anti-cheat warning overlay inside video canvas when shaking detected
      if (activeTab === 'situps' && Date.now() < shakeCooldownUntilRef.current) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = 'rgba(185, 28, 28, 0.88)';
        ctx.fillRect(w * 0.12, 48, w * 0.76, 34);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px "Be Vietnam Pro", sans-serif';
        ctx.fillText('CẢNH BÁO CHỐNG GIAN LẬN: PHÁT HIỆN LẮC ĐIỆN THOẠI!', w * 0.15, 70);
      }

      ctx.restore();

      const angleOk = angleTilt <= 5;
      const isAlignedReady = poseDetected && distanceStatus === 'chuan' && angleOk;
      if (isAlignedReady && !wasAlignedReadyRef.current) {
        const now = Date.now();
        if (now - lastReadyChimeAtRef.current > 4000) {
          lastReadyChimeAtRef.current = now;
          if (soundRef.current) playReadyChime();
          triggerCueBanner('Đúng vị trí & tư thế kiểm tra — Sẵn sàng thực hiện!');
        }
      }
      wasAlignedReadyRef.current = isAlignedReady;

      setAlignmentInfo({
        poseDetected,
        distanceStatus,
        distanceLabel,
        angleTiltDeg: angleTilt,
        angleOk,
        bodyRatio: Math.round(bodyRatio * 100),
      });
    },
    [
      activeTab,
      bmiFrameHeightCm,
      deviceTiltDeg,
      enduranceMode,
      jumpSpanCm,
      jumpStartNormX,
      jumpTracking,
      lapLengthMeters,
      triggerCueBanner,
      triggerShakeAlert,
    ]
  );

  const startCamera = async (overrideFacing?: 'environment' | 'user') => {
    setCameraError('');
    await requestMotionPermissionIfNeeded();
    stopCamera();
    const targetFacing = overrideFacing ?? facingMode;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Trình duyệt không hỗ trợ truy cập Camera. Vui lòng sử dụng chế độ nhập kết quả trực tiếp.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: targetFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      const landmarker = await ensureLandmarker();

      let lastVideoTime = -1;
      const detectFrame = () => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;
        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 480;

        if (video.readyState >= 2 && landmarker) {
          if (video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            try {
              const result = landmarker.detectForVideo(video, performance.now());
              drawAlignmentAndPose(result.landmarks?.[0] ?? null, vw, vh);
            } catch {
              drawAlignmentAndPose(null, vw, vh);
            }
          }
        } else {
          drawAlignmentAndPose(null, vw, vh);
        }
        rafRef.current = requestAnimationFrame(detectFrame);
      };
      rafRef.current = requestAnimationFrame(detectFrame);
    } catch {
      setCameraError(
        'Không thể mở Camera (chưa cấp quyền hoặc thiết bị không có camera). Bạn vẫn có thể điều chỉnh thông số trực tiếp ở bảng bên cạnh.'
      );
      setCameraActive(false);
    }
  };

  const handleToggleCameraFacing = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    if (cameraActive) {
      void startCamera(next);
    }
  };

  // Live evaluation preview for selected student
  const evalAge = selectedStudent?.age ?? 16;
  const evalGender = selectedStudent?.gender ?? 'nam';
  const threshold = getThreshold(evalAge, evalGender);
  const bmi = calculateBmi(heightCm, weightKg);
  const bmiEval = classifyBmi(bmi, evalAge);
  const situpsGrade = evaluateSitups(situpsCount, evalAge, evalGender);
  const longJumpGrade = evaluateLongJump(longJumpCm, evalAge, evalGender);
  const enduranceGrade = evaluateEndurance(enduranceValue, enduranceMode, evalAge, evalGender);
  const overallGrade = evaluateOverallQd53(situpsGrade, longJumpGrade, enduranceGrade);

  const handleSaveResult = () => {
    if (!selectedStudent) return;
    onSaveAssessment({
      id: createSafeId('asm'),
      studentId: selectedStudent.id,
      schoolId: selectedStudent.schoolId,
      termLabel: termLabel.trim() || 'Kiểm tra định kỳ',
      schoolYear,
      testedAt,
      ageAtTest: selectedStudent.age,
      gender: selectedStudent.gender,
      heightCm,
      weightKg,
      bmi,
      bmiCategory: bmiEval.category,
      situpsCount,
      situpsGrade,
      longJumpCm,
      longJumpGrade,
      enduranceMode,
      enduranceValue,
      enduranceGrade,
      overallGrade,
      captureMethod: usedCameraAi ? 'camera_ai' : 'manual',
      status: 'draft',
      recordedByUid: currentUid,
      authorizedUids: selectedStudent.authorizedUids.length
        ? selectedStudent.authorizedUids
        : [currentUid],
    });
    setSaveNotice(`Đã lưu kết quả đánh giá cho ${selectedStudent.fullName} (${formatGradeLabel(overallGrade)}).`);
    setTimeout(() => setSaveNotice(''), 4000);
  };

  const gradeColor = (g: 'tot' | 'dat' | 'chua_dat') =>
    g === 'tot' ? 'text-emerald-700' : g === 'dat' ? 'text-amber-700' : 'text-rose-700';

  if (students.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
        <Camera className="w-10 h-10 text-slate-400 mx-auto" />
        <h3 className="text-base font-semibold text-slate-900">Chưa có danh sách học sinh</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Hãy thêm học sinh thủ công hoặc nhập từ tệp Excel ở mục Học sinh trước khi tiến hành kiểm tra bằng Camera AI.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Student & Session Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block text-xs">
          <span className="font-medium text-slate-600">Học sinh đang kiểm tra</span>
          <select
            value={selectedStudent?.id || ''}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[44px]"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} · {s.className} ({s.gender === 'nam' ? 'Nam' : 'Nữ'}, {s.age}t)
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="font-medium text-slate-600">Đợt kiểm tra</span>
          <input
            type="text"
            value={termLabel}
            onChange={(e) => setTermLabel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[44px]"
          />
        </label>
        <label className="block text-xs">
          <span className="font-medium text-slate-600">Ngày thực hiện</span>
          <input
            type="date"
            value={testedAt}
            onChange={(e) => setTestedAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono min-h-[44px]"
          />
        </label>
      </div>

      {/* Main Split: Camera Viewport + Scoring Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Camera Pose Viewport */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Test Mode Tabs */}
          <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto max-w-full">
              {(
                [
                  ['situps', 'Gập bụng 30s'],
                  ['long_jump', 'Bật xa tại chỗ'],
                  ['endurance', 'Chạy bền'],
                  ['bmi', 'Đo chiều cao & BMI'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 min-h-[38px] ${
                    activeTab === key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => (cameraActive ? stopCamera() : void startCamera())}
                className={`min-h-[40px] px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                  cameraActive
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    : 'bg-teal-700 text-white hover:bg-teal-800'
                }`}
              >
                <Camera className="w-3.5 h-3.5 shrink-0" />
                <span>{cameraActive ? 'Tắt Camera' : 'Bật Camera'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSoundEnabled((v) => !v)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                title={soundEnabled ? 'Tắt âm báo' : 'Bật âm báo'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handleToggleCameraFacing}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                title="Đổi camera trước / sau"
              >
                <FlipHorizontal2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Camera Feed & Canvas Alignment Overlay */}
          <div
            className={`relative bg-slate-950 w-full overflow-hidden flex items-center justify-center ${
              cameraActive ? 'aspect-[4/3] sm:aspect-video' : 'min-h-[260px] sm:aspect-video'
            }`}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            />
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${
                cameraActive ? 'block' : 'hidden'
              }`}
            />

            {!cameraActive && (
              <div className="text-center p-4 sm:p-6 space-y-2.5 sm:space-y-3 max-w-md">
                <Camera className="w-9 h-9 sm:w-10 sm:h-10 text-teal-400 mx-auto" />
                <div className="text-sm font-medium text-white">
                  Camera nhận diện tư thế &amp; vạch chuẩn căn chỉnh
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Tự động nhận diện khung xương (33 điểm khớp), cảnh báo khoảng cách quá gần/quá xa,
                  vạch cân bằng góc nghiêng và tự động đếm bài tập theo thời gian thực.
                </p>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 rounded-xl min-h-[44px]"
                >
                  <Camera className="w-4 h-4" />
                  Bật Camera AI
                </button>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200 text-xs text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {shakeWarningActive && activeTab === 'situps' && (
            <div className="px-4 py-3 bg-rose-50 border-t border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-700" />
                <span>
                  {shakeReason || 'Cảnh báo chống gian lận: Phát hiện lắc điện thoại — Đã tạm khóa đếm gập bụng.'}
                </span>
              </div>
              <span className="font-mono tabular-nums text-[11px] font-semibold text-rose-700 shrink-0">
                Vi phạm: {shakeViolations}
              </span>
            </div>
          )}

          {audioCueNotice && (
            <div className="px-4 py-2.5 bg-teal-50 border-t border-teal-200 text-xs text-teal-800 flex items-center gap-2 font-medium">
              <Volume2 className="w-4 h-4 shrink-0 text-teal-700" />
              <span>{audioCueNotice}</span>
            </div>
          )}

          {/* Alignment & Calibration Status Strip */}
          <div className="p-4 border-t border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`font-semibold ${
                    alignmentInfo.distanceStatus === 'chuan' && alignmentInfo.angleOk
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }`}
                >
                  {cameraActive
                    ? alignmentInfo.distanceStatus === 'chuan' && alignmentInfo.angleOk
                      ? 'Đúng vị trí & tư thế chuẩn — Sẵn sàng'
                      : alignmentInfo.distanceLabel
                    : 'Chưa bật camera (đang dùng chế độ nhập trực tiếp)'}
                </span>
              </div>
              <div className="font-mono tabular-nums text-slate-500">
                Góc nghiêng: {alignmentInfo.angleTiltDeg}° · Tỷ lệ khung: {alignmentInfo.bodyRatio}% ·{' '}
                {modelStatus === 'loading'
                  ? 'Đang tải AI tư thế...'
                  : modelStatus === 'ready'
                    ? 'AI Tư thế sẵn sàng'
                    : modelStatus === 'fallback'
                      ? 'Chế độ vạch chuẩn thủ công'
                      : 'Chờ khởi tạo'}
              </div>
            </div>

            {/* Test-Specific Controls Under Camera */}
            {activeTab === 'situps' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-[11px] text-slate-500">Đồng hồ 30 giây</div>
                      <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                        00:{situpsTimeLeft.toString().padStart(2, '0')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Số lần đếm AI</div>
                      <div className="text-xl font-bold font-mono tabular-nums text-teal-700">
                        {situpsCount} lần
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void requestMotionPermissionIfNeeded();
                        if (!situpsRunning && situpsTimeLeft === 0) setSitupsTimeLeft(30);
                        setSitupsRunning((r) => !r);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg min-h-[42px]"
                    >
                      {situpsRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {situpsRunning ? 'Tạm dừng' : 'Bắt đầu đếm 30s'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSitupsRunning(false);
                        setSitupsTimeLeft(30);
                        setSitupsCount(0);
                        setShakeViolations(0);
                        setShakeWarningActive(false);
                        shakeCooldownUntilRef.current = 0;
                        prevAnchorPosRef.current = null;
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg min-h-[42px]"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Đặt lại
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
                  <span>
                    Chống gian lận: Tự động khóa đếm nếu phát hiện lắc điện thoại hoặc dịch chuyển khung hình đột ngột.
                  </span>
                  {shakeViolations > 0 && (
                    <span className="font-mono text-rose-700 font-medium shrink-0 ml-2">
                      Cảnh báo lắc: {shakeViolations} lần
                    </span>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'long_jump' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-700">
                    <Ruler className="w-3.5 h-3.5 inline mr-1" />
                    Thước chuẩn ngang khung: <strong className="font-mono">{jumpSpanCm} cm</strong> · Vạch
                    xuất phát: <strong className="font-mono">{Math.round(jumpStartNormX * 100)}%</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={jumpTracking}
                      onClick={() => {
                        jumpPeakXRef.current = jumpStartNormX;
                        setJumpTracking(true);
                        if (soundRef.current) playReadyChime();
                        triggerCueBanner('Đang theo dõi cú bật xa tại chỗ...');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg min-h-[40px] bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-45"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Start
                    </button>
                    <button
                      type="button"
                      disabled={!jumpTracking}
                      onClick={() => {
                        setJumpTracking(false);
                        if (soundRef.current) playSuccessCue();
                        triggerCueBanner(`Đã kết thúc kiểm tra bật xa: ${longJumpCm} cm`);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg min-h-[40px] bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-40"
                    >
                      <Square className="w-3.5 h-3.5" />
                      STOP
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="block">
                    <span className="text-slate-600">Hiệu chỉnh chiều dài vùng nhìn (cm):</span>
                    <input
                      type="range"
                      min="180"
                      max="350"
                      value={jumpSpanCm}
                      onChange={(e) => setJumpSpanCm(Number(e.target.value))}
                      className="w-full mt-1"
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-600">Vị trí vạch xuất phát trên khung:</span>
                    <input
                      type="range"
                      min="10"
                      max="40"
                      value={Math.round(jumpStartNormX * 100)}
                      onChange={(e) => setJumpStartNormX(Number(e.target.value) / 100)}
                      className="w-full mt-1"
                    />
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'endurance' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-[11px] text-slate-500">Thời gian chạy</div>
                    <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                      {formatSecondsToMinSec(enduranceElapsedSec)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Số vòng qua vạch</div>
                    <div className="text-xl font-bold font-mono tabular-nums text-teal-700">
                      {enduranceLaps} vòng
                    </div>
                  </div>
                  <label className="text-xs">
                    <span className="text-slate-500 block">Chiều dài 1 vòng (m)</span>
                    <input
                      type="number"
                      min="20"
                      max="400"
                      value={lapLengthMeters}
                      onChange={(e) => setLapLengthMeters(Math.max(20, Number(e.target.value) || 100))}
                      className="mt-0.5 w-20 rounded border border-slate-300 bg-white px-2 py-1 font-mono"
                    />
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEnduranceRunning((r) => !r)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg min-h-[42px]"
                  >
                    {enduranceRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {enduranceRunning ? 'Dừng đồng hồ' : 'Bắt đầu chạy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEnduranceRunning(false);
                      setEnduranceElapsedSec(0);
                      setEnduranceLaps(0);
                    }}
                    className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg min-h-[42px]"
                  >
                    Đặt lại
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'bmi' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  Chiều cao khung chuẩn (từ vạch gót đến đỉnh khung):{' '}
                  <strong className="font-mono">{bmiFrameHeightCm} cm</strong>
                </div>
                <input
                  type="range"
                  min="180"
                  max="250"
                  value={bmiFrameHeightCm}
                  onChange={(e) => setBmiFrameHeightCm(Number(e.target.value))}
                  className="w-48"
                />
              </div>
            )}

            {cameraActive && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="text-xs text-slate-500 hover:text-rose-700 underline py-1"
                >
                  Tắt Camera
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Real-time Scoring & QĐ 53/2008 Evaluation */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Tổng hợp chỉ số &amp; Xếp loại QĐ 53/2008
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chuẩn áp dụng: {evalGender === 'nam' ? 'Nam' : 'Nữ'} · {evalAge} tuổi
            </p>
          </div>

          {/* BMI Auto Calculator */}
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">1. Chỉ số khối cơ thể (BMI)</span>
              <span className="text-sm font-bold font-mono tabular-nums text-teal-700">
                {bmi} kg/m² · {bmiEval.category}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs">
                <span className="text-slate-600">Chiều cao (cm)</span>
                <input
                  type="number"
                  step="0.5"
                  min="100"
                  max="230"
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
                />
              </label>
              <label className="block text-xs">
                <span className="text-slate-600">Cân nặng (kg)</span>
                <input
                  type="number"
                  step="0.5"
                  min="20"
                  max="180"
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">{bmiEval.advice}</p>
          </div>

          {/* 3 Core Fitness Tests */}
          <div className="space-y-3">
            <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">2. Nằm ngửa gập bụng (30s)</span>
                <span className={`font-semibold ${gradeColor(situpsGrade)}`}>
                  {formatGradeLabel(situpsGrade)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={situpsCount}
                  onChange={(e) => setSitupsCount(Math.max(0, Number(e.target.value)))}
                  className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
                />
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  Chuẩn: Tốt ≥ {threshold.situps.tot} · Đạt ≥ {threshold.situps.dat} lần
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">3. Bật xa tại chỗ (cm)</span>
                <span className={`font-semibold ${gradeColor(longJumpGrade)}`}>
                  {formatGradeLabel(longJumpGrade)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="450"
                  value={longJumpCm}
                  onChange={(e) => setLongJumpCm(Math.max(0, Number(e.target.value)))}
                  className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
                />
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  Chuẩn: Tốt ≥ {threshold.longJump.tot} · Đạt ≥ {threshold.longJump.dat} cm
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">4. Chạy bền</span>
                <span className={`font-semibold ${gradeColor(enduranceGrade)}`}>
                  {formatGradeLabel(enduranceGrade)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={enduranceMode}
                  onChange={(e) => setEnduranceMode(e.target.value as EnduranceMode)}
                  className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs min-h-[42px]"
                >
                  <option value="5min_m">Tùy sức 5 phút (m)</option>
                  <option value="distance_s">
                    {evalGender === 'nam' ? 'Cự ly 1000m (giây)' : 'Cự ly 800m (giây)'}
                  </option>
                </select>
                <input
                  type="number"
                  min="0"
                  max="5000"
                  value={enduranceValue}
                  onChange={(e) => setEnduranceValue(Math.max(0, Number(e.target.value)))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono min-h-[42px]"
                />
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                {enduranceMode === '5min_m'
                  ? `Chuẩn: Tốt ≥ ${threshold.endurance5Min.tot}m · Đạt ≥ ${threshold.endurance5Min.dat}m`
                  : `Chuẩn: Tốt ≤ ${formatSecondsToMinSec(threshold.enduranceDistanceSec.totMaxSec)} · Đạt ≤ ${formatSecondsToMinSec(threshold.enduranceDistanceSec.datMaxSec)}`}
              </div>
            </div>
          </div>

          {/* Overall Classification */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">Xếp loại chung (Điều 5, QĐ 53/2008)</div>
              <div className={`text-lg font-bold mt-0.5 ${gradeColor(overallGrade)}`}>
                {formatGradeLabel(overallGrade)}
              </div>
            </div>
            <button
              type="button"
              disabled={!canRecordTests}
              onClick={handleSaveResult}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 rounded-xl min-h-[44px] whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              Lưu kết quả
            </button>
          </div>

          {saveNotice && (
            <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{saveNotice}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
