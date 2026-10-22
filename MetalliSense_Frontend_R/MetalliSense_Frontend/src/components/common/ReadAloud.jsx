import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Volume2, Square } from "lucide-react";
import { CrucibleIcon } from "./FurnaceLoader";
import toast from "react-hot-toast";
import { synthesizeSpeechWithMeta } from "../../services/copilotService";

/**
 * "Read aloud" button — speaks `text` through the Agent service's TTS
 * endpoint (ElevenLabs, with gTTS fallback server-side). If the Agent
 * service is down, falls back to the browser's built-in speech engine.
 *
 * `text` may be a string or a function returning a string (built lazily
 * at click time so it always reflects the latest data).
 */
export default function ReadAloud({ text, label = "Read aloud", className, variant = "light" }) {
  const [state, setState] = useState("idle"); // idle | loading | playing
  const [provider, setProvider] = useState(null);
  const audioRef = useRef(null);
  const urlRef = useRef(null);

  const cleanup = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    try { window.speechSynthesis?.cancel(); } catch { /* not supported */ }
  };
  useEffect(() => cleanup, []);

  const stop = () => { cleanup(); setState("idle"); };

  const speakWithBrowser = (t) => {
    if (!("speechSynthesis" in window)) throw new Error("No speech engine available");
    const u = new SpeechSynthesisUtterance(t);
    u.rate = 1; u.lang = "en-IN";
    u.onend = () => setState("idle");
    u.onerror = () => setState("idle");
    window.speechSynthesis.speak(u);
    setProvider("browser");
    setState("playing");
  };

  const play = async () => {
    const t = (typeof text === "function" ? text() : text || "").trim();
    if (!t) return;
    cleanup();
    if (import.meta.env.VITE_MOCK_MODE === 'true') {
      try { speakWithBrowser(t); } catch { setState('idle'); toast.error('Speech synthesis is unavailable in this browser'); }
      return;
    }
    setState("loading");
    try {
      const { blob, provider: p } = await synthesizeSpeechWithMeta(t.slice(0, 4800));
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setState("idle");
      audio.onerror = () => setState("idle");
      await audio.play();
      setProvider(p);
      setState("playing");
    } catch (err) {
      console.warn("Server TTS failed, using browser voice:", err);
      try {
        speakWithBrowser(t);
        toast("Voice service offline — using browser voice", { icon: "🔈" });
      } catch {
        setState("idle");
        toast.error("Could not play audio");
      }
    }
  };

  const dark = variant === "dark";
  return (
    <button
      type="button"
      onClick={state === "idle" ? play : stop}
      className={clsx(
        "inline-flex items-center gap-2 rounded-full pl-2.5 pr-3.5 py-1.5 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
        dark
          ? "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20"
          : "bg-white text-metal-800 ring-1 ring-metal-200 shadow-sm hover:ring-primary-300 hover:text-primary-700",
        state === "playing" && (dark ? "bg-white/25" : "ring-primary-400 text-primary-700"),
        className
      )}
      aria-label={state === "idle" ? label : "Stop reading"}
    >
      <span className={clsx("grid place-items-center w-5 h-5 rounded-full", dark ? "bg-white/15" : "bg-primary-50 text-primary-600")}>
        {state === "loading" ? <CrucibleIcon size={13} /> : state === "playing" ? <Square size={10} fill="currentColor" /> : <Volume2 size={12} />}
      </span>
      {state === "loading" ? "Preparing voice…" : state === "playing" ? "Stop" : label}
      {state === "playing" && (
        <span className="flex items-end gap-0.5 h-3" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={clsx("w-0.5 rounded-full animate-pulse", dark ? "bg-white" : "bg-primary-500")} style={{ height: `${40 + ((i * 37) % 60)}%`, animationDelay: `${i * 120}ms` }} />
          ))}
        </span>
      )}
      {provider && state === "playing" && (
        <span className={clsx("text-[10px] font-medium uppercase tracking-wide", dark ? "text-white/60" : "text-metal-400")}>
          {provider === "elevenlabs" ? "ElevenLabs" : provider === "gtts" ? "gTTS" : provider}
        </span>
      )}
    </button>
  );
}
