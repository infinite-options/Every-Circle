import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "./LoginForm.css";
import { useUserContext } from '../../contexts/UserContext';

const LoginForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [errors, setErrors] = useState({});
  const { updateUser } = useUserContext();

  useEffect(() => {
    const validateForm = () => {
      // Both email and password must be filled
      return formData.email && formData.password;
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
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (validateForm()) {
      try {
        // First API call to get salt
        axios
          .post(
            "https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/AccountSalt/EVERY-CIRCLE",
            {
              email: formData.email,
            }
          )
          .then(async (response) => {
            let saltResponse = response?.data;

            if (saltResponse.code === 200) {
              let hashAlg = saltResponse?.result[0]?.password_algorithm;
              let salt = saltResponse?.result[0]?.password_salt;

              if (hashAlg && salt) {
                // Prepare password hashing
                let algorithm = hashAlg;
                if (hashAlg === "SHA256") algorithm = "SHA-256";

                // Salt the password
                const saltedPassword = formData.password + salt;
                const encoder = new TextEncoder();
                const data = encoder.encode(saltedPassword);

                // Hash the salted password
                const hashedBuffer = await crypto.subtle.digest(
                  algorithm,
                  data
                );
                const hashArray = Array.from(new Uint8Array(hashedBuffer));
                const hashedPassword = hashArray
                  .map((byte) => byte.toString(16).padStart(2, "0"))
                  .join("");

                // Prepare login object with profile data
                const loginObject = {
                  email: formData.email,
                  password: hashedPassword,
                };

                // Login request
                const loginResponse = await axios.post(
                  "https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/Login/EVERY-CIRCLE",
                  loginObject
                );

                // console.log(loginResponse);
                const { message, result } = loginResponse?.data;

                switch (message) {
                  case "Login successful":
                    // console.log("Login successful", result?.user_uid);
                    // navigate("/profileSetup", {
                    //   state: { userId: result?.user_uid },
                    // });
                    const loginData = {
                      userId: result?.user_uid,
                      isUserLoggedIn: true,
                    };
                    updateUser( loginData);
                    navigate("/profile", {
                      state: { userId: result?.user_uid },
                    });
                    break;

                  case "Incorrect password":
                    alert("Incorrect password");
                    break;

                  case "Email not found":
                    alert("Email doesn't exist");
                    break;

                  default:
                    alert("An error occurred during login");
                }
              }
            } else {
              alert("Email doesn't exist");
            }
          });
      } catch (error) {
        console.error("Login error:", error);
        alert("An error occurred during login");
      }
    }
  };

  const handleGoogleLogin = () => {
    console.log("Google login clicked");
    // Implement Google authentication
  };

  const handleAppleLogin = () => {
    console.log("Apple login clicked");
    // Implement Apple authentication
  };

  return (
    <div className="login-container">
      <div className="banner">
        <h1 style={{ paddingBottom: "10px" }}>Welcome Back!</h1>
      </div>

      <div className="content">
        <p className="subtitle">Please choose a login option to continue.</p>

        <form onSubmit={handleSubmit}>
          {/* this is for email input */}
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

          {/* This is for password input */}
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
          <button onClick={handleGoogleLogin} className="social-button google">
            {/* <GoogleIcon /> */}
            <img
              src="https://cdn-icons-png.flaticon.com/256/1199/1199414.png"
              alt="Google"
            />
          </button>
          <button onClick={handleAppleLogin} className="social-button apple">
            <svg viewBox="0 0 384 512" width="24" height="24">
              <path
                fill="currentColor"
                d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
              />
            </svg>
          </button>
        </div>

        <div className="signup-link">
          Don't have an account? <Link to="/signup">Sign Up</Link>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
