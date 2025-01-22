import React from "react";
import Header from "../common/Header";
import NavigationBar from "../navigation/NavigationBar";
import StyledContainer from "../common/StyledContainer";
import NetworkData from "./NetworkData";
import SearchBar from "../common/SearchBar";
import { Box, Typography, styled, IconButton } from "@mui/material";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import Diversity3Icon from '@mui/icons-material/Diversity3';
import { useNavigate } from "react-router-dom";

const TotalLabel = styled(Typography)({
    color: "#1a1a1a",
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1,
    marginTop: "11px",
});

export default function Network() {
    const navigate = useNavigate();
    const data = [
        { id: 1, count: "1", label: "You", value: "2" },
        { id: 2, count: "19", label: "Direct", value: "9" },
        { id: 3, count: "70", label: "1 Away", value: "32" },
        { id: 4, count: "350", label: "2 Away", value: "240" },
    ];

    return (
        <StyledContainer>
            <Header title="Network" />
            <Box sx={{ width: "100%", padding: "0px 16px 16px 16px" }}>
                <Box sx={{ width: "100%", paddingX: "16px", display: "flex", justifyContent: "flex-end" }}>
                    <IconButton onClick={() => navigate("/referral")}>
                        <Diversity3Icon />
                    </IconButton>

                    <IconButton onClick={() => navigate("/recommendation")}>
                        <AddCircleOutlineIcon />
                    </IconButton>
                </Box>
                <SearchBar />

                <Box sx={{ alignSelf: "flex-start", width: "100%", marginTop: "24px" }}>
                    <TotalLabel>Total</TotalLabel>
                </Box>
                <NetworkData data={data} />
            </Box>
            <NavigationBar />
        </StyledContainer>
    );
}
