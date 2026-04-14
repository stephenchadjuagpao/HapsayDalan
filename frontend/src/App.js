import { BrowserRouter, Routes, Route } from "react-router-dom";
import ReportForm from "./pages/ReportForm";
import Homepage from "./pages/Homepage";
import TrackReport from "./pages/TrackReport";
import HotspotMapPage from "./pages/HotspotMapPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import HowItWorksPage from "./pages/HowItWorksPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/report" element={<ReportForm />} />
        <Route path="/track" element={<TrackReport />} />
        <Route path="/hotspot-map" element={<HotspotMapPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/admin-ctmo" element={<AdminLoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
