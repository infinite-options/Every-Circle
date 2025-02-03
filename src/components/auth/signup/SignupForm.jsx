import React, { useState, useEffect } from "react";
import "./SignupForm.css";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useUserContext } from "../../contexts/UserContext";
import GoogleSignup from "./GoogleSignup";
import { useUserAuth } from '../authUtils/useUserAuth';
import { useLocation } from "react-router-dom";

const SignupForm = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isFormValid, setIsFormValid] = useState(false);
  const { updateUser } = useUserContext();
  const { handleUserSignUp } = useUserAuth();
  const location = useLocation();


  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const role = queryParams.get("role");

    if (role) {
      console.log("Setting role", role);
      const data = {
        role,
      };
      updateUser(data);
    }
  }, [location.search]);

  useEffect(() => {
    // Check if form is valid
    const validateForm = () => {
      // Email validation
      const isEmailValid =
        formData.email && /\S+@\S+\.\S+/.test(formData.email);

      // Password validation
      const isPasswordValid =
        formData.password && formData.password.length >= 8;

      // Confirm password validation
      const isConfirmPasswordValid =
        formData.password === formData.confirmPassword &&
        formData.confirmPassword;

      return isEmailValid && isPasswordValid && isConfirmPasswordValid;
    };

    setIsFormValid(validateForm());
  }, [formData]);

  const handleInputChange = (e) => {
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

  const checkIfUserExists = async (email) => {
    const response = await axios.get(
      `https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/GetEmailId/EVERY-CIRCLE/${email}`
    );
    return response?.data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateForm()) {
      handleUserSignUp(formData, 'email');
      // console.log("Form submitted:", formData);

      // const userExists = await checkIfUserExists(formData.email);
      // // let userObject = null;

      // // if(userExists){
      // //   userObject = {
      // //     ...user,
      // //     // isEmailSignup: false,
      // //   };
      // // } else {
      // //   userObject = {
      // //     email: formData.email,
      // //     password: formData.password,
      // //     isEmailSignup: true,
      // //   };
      // // }

      // let userObject = {
      //   email: formData.email,
      //   password: formData.password,
      // };

      // //console.log("Current User Info: ", user);

      // if (userExists?.message !== "User EmailID doesnt exist") {
      //   alert("Email already exists");
      // } else {
      //   const response = await axios.post(
      //     `https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/CreateAccount/EVERY-CIRCLE`,
      //     userObject
      //   );

      //   const loginData = {
      //     userId: response?.data?.user_uid ,
      //     isUserLoggedIn: true,
      //   };
      //   updateUser( loginData);

      //   navigate(`/profileSetup`, {
      //     state: { userId: response?.data?.user_uid },
      //   });
      // }
    }
  };

  const handleGoogleSignup = () => {
    console.log("Google signup clicked");
    // Implement Google authentication
  };

  const handleAppleSignup = () => {
    console.log("Apple signup clicked");
    // Implement Apple authentication
  };

  return (
    <div className="signup-container">
      <div className="banner">
        <h1>Welcome to Every Circle!</h1>
      </div>

      <div className="content">
        <p className="subtitle">Please choose a signup option to continue.</p>

        <form onSubmit={handleSubmit}>
          {/* email textfield */}
          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleInputChange}
              className={errors.email ? "error" : ""}
            />
            {errors.email && (
              <span className="error-message">{errors.email}</span>
            )}
          </div>

          {/* password textfield */}
          <div className="form-group">
            <div className="password-input">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange}
                className={errors.password ? "error" : ""}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            {errors.password && (
              <span className="error-message">{errors.password}</span>
            )}
          </div>

          {/* confirm password textfield */}
          <div className="form-group">
            <div className="password-input">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={errors.confirmPassword ? "error" : ""}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="error-message">{errors.confirmPassword}</span>
            )}
          </div>

          {/* continue button */}
          <button
            type="submit"
            className={`continue-button ${isFormValid ? "active" : ""}`}
          >
            Continue
          </button>
        </form>

        <div className="divider">
          <span>OR</span>
        </div>

        <div className="social-auth">
          {/* <button onClick={handleGoogleSignup} className="social-button google">
            <img
              src="https://cdn-icons-png.flaticon.com/256/1199/1199414.png"
              alt="Google"
            />
          </button> */}
          <GoogleSignup />
          <button onClick={handleAppleSignup} className="social-button apple">
            <svg viewBox="0 0 384 512" width="24" height="24">
              <path
                fill="currentColor"
                d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
              />
            </svg>
          </button>
        </div>

        <div className="login-link">
          Already have an account? <a href="/login">Log In</a>
        </div>
      </div>
    </div>
  );
};

export default SignupForm;
