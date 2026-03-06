import { Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import SmartRedirect from './components/SmartRedirect';
import CalendarApp from './components/CalendarApp';
import ErrorBoundary from './components/ErrorBoundary';
import Privacy from './components/Privacy';
import Terms from './components/Terms';

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Landing page at root with smart redirect logic */}
        <Route path="/" element={<SmartRedirect />} />
        
        {/* Calendar app */}
        <Route path="/calendar" element={<CalendarApp />} />

        {/* Legal pages */}
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        
        {/* 404 - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Analytics />
    </ErrorBoundary>
  );
}

export default App;
