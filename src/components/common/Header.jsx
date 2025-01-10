import React from "react";
import { Box, Typography, styled } from "@mui/material";

const HeaderBox = styled(Box)({
    backgroundColor: "#af52de",
    padding: "20px 64px",
    textAlign: "center",
    marginBottom: 25,
    fontWeight: 400,
    fontSize: 24,
    lineHeight: 30,
});


export default function Header({ title }) {
    return (
        <HeaderBox>
            <Typography variant="h4" color="white">
                {title}
            </Typography>
        </HeaderBox>
    );
}