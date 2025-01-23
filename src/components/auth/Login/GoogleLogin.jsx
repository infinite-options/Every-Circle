import React, { useState, useEffect } from "react";
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useUserContext } from '../../contexts/UserContext';

let CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
let CLIENT_SECRET = process.env.REACT_APP_GOOGLE_CLIENT_SECRET;
let SCOPES = "https://www.googleapis.com/auth/userinfo.profile email";


const GoogleLogin = (props) => {
    const [email, setEmail] = useState("");
    const [socialId, setSocialId] = useState("");
    const [refreshToken, setRefreshToken] = useState("");
    const [accessToken, setAccessToken] = useState("");
    const [accessExpiresIn, setAccessExpiresIn] = useState("");
    const navigate = useNavigate();
    const { updateUser } = useUserContext();
    let codeClient = {};

    function getAuthorizationCode() {
        // Request authorization code and obtain user consent,  method of the code client to trigger the user flow
        codeClient.requestCode();
    }

    const socialGoogle = async (e, u) => {
        const loginData = {
            userId: u.result.user.user_uid,
            isUserLoggedIn: true,
        };
        updateUser(loginData);
        navigate('/profile');
    };

    useEffect(() => {
        /* global google */
        if (google) {
            // initialize a code client for the authorization code flow.
            codeClient = google.accounts.oauth2.initCodeClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: (tokenResponse) => {
                    // gets back authorization code
                    // console.log('call back called', tokenResponse)
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
                                        axios
                                            .get(
                                                `https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/UserSocialLogin/MYSPACE/${e}`
                                            )
                                            .then(async ({ data }) => {
                                                console.log('data is------', data["message"])
                                                if (
                                                    data["message"] === "Email ID does not exist"
                                                ) {
                                                    alert('User does not exist. Please Signup.')
                                                    navigate("/signup")
                                                    return;
                                                } else if (data["message"] === "Login with email") {
                                                    alert(data["message"]);
                                                } else {
                                                    let user = data.result;
                                                    let user_id = data.result.user.user_uid;
                                                    setAccessToken(at);
                                                    sessionStorage.setItem('authToken', user.access_token);
                                                    sessionStorage.setItem('refreshToken', user.refresh_token)

                                                    let url = `https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/UpdateAccessToken/MYSPACE/${user_id}`;
                                                    axios
                                                        .post(url, {
                                                            google_auth_token: at,
                                                        })
                                                        .then((response) => {
                                                            socialGoogle(email, user);
                                                        })
                                                        .catch((err) => {
                                                            console.log(err);
                                                        });
                                                    return accessToken;
                                                }
                                            });
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

export default GoogleLogin;