import { AppLayout } from "@/components/AppLayout";
import { API_BASE } from "@/lib/api";
import { AppSettings, loadSettings } from "@/lib/settings";
import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, Square, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface DetectionBox {
  id: string;
  label: string;
  confidence: number;
  found: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

type DetectionResponse = {
  detections?: DetectionBox[];
  missing?: string[];
  required?: string[];
  settings_used?: {
    sensitivity: number;
    sensitivityLevel: string;
    recordViolations: boolean;
  };
};

export default function LiveDetection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraSessionRef = useRef<string | null>(null);
  const allowViolationLogRef = useRef(true);
  const requestInFlightRef = useRef(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [detections, setDetections] = useState<DetectionBox[]>([]);
  const [missingItems, setMissingItems] = useState<string[]>([]);
  const [requiredItems, setRequiredItems] = useState<string[]>([]);
  const [settingsUsed, setSettingsUsed] = useState<DetectionResponse["settings_used"] | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [, setViewportVersion] = useState(0);
  const speakerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    const handleResize = () => setViewportVersion((value) => value + 1);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const syncSettings = async () => {
      try {
        const res = await fetch(`${API_BASE}/settings`);
        if (!res.ok) return;
        const data = await res.json();
        setSettings((prev) => ({ ...prev, ...data }));
      } catch {}
    };

    const handleStorage = () => setSettings(loadSettings());
    window.addEventListener("storage", handleStorage);
    syncSettings();

    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const sendFrameToBackend = useCallback(async () => {
    if (!videoRef.current || requestInFlightRef.current) return;
    requestInFlightRef.current = true;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx?.drawImage(videoRef.current, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg")
    );

    if (!blob) {
      requestInFlightRef.current = false;
      return;
    }

    const formData = new FormData();
    formData.append("image", blob, "frame.jpg");
    formData.append("settings", JSON.stringify(settings));
    if (cameraSessionRef.current) {
      formData.append("cameraSessionId", cameraSessionRef.current);
    }
    formData.append("allowViolationLog", String(allowViolationLogRef.current));

    try {
      const res = await fetch(`${API_BASE}/detect`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let message = "Detection request failed";
        try {
          const payload = await res.json();
          message = payload.error || payload.details || message;
        } catch {}
        throw new Error(message);
      }
      const data: DetectionResponse = await res.json();
      setDetections(data.detections ?? []);
      setMissingItems(data.missing ?? []);
      setRequiredItems(data.required ?? []);
      setSettingsUsed(data.settings_used ?? null);
      if ((data.missing ?? []).length > 0) {
        allowViolationLogRef.current = false;
      }
      setError("");
    } catch (err) {
      console.error("Backend error:", err);
      setError(err instanceof Error ? err.message : "Could not reach detection backend.");
    } finally {
      requestInFlightRef.current = false;
    }
  }, [settings]);

  useEffect(() => {
    if (speakerOn && cameraActive && missingItems.length > 0) {
      const speak = () => {
        const violations = missingItems.join(", ");
        const text = violations
          ? `Warning! Violations detected: ${violations}`
          : "All PPE compliance met.";

        const utterance = new SpeechSynthesisUtterance(text);
        speechSynthesis.speak(utterance);
      };

      speak();
      speakerInterval.current = setInterval(speak, 10000);

      return () => {
        if (speakerInterval.current) clearInterval(speakerInterval.current);
        speechSynthesis.cancel();
      };
    }
  }, [speakerOn, cameraActive, missingItems]);

  const toggleSpeaker = () => setSpeakerOn((prev) => !prev);

  const startCamera = useCallback(async () => {
    try {
      cameraSessionRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      allowViolationLogRef.current = true;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: isMobile ? { facingMode: "environment" } : true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setError("");

        if (detectInterval.current) clearInterval(detectInterval.current);
        sendFrameToBackend();
        detectInterval.current = setInterval(sendFrameToBackend, 2000);
      }
    } catch {
      setError("Camera access denied.");
    }
  }, [isMobile, sendFrameToBackend]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }

    if (detectInterval.current) clearInterval(detectInterval.current);
    setCameraActive(false);
    setDetections([]);
    setMissingItems([]);
    setRequiredItems([]);
    setSpeakerOn(false);
    allowViolationLogRef.current = true;
    requestInFlightRef.current = false;

    const sessionId = cameraSessionRef.current;
    cameraSessionRef.current = null;
    if (sessionId) {
      fetch(`${API_BASE}/camera-session/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cameraSessionId: sessionId }),
      }).catch(() => {});
    }
  }, []);

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      await el.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const formattedTimestamp = currentTime.toLocaleString("en-US");

  const getDisplayBox = (det: DetectionBox) => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || !video.videoWidth || !video.videoHeight) {
      return det;
    }

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const scale = Math.max(
      containerWidth / video.videoWidth,
      containerHeight / video.videoHeight,
    );
    const renderedWidth = video.videoWidth * scale;
    const renderedHeight = video.videoHeight * scale;
    const offsetX = (containerWidth - renderedWidth) / 2;
    const offsetY = (containerHeight - renderedHeight) / 2;

    return {
      ...det,
      x: ((det.x / 100) * renderedWidth + offsetX) / containerWidth * 100,
      y: ((det.y / 100) * renderedHeight + offsetY) / containerHeight * 100,
      w: ((det.w / 100) * renderedWidth) / containerWidth * 100,
      h: ((det.h / 100) * renderedHeight) / containerHeight * 100,
    };
  };

  return (
    <AppLayout title="Live Detection" subtitle="PPE Detection">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div
            ref={containerRef}
            className={`relative overflow-hidden w-full flex items-center justify-center ${
              isFullscreen
                ? "h-screen rounded-none bg-black border-0"
                : "h-[62vh] rounded-[10px] bg-white border border-slate-200"
            }`}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              onLoadedMetadata={() => setViewportVersion((value) => value + 1)}
              className={`block bg-black object-cover ${
                isFullscreen ? "w-screen h-screen" : "w-full h-full"
              }`}
            />

            <div className="absolute top-4 left-4 bg-white rounded-full px-3 py-1.5 text-xs font-semibold text-emerald-600 shadow-sm">
              <span className="inline-flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${cameraActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                {cameraActive ? "LIVE" : "READY"}
              </span>
            </div>

            {detections.map((det) => {
              const displayBox = getDisplayBox(det);
              return (
                <div
                  key={det.id}
                className={`absolute border-2 ${det.label.startsWith("NO-") ? "border-red-500" : "border-emerald-500"}`}
                style={{
                  left: `${displayBox.x}%`,
                  top: `${displayBox.y}%`,
                  width: `${displayBox.w}%`,
                  height: `${displayBox.h}%`,
                }}
              >
                <span className={`${det.label.startsWith("NO-") ? "bg-red-500 text-white" : "bg-emerald-500 text-white"} text-xs px-1`}>
                  {det.label} {det.confidence.toFixed(0)}%
                </span>
              </div>
              );
            })}

            {!cameraActive && (
              <button onClick={startCamera} className="absolute inset-0 m-auto bg-white text-black border-2 border-blue-500 px-5 py-3 rounded-lg shadow-lg w-auto h-auto">
                <span className="inline-flex items-center gap-2">
                  <Camera /> Start Camera
                </span>
              </button>
            )}

            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button onClick={toggleSpeaker} className="text-slate-500 bg-white rounded-xl p-2 shadow-sm">
                {speakerOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>

              <button onClick={toggleFullscreen} className="text-slate-500 bg-white rounded-xl p-2 shadow-sm">
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
            </div>

            <div className="absolute bottom-4 right-4 text-slate-500 text-xs bg-slate-100/95 px-3 py-2 rounded-xl shadow-sm">
              {formattedTimestamp}
            </div>

            {missingItems.length > 0 && (
              <div className="absolute bottom-4 left-4 bg-red-600/90 text-white text-xs px-3 py-2 rounded-xl shadow-sm">
                Missing: {missingItems.join(", ")}
              </div>
            )}

            {error && (
              <div className="absolute top-16 left-4 bg-red-700/90 text-white text-xs px-3 py-2 rounded-xl shadow-sm">
                {error}
              </div>
            )}

            {cameraActive && (
              <button onClick={stopCamera} className="absolute bottom-4 left-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-sm text-sm">
                <span className="inline-flex items-center gap-2">
                  <Square className="h-4 w-4" /> Stop
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-foreground">Detection Rules</h3>
            <p className="text-sm text-muted-foreground">
              Required PPE: {requiredItems.length > 0 ? requiredItems.join(", ") : "None selected"}
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground">Live Status</h3>
            <p className="text-sm text-muted-foreground">
              Current result: {missingItems.length > 0 ? `Violation - ${missingItems.join(", ")}` : "Compliant"}
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground">Settings Applied</h3>
            <p className="text-sm text-muted-foreground">
              Sensitivity: {settingsUsed?.sensitivity ?? settings.sensitivity}%
            </p>
            <p className="text-sm text-muted-foreground">
              Mode: {settingsUsed?.sensitivityLevel ?? settings.sensitivityLevel}
            </p>
            <p className="text-sm text-muted-foreground">
              Save screenshots: {(settingsUsed?.recordViolations ?? settings.recordViolations) ? "On" : "Off"}
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground">Detected Labels</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {detections.length === 0 ? (
                <span className="text-sm text-muted-foreground">No detections yet</span>
              ) : (
                detections.map((det) => (
                  <span
                    key={det.id}
                    className={`px-2 py-1 rounded text-xs ${det.label.startsWith("NO-") ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}
                  >
                    {det.label}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
