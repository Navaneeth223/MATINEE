import { Routes, Route } from 'react-router-dom';
import FoyerPage from './pages/FoyerPage';
import RoomPage from './pages/RoomPage';
import TheatrePage from './pages/TheatrePage';
import AboutPage from './pages/AboutPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FoyerPage />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
      <Route path="/theatre/:roomId" element={<TheatrePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
