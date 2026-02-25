import { Navigate, Route, Routes } from "react-router-dom";

import { LandingPage } from "@/pages/LandingPage";
import { OfficePage } from "@/pages/OfficePage";

export function AppRouter(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/office" element={<OfficePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
