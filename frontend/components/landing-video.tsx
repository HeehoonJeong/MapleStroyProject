"use client";

import { useEffect, useRef, useState } from "react";

export default function LandingVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { if (preference.matches) video.pause(); else void video.play().catch(() => setPlaying(false)); };
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);
  async function toggle() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) { try { await video.play(); } catch { setPlaying(false); } }
    else video.pause();
  }
  return <div className="landing-video-wrap">
    {failed ? <img className="landing-art" src="/assets/maple-intro-poster.webp" alt="메이플스토리 게임 플레이 장면" /> : <video ref={ref} className="landing-art" muted loop playsInline preload="none" poster="/assets/maple-intro-poster.webp" aria-label="메이플스토리 게임 플레이 영상" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)}><source src="/assets/maple-intro-lite.mp4" type="video/mp4" /></video>}
    {!failed && <button className="landing-video-control" type="button" onClick={toggle} aria-label={playing ? "영상 일시 정지" : "영상 재생"}>{playing ? "일시 정지" : "재생"}</button>}
  </div>;
}
