import React, {useState} from 'react';
import StyledContainer from "../common/StyledContainer";
import Header from "../common/Header";
import CircleButton from "../common/CircleButton";
import NavigationBar from "../navigation/NavigationBar";
import { Box } from "@mui/material";
import BusinessTemplateStep from '../ProfileSetup/BusinessSteps/BusinessTemplateStep';
import { useLocation, useNavigate } from "react-router-dom";
import axios from 'axios';
import APIConfig from "../../APIConfig";

export default function SelectBusinessTemplate() {
    const location = useLocation();
    const navigate = useNavigate();
    const {data} = location.state || {};
    const [template, setTemplate] = useState(0);
    console.log('data in select businesstemplate', data);

    const formData = {
        businessName: data.businessName,
        city: data.city,
        state: data.state,
        country: data.country,
        email: data.email,
        phoneNumber: data.phoneNumber,
        tagLine: data.tagLine,
        shortBio: data.shortBio,
        template: data.template,
        website: data.website,
        yelp: data.yelp,
        google: data.google,
        favImage: data.favImage || data.businessGooglePhotos?.[0],
        businessGooglePhotos: data.businessGooglePhotos,
    }

    const handleTemplateSelect = (template) => {
        console.log('selected Template is', template);
        setTemplate(template);
      }

    const handleSelectButton = async () => {
        const form = new FormData();
        form.append("business_template", template);
        form.append("business_uid", data.businessId);
        try {
            const response = await axios.put(`${APIConfig.baseURL.dev}/business`, form);
            console.log("template updated successfully", response);
            if (response.data.code === 200) {
                navigate("/businessProfile", {state:{editMode: "true"}})
            } else {
              alert("Error updating template");
            }
          } catch (error) {
            console.error("Error updating profile:", error);
          }
    }

    return (
        <StyledContainer>
            <Header title="Select Template" />
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <BusinessTemplateStep formData={formData} handleTemplateSelect={handleTemplateSelect} role={"business"}/>
                <CircleButton width={100} height={100} text="Select Template" onClick={handleSelectButton}/>
            </Box>
            <NavigationBar />
        </StyledContainer>
    )
}
