import { Routes, Route, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PMV from "./pages/PMV";
import Sensors from "./pages/Sensors";
import EnergyOverview from "./pages/EnergyOverview";
import HeaterOverview from "./pages/HeaterOverview";
import Building3D from "./pages/BuildingViewer";
import FloorPlan from "./pages/FloorPlan";
import { ChatProvider } from "./components/chatbot";
import ChatWidget from "./components/chatbot";
import RequireAuth from "./RequireAuth";

function App() {
  const location = useLocation();
  const hasToken = !!sessionStorage.getItem("token");
  const showChat = hasToken && location.pathname !== '/';
  return (
    <ChatProvider>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pmv" element={<PMV />} />
          <Route path="/sensors" element={<Sensors />} />
          <Route path="/energy-overview" element={<EnergyOverview />} />
          <Route path="/heater-overview" element={<HeaterOverview />} />
          <Route path="/floorplan" element={<FloorPlan />} />
          <Route path="/building-3d/:floor" element={<Building3D />} />
        </Route>
      </Routes>
      {showChat && <ChatWidget />}
    </ChatProvider>
  );
}

export default App;