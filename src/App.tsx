import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { NavBar } from './components/ui/NavBar';
import { PokedexPage } from './pages/PokedexPage';
import { TeamBuilderPage } from './pages/TeamBuilderPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950">
        <NavBar />
        <Routes>
          <Route path="/" element={<PokedexPage />} />
          <Route path="/team-builder" element={<TeamBuilderPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
