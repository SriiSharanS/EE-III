import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

const VIDEO_SOURCE =
  'https://stream.mux.com/tLkHO1qZoaaQOUeVWo8hEBeGQfySP02EPS02BmnNFyXys.m3u8';

export default function CinematicBackground() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const isSafariNativeHls =
      typeof navigator !== 'undefined' &&
      /Safari/.test(navigator.userAgent) &&
      !/Chrome|Chromium|Android/.test(navigator.userAgent) &&
      video.canPlayType('application/vnd.apple.mpegurl') !== '';

    if (isSafariNativeHls) {
      video.src = VIDEO_SOURCE;
      video.load();
      void video.play().catch(() => undefined);
      return;
    }

    if (!Hls.isSupported()) {
      return;
    }

    const hls = new Hls({ enableWorker: false });

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      void video.play().catch(() => undefined);
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        video.style.opacity = '0';
      }
    });

    hls.loadSource(VIDEO_SOURCE);
    hls.attachMedia(video);

    return () => {
      hls.off(Hls.Events.ERROR);
      hls.off(Hls.Events.MANIFEST_PARSED);
      hls.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, []);

  return (
    <div className="video-background" aria-hidden="true">
      <video
        ref={videoRef}
        className="background-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/Gemini_Generated_Image_nyyyljnyyyljnyyy.png"
      />
      <div className="video-overlay" />
    </div>
  );
}
