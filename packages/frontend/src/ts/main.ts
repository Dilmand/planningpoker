import { PlayerView } from './ui/playerView';
import { AdminView } from './ui/adminView';

// Initialize views based on URL
document.addEventListener('DOMContentLoaded', () => {
  // Check if admin route
  const isAdminRoute = window.location.pathname.includes('/admin');
  
  if (isAdminRoute) {
    // Initialize admin view
    new AdminView();
  } else {
    // Initialize player view
    new PlayerView();
  }
}); 