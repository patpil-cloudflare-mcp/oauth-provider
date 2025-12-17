// src/views/index.ts - Barrel Export for All View Templates
// This file maintains backward compatibility by re-exporting all template functions

// Auth templates
export { renderAuthRequiredPage } from './templates/auth/authRequired';
export { renderAuthErrorPage } from './templates/auth/authError';
export { renderLogoutSuccessPage } from './templates/auth/logoutSuccess';
export { renderLoginSuccessPage, type LoginSuccessData } from './templates/auth/loginSuccess';

// Dashboard templates
export { renderDashboardPage } from './templates/dashboard/dashboard';
export { renderSettingsPage } from './templates/dashboard/settings';

// Public templates
export { renderPublicHomePage } from './templates/public/home';

// Shared components (available for direct import if needed)
export * from './components/styles';
export * from './components/head';
export * from './components/layout';
