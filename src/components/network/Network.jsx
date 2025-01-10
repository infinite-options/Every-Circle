import React from "react";
import Header from "../common/Header";
import NavigationBar from "../navigation/NavigationBar";
import StyledContainer from "../common/StyledContainer";
import NetworkData from "./NetworkData";
import { Box, Typography, styled } from "@mui/material";


const TotalLabel = styled(Typography)({
    color: "#1a1a1a",
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1,
    marginTop: "11px",
});

export default function Network() {
    const metrics = [
        { count: "1", label: "You", value: "2" },
        { count: "19", label: "Direct", value: "9" },
        { count: "70", label: "1 Away", value: "32" },
        { count: "350", label: "2 Away", value: "240" },
    ];

    return (
        <StyledContainer>
            <Header title="Network" />
            <Box sx={{ alignSelf: "flex-start", width: "100%", margin: "0 0 0 10px"}}>
                <TotalLabel>Total</TotalLabel>
            </Box>
            {metrics.map((metric, index) => (
                <NetworkData
                    key={index}
                    count={metric.count}
                    label={metric.label}
                    value={metric.value}
                />
            ))}
            <NavigationBar />
        </StyledContainer>
    );
}
