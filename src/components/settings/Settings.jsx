import React from "react";
import { Box, Typography, Container, styled } from "@mui/material";
import Header from "../common/Header";
import NavigationBar from "../navigation/NavigationBar";
import StyledContainer from "../common/StyledContainer";
import SettingsOptions from "./SettingsOptions";


export default function Settings () {
    return (
        <StyledContainer>
            <Header title="Settings" />
            <SettingsOptions />
            <NavigationBar />
        </StyledContainer>
    )
}



