// hooks/useUserSignUp.js

import { useNavigate } from 'react-router-dom';
import { checkIfUserExists, checkIfProfileExists } from '../authUtils/AuthUtils';
import React, { useState } from 'react';
import axios from 'axios';
import { useUserContext } from '../../contexts/UserContext';

export const useUserAuth = () => {
    const navigate = useNavigate();
    const { updateUser } = useUserContext();

    const handleUserSignUp = async (formData, signupType) => {
        console.log('formdata', formData);
        if (signupType === "email") {
            // Check if the user exists
            const userExists = await checkIfUserExists(formData.email);
            console.log('User exists:', userExists);
            if (userExists?.message !== 'User EmailID doesnt exist') {
                handleLogin(formData);
            } else {
                let userObject = {
                    email: formData.email,
                    password: formData.password,
                };

                const response = await axios.post(
                    `https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/CreateAccount/EVERY-CIRCLE`,
                    userObject
                );

                const loginData = {
                    userId: response?.data?.user_uid,
                    isUserLoggedIn: true,
                };
                updateUser(loginData);

                navigate(`/profileSetup`, {
                    state: { userId: response?.data?.user_uid },
                });
            }
        } else {
            // Make the signup API call to Googe signup
            const response = await axios.post(
                'https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/UserSocialSignUp/MYSPACE',
                formData
            );
            console.log('response from social signup', response);
        }





        // if (signupType === "email") {
        //     // Check if the user exists
        //     const userExists = await checkIfUserExists(formData.email);
        //     console.log('User exists:', userExists);

        //     if (userExists?.message !== 'User EmailID doesnt exist') {
        //         const userId = userExists?.result;
        //         console.log('user id is', userId);
        //         try {
        //             // Check if the profile exists, redirect to profile dashboard page
        //             const profileResponse = await checkIfProfileExists(userId);
        //             if (profileResponse.code === 200 && profileResponse.result.length == 1) {
        //                 const loginData = {
        //                     userId: userId,
        //                     isUserLoggedIn: true,
        //                 };
        //                 updateUser(loginData);
        //                 navigate("/profile");
        //             }
        //         } catch (error) {
        //             //If no profile, redirect to profile setup page
        //             console.error('Error fetching profile:', error, error.response?.data?.message);
        //             const loginData = {
        //                 userId: userId,
        //                 isUserLoggedIn: true,
        //             };
        //             updateUser(loginData);
        //             navigate(`/profileSetup`, {
        //                 state: { userId },
        //             });
        //         }
        //     } else {
        //         // Make the signup API call
        //         const response = await axios.post(
        //             'https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/signup',
        //             formData
        //         );

        //         console.log('Signup successful:', response.data);
        //         const loginData = {
        //             userId: response?.data?.user_uid,
        //             isUserLoggedIn: true,
        //         };
        //         updateUser(loginData);
        //         navigate(`/profileSetup`, {
        //             state: { userId: response?.data?.user_uid },
        //         });
        //     }
        // } else {
        //     // Make the signup API call to Googe signup
        //     const response = await axios.post(
        //         'https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/UserSocialSignUp/MYSPACE',
        //         formData
        //     );
        //     console.log('response from social signup', response);
        // }

    };


    const handleLogin = async (formData) => {
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
                                    updateUser(loginData);
                                    //Check if profile exists

                                    try {
                                        // Check if the profile exists, redirect to profile dashboard page
                                        const profileResponse = await checkIfProfileExists(result?.user_uid);
                                        if (profileResponse.code === 200 && profileResponse.result.length == 1) {
                                            navigate("/profile");
                                        }
                                    } catch (error) {
                                        //If no profile, redirect to profile setup page
                                        console.error('Error fetching profile:', error, error.response?.data?.message);
                                        navigate(`/profileSetup`, {
                                            state: { userId: result?.user_uid },
                                        });
                                    }
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

    return { handleUserSignUp, handleLogin };
};
