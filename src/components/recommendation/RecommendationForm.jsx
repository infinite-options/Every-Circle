import React, { useState } from "react";
import StyledContainer from "../common/StyledContainer";
import Header from "../common/Header";
import NavigationBar from "../navigation/NavigationBar";
import { Box, Rating, Typography, Button, IconButton, styled } from "@mui/material";
import { InputField } from "../common/InputField";
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import CircleButton from "../common/CircleButton";
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { useUserContext } from "../contexts/UserContext";
import axios from "axios";
import DialogBox from "../common/DialogBox";

const StyledButton = styled(Button)(({ width, height }) => ({
    width: width,
    height: height,
    borderRadius: "50%",
    backgroundColor: "#FF9500",
    color: "#fff",
    margin: "14px auto",
    display: "block",
    "&:hover": {
        backgroundColor: "#ffb300",
    },
    textTransform: "none",
}));


export default function RecommendationForm() {
    const initialFormData = {
        businessName: "",
        location: "",
        rating: 0,
        lastInteraction: dayjs(),
        review: "",
        owner: "",
        phoneNumber: "",
        yelpUrl: "",
        websiteUrl: "",
        email: "",
    };
    const [formData, setFormData] = useState(initialFormData);
    const { user } = useUserContext();
    const { userId } = user
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleOpen = () => setDialogOpen(true);
    const handleClose = () => setDialogOpen(false);

    const resetForm = () => {
        setFormData(initialFormData);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log(formData);
        try {
        const form = new FormData();
        form.append('user_uid', userId);
        form.append('rating_star', formData.rating);
        form.append('rating_description', formData.review);
        // form.append('rating_location', formData.location);
        // form.append('rating_owner', formData.owner);
        // form.append('rating_business_name',formData.businessName);
        // form.append('rating_phonenumber', formData.phoneNumber);
        // form.append('', formData.yelpUrl);
        // form.append('', formData.websiteUrl);
        // form.append('', formData.email);
        // form.append('', formData.lastInteraction.format("MM-DD-YYYY"));

        const response = await axios.post(`https://ioec2testsspm.infiniteoptions.com/ratings`, form);
        console.log(response)
        if (response.status === 200) {
            handleOpen();
            resetForm();
        } else {
            console.log('Cannot add recommendation')
        }           
    } catch(error){
        console.log("Error occured when adding recommendation", error);
    }

    };

    return (
        <StyledContainer>
            <Header title="Recommendation" />
            <Box sx={{ width: '100%', padding: "10px 40px" }}>
                <form>
                    <InputField
                        label="Business Name"
                        value={formData.businessName}
                        onChange={(value) => setFormData({ ...formData, businessName: value })}
                    />

                    <InputField
                        label="Location"
                        value={formData.location}
                        onChange={(value) => setFormData({ ...formData, location: value })}
                    />

                    <Box sx={{ mb: 3, display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="caption" sx={{ ml: 1, mb: 0.5, display: "block" }}>Rating (this info will be public)</Typography>
                        <Rating name="size-medium" defaultValue={formData.rating} onChange={(e, value) => setFormData({ ...formData, rating: value })} />
                    </Box>

                    <Box sx={{ mb: 3, display: "block", alignItems: "center" }}>
                        <Typography variant="caption" sx={{ ml: 1, mb: 0.5, }}>Last Interaction</Typography>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                                value={formData.lastInteraction}
                                onChange={(newValue) => setFormData({ ...formData, lastInteraction: newValue })}
                                sx={{ width: "100%", backgroundColor: "#e0e0e0" }}
                            />
                        </LocalizationProvider>
                    </Box>

                    <InputField
                        label="Short Review (this info will be public)"
                        value={formData.review}
                        onChange={(value) => setFormData({ ...formData, review: value })}
                        multiline={true}
                        rows={4}
                    />

                    <InputField
                        label="Owner"
                        value={formData.owner}
                        onChange={(value) => setFormData({ ...formData, owner: value })}
                    />


                    <InputField
                        label="Phone Number"
                        value={formData.phoneNumber}
                        onChange={(value) => setFormData({ ...formData, phoneNumber: value })}
                    />

                    <InputField
                        label="Yelp Link"
                        value={formData.yelpUrl}
                        onChange={(value) => setFormData({ ...formData, yelpUrl: value })}
                    />

                    <InputField
                        label="Website Link"
                        value={formData.websiteUrl}
                        onChange={(value) => setFormData({ ...formData, websiteUrl: value })}
                    />

                    <InputField
                        label="Email"
                        value={formData.email}
                        onChange={(value) => setFormData({ ...formData, email: value })}
                    />

                    <Box sx={{ display: "flex" }}>
                        <StyledButton
                            component="label"
                            width={100}
                            height={100}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                            }}
                        >
                            <input
                                type="file"
                                hidden
                                accept="image/*"
                            // onChange={handleImageChange}
                            />
                            Upload Receipt
                        </StyledButton>

                        <CircleButton width={100} height={100} text="Save" onClick={handleSubmit} />
                    </Box>
                </form>
                <DialogBox
                    open={dialogOpen}
                    title="Success"
                    content="Thank you for adding your recommendation!"
                    button1Text="Ok"
                    button1Action={handleClose}
                    handleClose={handleClose}
                />
            </Box>
            <NavigationBar />
        </StyledContainer>
    )
}