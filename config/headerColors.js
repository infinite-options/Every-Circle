/**
 * Centralized Header Colors Configuration
 *
 * This file contains all header background colors for different screens.
 * To change a header color, simply update the value in this file.
 *
 * Usage in screens:
 *   import { getHeaderColor } from '../config/headerColors';
 *   <AppHeader title="My Screen" backgroundColor={getHeaderColor('MyScreen')} />
 */

export const HEADER_COLORS = {
  // Default/Main screens
  default: "#AF52DE", // Purple - default for most screens
  // profile: "#AF52DE", // Purple
  profile: "#800000", // Maroon
  // editProfile: "#AF52DE", // Purple
  editProfile: "#929090", // Gray
  settings: "#AF52DE", // Purple
  network: "#2434C2", // Blue (Connect)
  account: "#18884A", // Green
  search: "#4F8A8B", // Green shade
  changePassword: "#AF52DE", // Purple
  businessProfile: "#AF52DE", // Purple
  editBusinessProfile: "#929090", // Gray (same as editProfile)
  login: "#800000", // Maroon (same as profile)
  signUp: "#800000", // Maroon (same as profile)
  userInfo: "#800000", // Maroon (same as profile, for Complete Your Profile)

  // Detail/View screens (Orange)
  profileView: "#FF9500", // Orange - for viewing other users' profiles
  expertiseDetail: "#FF9500", // Orange
  wishDetail: "#FF9500", // Orange
  reviewDetail: "#FF9500", // Orange
  wishResponses: "#FF9500", // Orange

  // Special screens
  shoppingCart: "#9C45F7", // Purple variant
  accountType: "#007AFF", // Blue

  // Legal/Info screens
  termsAndConditions: "#AF52DE", // Purple
  privacyPolicy: "#AF52DE", // Purple
};

/**
 * Dark mode color mappings
 * Automatically generates darker versions of colors for dark mode
 */
export const DARK_MODE_COLORS = {
  "#AF52DE": "#8B4C9F", // Purple -> Darker Purple
  "#FF9500": "#CC7700", // Orange -> Darker Orange
  "#9C45F7": "#7B35C7", // Purple variant -> Darker Purple
  "#007AFF": "#0051D5", // Blue -> Darker Blue
  "#800000": "#660000", // Maroon -> Darker Maroon
  "#929090": "#6B6B6B", // Gray -> Darker Gray
  "#2434C2": "#1C2899", // Blue (Connect) -> Darker Blue
  "#18884A": "#126B38", // Green -> Darker Green
};

/**
 * Get header color for a screen
 * @param {string} screenName - Name of the screen (key from HEADER_COLORS)
 * @returns {string} Color hex code
 */
export const getHeaderColor = (screenName) => {
  return HEADER_COLORS[screenName] || HEADER_COLORS.default;
};

/**
 * Get dark mode header color for a screen
 * @param {string} screenName - Name of the screen (key from HEADER_COLORS)
 * @returns {string} Dark mode color hex code
 */
export const getDarkModeHeaderColor = (screenName) => {
  const lightColor = getHeaderColor(screenName);
  return DARK_MODE_COLORS[lightColor] || lightColor;
};

/**
 * Get both light and dark mode colors for a screen
 * @param {string} screenName - Name of the screen
 * @returns {object} { backgroundColor, darkModeBackgroundColor }
 */
export const getHeaderColors = (screenName) => {
  return {
    backgroundColor: getHeaderColor(screenName),
    darkModeBackgroundColor: getDarkModeHeaderColor(screenName),
  };
};
