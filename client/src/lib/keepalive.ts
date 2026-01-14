/**
 * Session keepalive utility
 * Prevents the application from timing out due to inactivity
 */

let keepaliveInterval: number | null = null;

/**
 * Starts a keepalive interval that performs a lightweight operation
 * to keep the session active
 */
export function startKeepalive(intervalMs: number = 5 * 60 * 1000) {
  // Clear existing interval if any
  if (keepaliveInterval !== null) {
    stopKeepalive();
  }

  // Perform a lightweight keepalive action
  const keepaliveAction = () => {
    // Touch localStorage to indicate activity
    try {
      localStorage.setItem('app-keepalive', Date.now().toString());
    } catch (error) {
      console.warn('Keepalive action failed:', error);
    }
  };

  // Initial keepalive
  keepaliveAction();

  // Set up interval (every 5 minutes by default)
  keepaliveInterval = window.setInterval(keepaliveAction, intervalMs);
}

/**
 * Stops the keepalive interval
 */
export function stopKeepalive() {
  if (keepaliveInterval !== null) {
    window.clearInterval(keepaliveInterval);
    keepaliveInterval = null;
  }
}

/**
 * Activity tracker that resets keepalive timer on user interaction
 */
export function setupActivityTracking() {
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  
  const handleActivity = () => {
    // Refresh keepalive on activity
    try {
      localStorage.setItem('app-last-activity', Date.now().toString());
    } catch (error) {
      console.warn('Activity tracking failed:', error);
    }
  };

  events.forEach(event => {
    document.addEventListener(event, handleActivity, { passive: true });
  });

  // Return cleanup function
  return () => {
    events.forEach(event => {
      document.removeEventListener(event, handleActivity);
    });
  };
}
