import React, { useState, useEffect } from "react";
import Header from "../common/Header";
import NavigationBar from "../navigation/NavigationBar";
import StyledContainer from "../common/StyledContainer";
import NetworkData from "./NetworkData";
import SearchBar from "../common/SearchBar";
import { Box, Typography, styled, IconButton } from "@mui/material";
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import { useNavigate } from "react-router-dom";
import { useUserContext } from "../contexts/UserContext";
import axios from "axios";
import APIConfig from "../../APIConfig";

const TotalLabel = styled(Typography)({
    color: "#1a1a1a",
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1,
    marginTop: "11px",
});

export default function Network() {
    const navigate = useNavigate();
    const [data, setData] = useState([]);

    const { user, updateUser } = useUserContext();

    useEffect(()=>{
        const fetchNetworkData = async () => {
            try {
                const response = await axios.get(`${APIConfig.baseURL.dev}/api/v1/connections/${user.profileId}`);

                console.log(response.data.result)
                setData(response.data.result.map((item, index) => ({
                    id: index + 1,  
                    ...item         
                })));
                

                // setMainCategories(mainCategories);
            } catch (error) {
                console.error("Error fetching categories:", error);
            }
        };

        if(user.role === "user"){
            fetchNetworkData();
        }
    }, [])

    return (
        <StyledContainer>
            <Header title="Network" />
            <Box sx={{ width: "100%", padding: "0px 16px 16px 16px" }}>
                <Box sx={{ width: "100%", paddingX: "16px", display: "flex", justifyContent: "space-between" }}>
                    <IconButton onClick={() => navigate("/referral")}>
                        <GroupAddIcon />
                    </IconButton>

                    <IconButton onClick={() => navigate("/recommendation")}>
                        <AddShoppingCartIcon />
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
