import React, { useState } from "react";
import StyledContainer from "../../common/StyledContainer";
import { Box, Typography, TextField, FormControl, InputLabel, OutlinedInput } from "@mui/material";
import { InputField } from "../../common/InputField";
import NavigationBar from "../../navigation/NavigationBar";
import Header from "../../common/Header";
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import CircleButton from "../../common/CircleButton";
import Divider from '@mui/material/Divider';

export default function ChangePassword() {
    const [formData, setFormData] = useState({
        email: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [showPassword, setShowPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log(formData);
        setFormData({
            email: "",
            newPassword: "",
            confirmPassword: "",
        });
    };

    const handleSendEmail = (e) => {
        e.preventDefault();
        console.log(formData);
        setFormData({
            email: "",
            newPassword: "",
            confirmPassword: "",
        });
    };

    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const handleClickShowConfirmPassword = () => setShowConfirmPassword((show) => !show);


    return (
        <StyledContainer>
            <Header title="Change Password" />
            <Box sx={{ width: '100%', padding: "16px 40px" }}>
                <form style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <FormControl fullWidth>
                        <InputLabel htmlFor="email">Email</InputLabel>
                        <OutlinedInput
                            id="email"
                            defaultValue={formData.email}
                            label="Email"
                            sx={{
                                // backgroundColor: "#ff9500",
                                borderRadius: "8px",
                            }}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </FormControl>

                    <FormControl fullWidth>
                        <InputLabel htmlFor="password">Password</InputLabel>
                        <OutlinedInput
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            endAdornment={
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label={
                                            showPassword ? 'hide the password' : 'display the password'
                                        }
                                        onClick={handleClickShowPassword}
                                        edge="end"
                                    >
                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            }
                            label="Password"
                            sx={{
                                // backgroundColor: "#ff9500",
                                borderRadius: "8px",
                            }}
                            value={formData.newPassword}
                            onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                        />
                    </FormControl>

                    <FormControl fullWidth>
                        <InputLabel htmlFor="email">Confirm Password</InputLabel>
                        <OutlinedInput
                            id="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            endAdornment={
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label={
                                            showConfirmPassword ? 'hide the password' : 'display the password'
                                        }
                                        onClick={handleClickShowConfirmPassword}
                                        edge="end"
                                    >
                                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            }
                            label="Password"
                            sx={{
                                // backgroundColor: "#ff9500",
                                borderRadius: "8px",
                            }}
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        />
                    </FormControl>
                    <CircleButton onClick={handleSubmit} width={100} height={100} text="Continue" />
                </form>
                
                <Divider />
                
                <form>
                    <Typography sx={{ fontSize: "14px", fontWeight: "400", margin: "16px 0" }}>Send Reset Email to: {formData.email}</Typography>
                    <CircleButton onClick={handleSendEmail} width={100} height={100} text="Send Email" />
                </form>
            </Box>
            <NavigationBar />
        </StyledContainer>
    );
}