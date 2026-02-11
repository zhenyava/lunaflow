import { Routes, Route, Navigate } from 'react-router-dom';
import SmartRedirect from './components/SmartRedirect';
import CalendarApp from './components/CalendarApp';
import LandingPage from './components/LandingPage';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Smart redirect at root */}
        <Route path="/" element={<SmartRedirect />} />
        
        {/* Landing page always available */}
        <Route path="/home" element={<LandingPage />} />
        
        {/* Calendar app */}
        <Route path="/calendar" element={<CalendarApp />} />
        
        {/* 404 - redirect to home */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
