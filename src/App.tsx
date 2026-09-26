import { useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { getPortalSession } from './auth';
import AssessmentPage from './pages/AssessmentPage';
import CodingPage from './pages/CodingPage';
import LoginPage from './pages/LoginPage';

function RequirePortalSession() {
  const location = useLocation();

  if (!getPortalSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

function PortalHome() {
  return <Navigate to={getPortalSession() ? '/assessment' : '/login'} replace />;
}

export default function App() {
  const [attemptedProblemIds, setAttemptedProblemIds] = useState<ReadonlySet<number>>(
    () => new Set()
  );

  const markProblemAttempted = (problemId: number) => {
    setAttemptedProblemIds((currentIds) => new Set(currentIds).add(problemId));
  };

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
          <Route path="/" element={<PortalHome />} />
          <Route
            path="/login"
            element={getPortalSession() ? <Navigate to="/assessment" replace /> : <LoginPage />}
          />
          <Route element={<RequirePortalSession />}>
            <Route
              path="/assessment"
              element={<AssessmentPage attemptedProblemIds={attemptedProblemIds} />}
            />
            <Route
              path="/code/:id"
              element={<CodingPage onProblemAttempted={markProblemAttempted} />}
            />
          </Route>
          <Route path="*" element={<PortalHome />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
