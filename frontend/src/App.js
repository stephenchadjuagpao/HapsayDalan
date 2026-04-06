import { BrowserRouter, Routes, Route } from "react-router-dom";
import ReportForm from "./pages/ReportForm";
import Homepage from "./pages/Homepage";
import TrackReport from "./pages/TrackReport";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/report" element={<ReportForm />} />
        <Route path="/track" element={<TrackReport />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
