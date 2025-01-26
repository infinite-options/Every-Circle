export const DataValidationUtils = {
    // Email Validation
    isValidEmail: (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },
  
    // Phone Number Validation
    isValidPhoneNumber: (phoneNumber) => {
      const phoneRegex = /^(\d{10}|\(\d{3}\)[-\s]?\d{3}[-\s]?\d{4}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4})$/;
      return phoneRegex.test(phoneNumber);
    },
  };
  