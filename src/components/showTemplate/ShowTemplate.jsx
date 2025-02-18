import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Typography, Rating, IconButton } from "@mui/material";
import axios from "axios";
import StyledContainer from "../common/StyledContainer";
import NavigationBar from "../navigation/NavigationBar";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { DataGrid } from '@mui/x-data-grid';
import {
    DarkShowTemplate,
    ModernShowTemplate,
    MinimalistShowTemplate,
    SplitShowTemplate,
    CreativeShowTemplate
} from '../profileTemplate';
import APIConfig from "../../APIConfig";
import { useUserContext } from "../contexts/UserContext";

const templates = [
    { component: DarkShowTemplate, value: 'Dark', id: 0 },
    { component: ModernShowTemplate, value: 'modern', id: 1 },
    { component: MinimalistShowTemplate, value: 'minimalist', id: 2 },
    { component: SplitShowTemplate, value: 'split', id: 3 },
    { component: CreativeShowTemplate, value: 'creative', id: 4 }
];

const columns = [
    { field: 'rating_business_id', headerName: 'Business ID', width: 150 },
    {
        field: 'rating_star',
        headerName: 'Rating',
        width: 180,
        renderCell: (params) => {
          return <Rating value={params.value} readOnly />;
        },
    },
    { field: 'rating_description', headerName: 'Description', width: 300 },
];

export default function ShowTemplate() {
    const { state } = useLocation();
    const navigate = useNavigate();
    const { profileId, navigatingFrom } = state;
    const { user } = useUserContext();
    
    const [data, setData] = useState(null);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [ratings, setRatings] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        const fetchData = async () => {
            try {
                const endpoint = navigatingFrom === "businessProfile" || navigatingFrom === "link" 
                    ? `${APIConfig.baseURL.dev}/business/${profileId}` 
                    : `${APIConfig.baseURL.dev}/profile/${profileId}`;
                
                const response = await axios.get(endpoint);
                // console.log(response?.data)
                if(navigatingFrom === "businessProfile" || navigatingFrom === "link"){
                    setData(response?.data?.result[0]);
                }else{
                    setRatings(response.data['ratings result']);
                    setData(response?.data?.result[0]);
                }

            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        
        const clickCharge = async () => {
            try {
                const endpoint = `${APIConfig.baseURL.dev}/charges`;
 
                const chargeData = {
                    charge_business_id: profileId,
                    charge_caused_by_user_id: state.recommendBy
                };
   
                const response = await axios.post(endpoint, chargeData);
                console.log(response)
        
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        
        
        if(dataLoaded === false){
            
            if(navigatingFrom === "link" && user.profileId !== state.recommendBy){
                clickCharge();
            }

            fetchData();
        }

        setDataLoaded(true)
        
    }, [profileId, navigatingFrom]);
    
    if (loading) {
        return <Box>Loading...</Box>;
    }
    
    if (!data) {
        return <Box>Error loading data</Box>;
    }
    
    const templateId = data.profile_template || data.business_template || 0;
    const SelectedTemplate = templates[templateId].component;

    const handleBack = () => {
        if (navigatingFrom === "profilePage") {
            navigate("/profile");
        } else if (navigatingFrom === "businessProfile") {
            navigate("/businessProfile");
        } else if (navigatingFrom === "networkPage") {
            navigate("/network");
        } else {
            navigate("/search", { state: { searchString: state.searchString, searchResult: state.searchResult } });
        }
    };
    
    return (
        <StyledContainer>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, width: "100%", height: "100%", flexGrow: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", width: "100%", position: "relative", mt: 2 }}>
                    <IconButton sx={{ position: "absolute", left: 0 }} onClick={handleBack}>
                        <ArrowBackIcon />
                    </IconButton>
                </Box>
                <Box sx={{ width: '100%', height: '100%', minHeight: '100%', justifyContent: "center", alignItems: "center", display: "flex", flexDirection: "column", flex: 1 }}>
                    <SelectedTemplate
                        name={data.business_name || `${data.profile_first_name} ${data.profile_last_name}`}
                        tagLine={data.business_tag_line || data.profile_tag_line || ''}
                        phoneNumber={data.business_phone_number || data.profile_phone || ""}
                        bio={data.business_short_bio || data.profile_short_bio || ''}
                        location={`${data.business_city || data.profile_city || ''}, ${data.business_state || data.profile_state || ''}, ${data.business_country || data.profile_country || ''}` || 'Location'}
                        avatarUrl={data.business_favorite_image || data.profile_favorite_image}
                        imageList={
                            data.business_google_photos ? JSON.parse(data.business_google_photos).filter(photo => photo !== data.business_favorite_image) :
                            data.business_images_url ? JSON.parse(data.business_images_url) :
                            data.profile_images_url ? JSON.parse(data.profile_images_url) :
                            []
                        }
                        yelp={data.business_yelp || ""}
                        google={data.business_google || ""}
                        website={data.business_website || ""}
                        youtube={data.profile_youtube_link || ""}
                        twitter={data.profile_twitter_link || ""}
                        linkedin={data.profile_linkedin_link || ""}
                        facebook={data.profile_facebook_link || ""}
                        needHelpTags={data.profile_how_can_we_help ? JSON.parse(data.profile_how_can_we_help) : []}
                        helpTags={data.profile_how_can_you_help ? JSON.parse(data.profile_how_can_you_help) : []}
                        rating={navigatingFrom === "rating" ? data.rating_description : ""}
                        role={navigatingFrom === "businessProfile" ? "business" : "user"}
                    />
                </Box>

                {(navigatingFrom !== "businessProfile" && navigatingFrom !== "link") && <Box sx={{ width: '100%', my: 3 }}>
                    <Typography variant="h6" align="center" sx={{ mb: 2 }}>
                        Recommendations
                    </Typography>
                    <div style={{ height: 400, width: '100%' }}>
                        <DataGrid rows={ratings} columns={columns} pageSize={5} getRowId={(row) => row.rating_uid}/>
                    </div>
                </Box>}
            </Box>
            <NavigationBar />
        </StyledContainer>
    );
}
