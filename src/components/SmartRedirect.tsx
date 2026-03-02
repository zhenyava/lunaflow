import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import LandingPage from './LandingPage';
import { LAUNCHED_KEY } from '../constants';
import { getLocalEvents } from '../services/storageService';

const SmartRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // If the user navigated here explicitly from the app, don't redirect
    if (location.state && location.state.fromApp) {
      return;
    }

    try {
      const hasLaunched = localStorage.getItem(LAUNCHED_KEY);
      const localEvents = getLocalEvents();

      // If user has launched app before OR has data -> go to calendar
      if (hasLaunched || localEvents.length > 0) {
        navigate('/calendar', { replace: true });
      }
    } catch (e) {
      console.error('SmartRedirect storage error:', e);
    }
  }, [navigate, location.state]);

  return <LandingPage />;
};

export default SmartRedirect;
