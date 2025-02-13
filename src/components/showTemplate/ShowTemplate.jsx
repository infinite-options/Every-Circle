import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Typography, Rating, IconButton } from "@mui/material";
import StyledContainer from "../common/StyledContainer";
import Header from "../common/Header";
import NavigationBar from "../navigation/NavigationBar";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
    DarkShowTemplate,
    ModernShowTemplate,
    MinimalistShowTemplate,
    SplitShowTemplate,
    CreativeTemplate
} from '../profileTemplate';
import { useUserContext } from "../contexts/UserContext";


export default function ShowTemplate() {
    const { state } = useLocation();
    const navigate = useNavigate();
    const { user } = useUserContext();
    console.log(user.profile)
    const { data, searchString, searchResult, navigatingFrom } = state;
    const [template, setTemplate] = useState(navigatingFrom === "profileId" ? parseInt(user.profile.profile_template) : data.business_template || 0);
    const otherImages = data?.business_google_photos ? JSON.parse(data.business_google_photos)?.filter((photo) => photo !== data.business_favorite_image) : [];

    const templates = [
        {
            component: DarkShowTemplate,
            value: 'Dark',
            id: 0,
        },
        {
            component: ModernShowTemplate,
            value: 'modern',
            id: 1,
        },
        {
            component: MinimalistShowTemplate,
            value: 'minimalist',
            id: 2,
        },
        {
            component: SplitShowTemplate,
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
                    {navigatingFrom !== "profileId" ? <SelectedTemplate
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
                    /> : 
                    <SelectedTemplate
                        name={user.profile.profile_first_name + " " + user.profile.profile_last_name}
                        tagLine={user.profile.profile_tag_line || ''}
                        phoneNumber={user.profile.profile_phone || ""}
                        bio={user.profile.profile_short_bio || 'Your bio will appear here'}
                        location={`${user.profile.profile_city || ''}, ${user.profile.profile_state || ''}, ${user.profile.profile_country || ''}` || 'Location'}
                        avatarUrl={data.business_favorite_image}
                        imageList={otherImages}
                        youtube={user.profile.profile_youtube_link || ""}
                        twitter={user.profile.profile_twitter_link || ""}
                        linkedin={user.profile.profile_linkedin_link || ""}
                        facebook={user.profile.profile_facebook_link || ""}
                        needHelpTags={user.profile.profile_how_can_we_help ? JSON.parse(user.profile.profile_how_can_we_help) : []}
                        helpTags={user.profile.profile_how_can_you_help ? JSON.parse(user.profile.profile_how_can_you_help) : []}
                        rating={navigatingFrom === "rating" ? data.rating_description : ""}
                        role={"user"}
                    />}
                </Box>
            </Box>
            <NavigationBar />
        </StyledContainer>
    );
}
