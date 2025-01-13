import React from "react";
import { useParams } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import speedyRotoLogo from "../../assets/speedy_roto.jpg";
import abcPlumbingLogo from "../../assets/ABCPlumbing.jpg";
import StyledContainer from "../common/StyledContainer";
import Header from "../common/Header";
import NavigationBar from "../navigation/NavigationBar";


export default function ShowTemplate() {
    const { name } = useParams();
    const data = [{
        name: "Speedy Roto",
        services: [
            "Clogged pipes & drain", "Leaky faucets & pipes", "Water heater repairs & installations",
            "Flood damage restoration", "Sewer line repairs & replacements", "Water softener installation & repair",
        ],
        googleRating: 4.5,
        contactInfo: {
            phone: "123-456-7890",
            email: "info@speedyroto.com",
            address: "123 Main St, Anytown, USA"
        },
        website: "https://www.speedyrooterplumbing.com/about-us",
        image: speedyRotoLogo
    },
    {
        name: "ABC Plumbing",
        services: [
            "Clogged pipes & drain", "Leaky faucets & pipes",
        ],
        googleRating: 4,
        contactInfo: {
            phone: "123-456-7890",
            email: "info@abcplumbing.com",
            address: "123 Main St, Anytown, USA"
        },
        website: "https://www.abcplumbing.com/about-us",
        image: abcPlumbingLogo
    }
    ]

    return (
        <StyledContainer>
            <Header title="Template" />
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, mt: 2 }}>
                <Typography variant="h5" sx={{fontSize:"24px", fontWeight:"bold"}}>
                    {name}
                </Typography>
                <Box sx={{ padding: "0px 16px", }}>
                    {data.map((item) => (item.name === name &&
                        <Box key={item.name}>
                            <Typography sx={{fontSize:"16px", marginBottom:"10px"}}><b>Our Services:</b> {item.services.join(", ")}</Typography>
                            <Typography sx={{fontSize:"16px", marginBottom:"10px"}}><b>Average Google Rating:</b> {item.googleRating}</Typography>
                            <Typography sx={{fontSize:"16px", marginBottom:"10px"}}><b>Contact Info:</b> {item.contactInfo.phone}</Typography>
                            <Typography sx={{fontSize:"16px", marginBottom:"10px"}}><b>Email:</b> {item.contactInfo.email}</Typography>
                            <Typography sx={{fontSize:"16px", marginBottom:"10px"}}><b>Address:</b> {item.contactInfo.address}</Typography>
                            <Typography sx={{fontSize:"16px", marginBottom:"10px"}}><b>Website:</b> {item.website}</Typography>
                            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "red" }}>
                                <img
                                    src={item.image}
                                    alt={item.name}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "contain",
                                    }}
                                />
                            </Box>
                        </Box>
                    ))}
                </Box>
            </Box>
            <NavigationBar />
        </StyledContainer>
    );
}
