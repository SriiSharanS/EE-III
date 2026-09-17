import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AssessmentPage from './pages/AssessmentPage';
import CodingPage from './pages/CodingPage';

export default function App() {
  return (
    <>
      <div className="video-background" aria-hidden="true">
        <video
          className="video-bg"
          src="/videos/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          controls={false}
        />
        <div className="video-overlay" />
      </div>

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/assessment" replace />} />
          <Route path="/assessment" element={<AssessmentPage />} />
          <Route path="/code/:id" element={<CodingPage />} />
          <Route path="*" element={<Navigate to="/assessment" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
