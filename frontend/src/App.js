import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import "./user-dashboard.css";
import "./responsive-ui.css";
import "./theme.css";
import ReportForm from "./pages/ReportForm";
import Homepage from "./pages/Homepage";
import TrackReport from "./pages/TrackReport";
import HotspotMapPage from "./pages/HotspotMapPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import FAQsPage from "./pages/FAQsPage";
import ContactHelpPage from "./pages/ContactHelpPage";

function UserLayout() {
  return <div className="user-dashboard"><Outlet /></div>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<UserLayout />}>
        <Route path="/" element={<Homepage />} />
        <Route path="/report" element={<ReportForm />} />
        <Route path="/track" element={<TrackReport />} />
        <Route path="/hotspot-map" element={<HotspotMapPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/faqs" element={<FAQsPage />} />
        <Route path="/contact" element={<ContactHelpPage />} />
        </Route>
        <Route path="/admin-ctmo" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin-dashboard" element={<AdminDashboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
