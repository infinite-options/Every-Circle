import React, { useState } from "react";
import "./SignUp.css";

const SignUp = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      // Handle form submission
      console.log("Form submitted:", formData);
    }
  };

  const handleGoogleSignUp = () => {
    // Handle Google sign up
    console.log("Google sign up clicked");
  };

  const handleAppleSignUp = () => {
    // Handle Apple sign up
    console.log("Apple sign up clicked");
  };

  return (
    <div className='signup-container'>
      <div className='banner'>
        <h1>Welcome to Every Circle!</h1>
      </div>

      <div className='content'>
        <p className='subtitle'>Please choose a signup option to continue.</p>

        <form onSubmit={handleSubmit}>
          <div className='input-group'>
            <input type='email' name='email' placeholder='Email' value={formData.email} onChange={handleChange} className={errors.email ? "error" : ""} />
            {errors.email && <span className='error-message'>{errors.email}</span>}
          </div>

          <div className='input-group'>
            <div className='password-input'>
              <input type={showPassword ? "text" : "password"} name='password' placeholder='Password' value={formData.password} onChange={handleChange} className={errors.password ? "error" : ""} />
              <button type='button' className='toggle-password' onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            {errors.password && <span className='error-message'>{errors.password}</span>}
          </div>

          <div className='input-group'>
            <div className='password-input'>
              <input
                type={showConfirmPassword ? "text" : "password"}
                name='confirmPassword'
                placeholder='Confirm Password'
                value={formData.confirmPassword}
                onChange={handleChange}
                className={errors.confirmPassword ? "error" : ""}
              />
              <button type='button' className='toggle-password' onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            {errors.confirmPassword && <span className='error-message'>{errors.confirmPassword}</span>}
          </div>

          <button type='submit' className='continue-button'>
            Continue
          </button>
        </form>

        <div className='divider'>
          <span>OR</span>
        </div>

        <div className='social-auth'>
          <button onClick={handleGoogleSignUp} className='social-button google'>
            <img src='/google-icon.svg' alt='Google' />
          </button>
          <button onClick={handleAppleSignUp} className='social-button apple'>
            <img src='/apple-icon.svg' alt='Apple' />
          </button>
        </div>

        <p className='login-link'>
          Already have an account? <a href='/login'>Log In</a>
        </p>
      </div>
    </div>
  );
};

export default SignUp;
