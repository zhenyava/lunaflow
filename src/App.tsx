import { Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import HomeRoute from './components/HomeRoute';
import CalendarApp from './components/CalendarApp';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Landing page at root with smart redirect logic */}
        <Route path="/" element={<HomeRoute />} />
        
        {/* Calendar app */}
        <Route path="/calendar" element={<CalendarApp />} />
        
        {/* 404 - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Analytics />
    </ErrorBoundary>
  );
}

export default App;
