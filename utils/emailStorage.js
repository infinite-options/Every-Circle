import AsyncStorage from "@react-native-async-storage/async-storage";

// Standard email storage key
const EMAIL_STORAGE_KEY = "user_email_id";

/**
 * Store user email in AsyncStorage
 * @param {string} email - User's email address
 */
export const storeUserEmail = async (email) => {
  try {
    await AsyncStorage.setItem(EMAIL_STORAGE_KEY, email);
    console.log("Email stored successfully:", email);
  } catch (error) {
    console.error("Error storing email:", error);
  }
};

/**
 * Retrieve user email from AsyncStorage
 * @returns {Promise<string|null>} User's email or null if not found
 */
export const getUserEmail = async () => {
  try {
    const email = await AsyncStorage.getItem(EMAIL_STORAGE_KEY);
    console.log("Retrieved email from storage:", email);
    return email;
  } catch (error) {
    console.error("Error retrieving email:", error);
    return null;
  }
};

/**
 * Clear user email from AsyncStorage
 */
export const clearUserEmail = async () => {
  try {
    await AsyncStorage.removeItem(EMAIL_STORAGE_KEY);
    console.log("Email cleared from storage");
  } catch (error) {
    console.error("Error clearing email:", error);
  }
}; 