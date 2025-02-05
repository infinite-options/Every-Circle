import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Typography, Rating, IconButton } from "@mui/material";
import StyledContainer from "../common/StyledContainer";
import Header from "../common/Header";
import NavigationBar from "../navigation/NavigationBar";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';


export default function ShowTemplate() {
    const { state } = useLocation();
    const navigate = useNavigate();
    const { data, searchString, searchResult } = state;
    console.log('data in show template', data);

    const handleback = () => {
        navigate("/search", { state: { searchString, searchResult } })
    }

    return (
        <StyledContainer>
            <Header title="Business Info" />
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, mt: 2, width: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", width: "100%", position: "relative", mt: 2 }}>
                    <IconButton sx={{ position: "absolute", left: 0 }} onClick={handleback}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h5" sx={{
                        fontSize: "24px", fontWeight: "bold", position: "absolute",
                        left: "50%",
                        transform: "translateX(-50%)"
                    }}>
                        {data.business_name}
                    </Typography>
                </Box>
                <Box sx={{ padding: "0px 16px", mt: 4 }}>

                    {/* <Typography sx={{fontSize:"16px", marginBottom:"10px"}}><b>Our Services:</b> {item.services.join(", ")}</Typography> */}
                    <Typography sx={{ fontSize: "16px", marginBottom: "10px" }}><b>Address:</b> {`${data.business_address_line_1} ${data.business_address_line_2}, ${data.business_city}, ${data.business_country}`}</Typography>
                    <Typography sx={{ fontSize: "16px", marginBottom: "10px" }}><b>Review:</b> {data.rating_description || "-"}</Typography>
                    <Box sx={{ alignItems: "Center", justifyContent: "left", display: "flex", marginBottom: "10px" }}>
                        <Typography sx={{ fontSize: "16px", textAlign: "center" }}><b>Rating:</b></Typography>
                        <Rating
                            value={data.rating_star}
                            readOnly
                            size="small"
                            sx={{ ml: 1 }}
                        />
                    </Box>
                    <Typography sx={{ fontSize: "16px", marginBottom: "10px" }}><b>Contact Info:</b> {data.business_phone_number || "-"}</Typography>
                    <Typography sx={{ fontSize: "16px", marginBottom: "10px" }}><b>Email:</b> {data.business_email || "-"}</Typography>
                    <Typography sx={{ fontSize: "16px", marginBottom: "10px" }}><b>Website:</b> {data.business_website || '-'}</Typography>
                    {/* <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "red" }}>
                        <img
                            src={item.image}
                            alt={item.name}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                            }}
                        />
                    </Box> */}
                </Box>
            </Box>
            <NavigationBar />
        </StyledContainer>
    );
}
