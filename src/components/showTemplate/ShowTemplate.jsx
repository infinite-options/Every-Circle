import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Typography, Rating, IconButton } from "@mui/material";
import StyledContainer from "../common/StyledContainer";
import Header from "../common/Header";
import NavigationBar from "../navigation/NavigationBar";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
    DarkTemplate,
    ModernTemplate,
    MinimalistTemplate,
    SplitTemplate,
    CreativeTemplate
} from '../profileTemplate';
import { useUserContext } from "../contexts/UserContext";


export default function ShowTemplate() {
    const { state } = useLocation();
    const navigate = useNavigate();
    const { data, searchString, searchResult, navigatingFrom } = state;
    const [template, setTemplate] = useState(data.business_template || 0);
    const otherImages = data?.business_google_photos ? JSON.parse(data.business_google_photos)?.filter((photo) => photo !== data.business_favorite_image) : [];

    const templates = [
        {
            component: DarkTemplate,
            value: 'Dark',
            id: 0,
        },
        {
            component: ModernTemplate,
            value: 'modern',
            id: 1,
        },
        {
            component: MinimalistTemplate,
            value: 'minimalist',
            id: 2,
        },
        {
            component: SplitTemplate,
            value: 'split',
            id: 3,
        },
        {
            component: CreativeTemplate,
            value: 'creative',
            id: 4
        }
    ];

    const SelectedTemplate = templates[template].component;


    const handleback = () => {
        navigate("/search", { state: { searchString, searchResult } })
    }

    return (
        <StyledContainer>
            {/* <Header title="Business Info" /> */}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, width: "100%", height: "100%", flexGrow: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", width: "100%", position: "relative", mt: 2 }}>
                    <IconButton sx={{ position: "absolute", left: 0 }} onClick={handleback}>
                        <ArrowBackIcon />
                    </IconButton>
                </Box>
                <Box sx={{
                    width: '100%',
                    height: '100%',
                    minHeight: '100%',
                    // padding: "0px 20px",
                    justifyContent: "center",
                    alignItems: "center",
                    display: "flex",
                    flexDirection: "column",
                    flex: 1
                }}>
                    <SelectedTemplate
                        name={data.business_name}
                        tagLine={data.business_tag_line || ''}
                        phoneNumber={data.business_phone_number || ""}
                        bio={data.business_short_bio || 'Your bio will appear here'}
                        location={`${data.business_city || ''}, ${data.business_state || ''}, ${data.business_country || ''}` || 'Location'}
                        avatarUrl={data.business_favorite_image}
                        imageList={otherImages}
                        yelp={data.business_yelp}
                        google={data.business_google}
                        website={data.business_website}
                        rating={navigatingFrom === "rating" ? data.rating_description : ""}
                        role={"business"} // display the details of the business
                    />
                </Box>
            </Box>
            <NavigationBar />
        </StyledContainer>
    );
}
