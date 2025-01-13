import React from 'react';
import StyledContainer from "../common/StyledContainer";
import Header from "../common/Header";
import CircleButton from "../common/CircleButton";
import NavigationBar from "../navigation/NavigationBar";
import { Box, Typography } from "@mui/material";
import TemplateStep from '../ProfileSetup/Steps/TemplateStep';

export default function SelectTemplate() {
    const formData = {
        firstName: "John",
        lastName: "Doe",
        shortBio: "I am a software engineer",
        location: "New York, NY",
        image1: null,
    }
    return (
        <StyledContainer>
            <Header title="Select Template" />
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <TemplateStep formData={formData} />
                <CircleButton width={100} height={100} text="Select Template" />
            </Box>
            <NavigationBar />
        </StyledContainer>
    )
}
