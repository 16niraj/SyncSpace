import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./Home";
import Room from "./Room";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* If user visits /, they hit Home which redirects them to a room */}
        <Route path="/" element={<Home />} />
        {/* This is your actual workspace */}
        <Route path="/room/:roomId" element={<Room />} />
        {/* If someone types a random wrong URL, send them home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;