import React from 'react';
import Header from "../common/Header";
import NavigationBar from "../navigation/NavigationBar";
import StyledContainer from "../common/StyledContainer";
import { useLocation } from 'react-router-dom';
import { Box, Typography } from '@mui/material';

export default function MultiResult() {
    const { state } = useLocation();
    console.log("data is: ", state.data);
    const data = state.data;
    const mainName = data[0].name;
    const referredBy = data.map(item => item.refferedBy);
    const radius = 150; // Distance from the center circle to the small circles
    const centerX = 200; // X-coordinate of the center circle
    const centerY = 200; // Y-coordinate of the center circle

    return (
        <StyledContainer>
            <Header title="Search" />
            <Box
                sx={{
                    position: "relative",
                    height: "400px",
                    width: "400px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                {/* Center Circle */}
                <Box
                    sx={{
                        width: "120px",
                        height: "120px",
                        borderRadius: "50%",
                        backgroundColor: "#ff9500",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        position: "absolute",
                        top: `${centerY - 60}px`, // Centered vertically
                        left: `${centerX - 60}px`, // Centered horizontally
                    }}
                >
                    <Typography variant="h6" sx={{ color: "#fff", textAlign: "center" }}>
                        {mainName}
                    </Typography>
                </Box>

                {/* Small Circles */}
                {referredBy.map((name, index) => {
                    const angle = (index / referredBy.length) * 2 * Math.PI; // Angle for each circle
                    const x = centerX + radius * Math.cos(angle) - 40; // X-coordinate of the small circle
                    const y = centerY + radius * Math.sin(angle) - 40; // Y-coordinate of the small circle

                    return (
                        <Box
                            key={index}
                            sx={{
                                position: "absolute",
                                top: `${y}px`,
                                left: `${x}px`,
                                width: "80px",
                                height: "80px",
                                borderRadius: "50%",
                                backgroundColor: "#FF9500",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{ color: "#fff", textAlign: "center", fontSize: "14px" }}
                            >
                                {name}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>
            <NavigationBar />
        </StyledContainer>
    )
}
