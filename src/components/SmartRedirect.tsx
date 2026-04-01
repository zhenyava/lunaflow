import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import LandingPage from './LandingPage';
import { LAUNCHED_KEY } from '../constants';

const SmartRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // If the user navigated here explicitly from the app, don't redirect
    if (location.state && location.state.fromApp) {
      return;
    }

    const hasLaunched = localStorage.getItem(LAUNCHED_KEY);
    if (hasLaunched) {
      navigate('/calendar', { replace: true });
    }
  }, [navigate, location.state]);

  return <LandingPage />;
};

export default SmartRedirect;
