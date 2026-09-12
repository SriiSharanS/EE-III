import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AssessmentPage from './pages/AssessmentPage';
import CodingPage from './pages/CodingPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/assessment" replace />} />
        <Route path="/assessment" element={<AssessmentPage />} />
        <Route path="/code/:id" element={<CodingPage />} />
        <Route path="*" element={<Navigate to="/assessment" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
