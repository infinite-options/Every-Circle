import React, {useState} from 'react';
import StyledContainer from "../common/StyledContainer";
import Header from "../common/Header";
import CircleButton from "../common/CircleButton";
import NavigationBar from "../navigation/NavigationBar";
import { Box } from "@mui/material";
import TemplateStep from '../ProfileSetup/Steps/TemplateStep';
import { useLocation, useNavigate } from "react-router-dom";
import axios from 'axios';
import APIConfig from "../../APIConfig";

export default function SelectTemplate() {
    const location = useLocation();
    const navigate = useNavigate();
    const {data} = location.state || {};
    const [template, setTemplate] = useState(1);
    // console.log('data in select template', data);

    const formData = {
        firstName: data.firstName,
        lastName: data.lastName,
        shortBio: data.shortBio,
        location: data.location,
        phoneNumber: data.phoneNumber,
        favImage: data.favImage || data.profileImages?.[0],
    }

    const handleTemplateSelect = (template) => {
        setTemplate(template);
      }

    const handleSelectButton = async () => {
        const form = new FormData();
        form.append("profile_template", template);
        form.append("profile_uid", data.profileId);
        try {
            const response = await axios.put(`${APIConfig.baseURL.dev}/profile`, form);
            console.log("template updated successfully", response);
            if (response.data.code === 200) {
                navigate("/profile", {state:{editMode: "true"}})
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
                <TemplateStep formData={formData} handleTemplateSelect={handleTemplateSelect}/>
                <CircleButton width={100} height={100} text="Select Template" onClick={handleSelectButton}/>
            </Box>
            <NavigationBar />
        </StyledContainer>
    )
}
