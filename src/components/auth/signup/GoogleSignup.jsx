import React, { useState, useEffect } from "react";
import axios from 'axios';
import {useNavigate} from 'react-router-dom'; 
import { useUserAuth } from '../authUtils/useUserAuth';
import { checkIfUserExists, checkIfProfileExists } from '../authUtils/AuthUtils';

let CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
// let CLIENT_ID = process.env.REACT_APP_GOOGLE_LOGIN;
let CLIENT_SECRET = process.env.REACT_APP_GOOGLE_CLIENT_SECRET;
// const GOOGLE_LOGIN_PASSWORD = "googleSocialLogin1"
let GOOGLE_LOGIN_PASSWORD = process.env.REACT_APP_GOOGLE_LOGIN;
let SCOPES = "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.profile ";


const GoogleSignup = (props) => {
    console.log('GOOGLE_LOGIN_PASSWORD', GOOGLE_LOGIN_PASSWORD)
    console.log('CLIENT_ID', CLIENT_ID)
    const { handleUserSignUp } = useUserAuth();
    const [email, setEmail] = useState("");
    const [socialId, setSocialId] = useState("");
    const [refreshToken, setRefreshToken] = useState("");
    const [accessToken, setAccessToken] = useState("");
    const [accessExpiresIn, setAccessExpiresIn] = useState("");
    const navigate = useNavigate();
    let codeClient = {};

    function getAuthorizationCode() {
        // Request authorization code and obtain user consent,  method of the code client to trigger the user flow
        codeClient.requestCode();
    }

    useEffect(() => {
        /* global google */
        if (google) {
            // initialize a code client for the authorization code flow.
            codeClient = google.accounts.oauth2.initCodeClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: (tokenResponse) => {
                    // gets back authorization code
                    console.log('call back called', tokenResponse)
                    if (tokenResponse && tokenResponse.code) {
                        let auth_code = tokenResponse.code;
                        let authorization_url = "https://accounts.google.com/o/oauth2/token";

                        var details = {
                            code: auth_code,
                            client_id: CLIENT_ID,
                            client_secret: CLIENT_SECRET,
                            redirectUri: "postmessage",
                            grant_type: "authorization_code",
                        };
                        var formBody = [];
                        for (var property in details) {
                            var encodedKey = encodeURIComponent(property);
                            var encodedValue = encodeURIComponent(details[property]);
                            formBody.push(encodedKey + "=" + encodedValue);
                        }
                        formBody = formBody.join("&");
                        // use authorization code, send it to google endpoint to get back ACCESS TOKEN n REFRESH TOKEN
                        fetch(authorization_url, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                            },
                            body: formBody,
                        })
                            .then((response) => {
                                return response.json();
                            })

                            .then((data) => {
                                console.log('data from google', data);
                                let at = data["access_token"];
                                let rt = data["refresh_token"];
                                let ax = data["expires_in"];
                                //  expires every 1 hr
                                setAccessToken(at);
                                // stays the same and used to refresh ACCESS token
                                setRefreshToken(rt);
                                setAccessExpiresIn(ax);
                                //  use ACCESS token, to get email and other account info
                                axios
                                    .get("https://www.googleapis.com/oauth2/v2/userinfo?alt=json&access_token=" + at)
                                    .then((response) => {
                                        let data = response.data;

                                        let e = data["email"];
                                        let si = data["id"];

                                        setEmail(e);
                                        setSocialId(si);
                                        const socialGoogle = async () => {
                                            const user = {
                                                email: e,
                                                password: GOOGLE_LOGIN_PASSWORD,
                                                first_name: data["given_name"],
                                                last_name: data["family_name"],
                                                google_auth_token: at,
                                                google_refresh_token: rt,
                                                social_id: si,
                                                access_expires_in: String(ax),
                                                phone_number: "",
                                                role: "",
                                            };
                                            console.log('checking user from google', user)
                                            const userExist = await checkIfUserExists(e);
                                            console.log('user Exists', userExist)
                                            
                                            await handleUserSignUp(user, 'google');
                                        };
                                        socialGoogle();
                                    })
                                    .catch((error) => {
                                        console.log(error);
                                    });
                                return accessToken, refreshToken, accessExpiresIn, email, socialId;
                            })
                            .catch((err) => {
                                console.log(err);
                            });
                    }
                },
            });
        }
    }, [getAuthorizationCode]);


    return (
        <>
            <button onClick={() => getAuthorizationCode()} className="social-button google">
                <img
                    src="https://cdn-icons-png.flaticon.com/256/1199/1199414.png"
                    alt="Google"
                />
            </button>
        </>
    )
}

export default GoogleSignup;