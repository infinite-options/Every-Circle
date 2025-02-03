// hooks/useUserSignUp.js

import { useNavigate } from 'react-router-dom';
import { checkIfUserExists, checkIfProfileExists } from '../authUtils/AuthUtils';
import React, { useState } from 'react';
import axios from 'axios';
import { useUserContext } from '../../contexts/UserContext';

export const useUserAuth = () => {
    const navigate = useNavigate();
    const { updateUser, user } = useUserContext();
    let GOOGLE_LOGIN_PASSWORD = process.env.REACT_APP_GOOGLE_LOGIN;
    const [role, setRole] = useState(user?.role || "user");

    const handleUserSignUp = async (userData, signupType) => {
        console.log('userData', userData);
        try {
            if (signupType === "email") {
                // Check if the user exists
                const userExists = await checkIfUserExists(userData.email);
                console.log('User exists:', userExists);
                if (userExists?.message !== 'User email does not exist') {
                    handleLogin(userData);
                } else {
                    console.log('creating a new user from sign up')
                    await createAccount(userData);
                }
            } else {
                // Make the signup API call to Googe signup
                const response = await axios.post(
                    'https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/UserSocialSignUp/EVERY-CIRCLE',
                    userData
                );
                console.log('response from social signup', response);
                if (response.data.message === "User already exists") {
                    const userId = response.data.user_uid;
                    await performRedirection(userId);
                } else {
                    redirectToProfileSetup(response.data.user_uid);
                }
            }
        } catch (error) {
            console.error("Error in handleUserSignUp:", error.message || error);
        }
    };


    const createAccount = async (userData) => {
        const userObject = {
            email: userData.email,
            password: userData.password,
            role:role,
        };

        try {
            const response = await axios.post(
                "https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/CreateAccount/EVERY-CIRCLE",
                userObject
            );
            const userId = response?.data?.user_uid;
            redirectToProfileSetup(userId);
        } catch (error) {
            console.error("Error in createAndLoginUser:", error.message || error);
            throw error;
        }
    };


    const handleLogin = async (userData) => {
        try {
            // First API call to get salt
            axios
                .post(
                    "https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/AccountSalt/EVERY-CIRCLE",
                    {
                        email: userData.email,
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
                            const saltedPassword = userData.password + salt;
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
                                email: userData.email,
                                password: hashedPassword,
                            };

                            // Login request
                            const loginResponse = await axios.post(
                                "https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/Login/EVERY-CIRCLE",
                                loginObject
                            );

                            console.log(loginResponse);
                            setRole(loginResponse?.data?.result?.user_role);
                            const { message, result } = loginResponse?.data;

                            switch (message) {
                                case "Login successful":
                                    await performRedirection(result?.user_uid);
                                    break;

                                case "Incorrect password":
                                    alert("Incorrect password");
                                    navigate('/Login');
                                    break;

                                case "Email not found":
                                    alert("Email doesn't exist");
                                    navigate('/Login');
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
    };

    const performRedirection = async (userId) => {
        try {
            // Check if the profile exists
            const profileResponse = await checkIfProfileExists(userId);
    
            if (profileResponse?.code === 200 && profileResponse.result?.length === 1) {
                redirectToProfile(userId);
            } else {
                redirectToProfileSetup(userId);
            }
        } catch (error) {
            console.error("Error fetching profile:", error.message || error, error.response?.data?.message);
            redirectToProfileSetup(userId);
        }
    };
    

    const redirectToProfile = (userId) => {
        const loginData = {
            userId,
            isUserLoggedIn: true,
            role:role,
        };
        updateUser(loginData);
        navigate("/profile");
    };
    

    const redirectToProfileSetup = (userId) => {
        const loginData = {
            userId,
            isUserLoggedIn: true,
            role:role,
        };
        updateUser(loginData);
        navigate("/profileSetup", {
            state: { userId },
        });
    };

    const handleGoogleLogin = async (email, socialId, firstName, lastName, authToken, refreshToken, expiresIn) => {
        console.log('handleGoogleLogin called');
        try {
            const { data } = await axios.get(
                `https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/UserSocialLogin/EVERY-CIRCLE/${email}`
            );

            console.log('data from UserSocialLogin', data)
            if (data.message === "User email does not exist") {
                // alert("User does not exist. Please Signup.");
                // navigate("/signup");
                const user = {
                    email: email,
                    password: GOOGLE_LOGIN_PASSWORD,
                    first_name: firstName,
                    last_name: lastName,
                    google_auth_token: authToken,
                    google_refresh_token: refreshToken,
                    social_id: socialId,
                    access_expires_in: String(expiresIn),
                    phone_number: "",
                    role: "user", //fall back to default role
                };
                await handleUserSignUp(user, "google");
                return;
            } else {
                const user = data.result;
                const user_id = user[0];
                sessionStorage.setItem("authToken", user.access_token);
                sessionStorage.setItem("refreshToken", user.refresh_token);

                // Update Access Token
                const url = `https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/UpdateAccessToken/EVERY-CIRCLE/${user_id}`;
                await axios.post(url, { google_auth_token: authToken });

                performRedirection(user_id);
            }
        } catch (err) {
            console.error("Error in handleGoogleLogin:", err);
        }
    }

    return { handleUserSignUp, handleLogin, handleGoogleLogin };
};
