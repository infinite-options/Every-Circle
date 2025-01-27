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

    formatPhoneNumber: (value) => {
        if (!value) return value;

        const phoneNumber = value.replace(/[^\d]/g, "");

        const phoneNumberLength = phoneNumber.length;

        if (phoneNumberLength < 4) return phoneNumber;

        if (phoneNumberLength < 7) {
            return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
        }

        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(
            3,
            6
        )}-${phoneNumber.slice(6, 10)}`;
    }
};
