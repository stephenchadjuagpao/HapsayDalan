import { BrowserRouter, Routes, Route } from "react-router-dom";
import ReportForm from "./pages/ReportForm";
import Homepage from "./pages/Homepage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/report" element={<ReportForm />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;