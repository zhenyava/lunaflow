import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LAUNCHED_KEY } from '../constants';
import { getLocalEvents } from '../services/storageService';

const SmartRedirect = () => {
  const [destination] = useState<string>(() => {
    try {
      const hasLaunched = localStorage.getItem(LAUNCHED_KEY);
      const localEvents = getLocalEvents();

      // If user has launched app before OR has data -> go to calendar
      if (hasLaunched || localEvents.length > 0) {
        return '/calendar';
      } else {
        // New user -> go to home page (landing)
        return '/home';
      }
    } catch (e) {
      console.error('SmartRedirect storage error:', e);
      return '/home';
    }
  });

  return <Navigate to={destination} replace />;
};

export default SmartRedirect;
