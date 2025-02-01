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
import { useUserContext } from "../contexts/UserContext";
import axios from "axios";
import DialogBox from "../common/DialogBox";
import CircleImageUpload from '../common/CircleImageUpload';
import Autocomplete from "./AutoComplete";

export default function RecommendationForm() {
    const initialFormData = {
        businessName: "",
        location: "",
        rating: 0,
        lastInteraction: null,
        review: "",
        owner: "",
        phoneNumber: "",
        yelpUrl: "",
        websiteUrl: "",
        email: "",
        receiptImage: null,
        googleId: "",
        googleRating: "",
        googlePhotos: [],
        priceLevel: "",
    };
    const [formData, setFormData] = useState(initialFormData);
    const { user } = useUserContext();
    const { profileId } = user
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleOpen = () => setDialogOpen(true);
    const handleClose = () => setDialogOpen(false);

    const resetForm = () => {
        setFormData(initialFormData);
    };

    const handleImageUpload = (file) => {
        console.log('in file upload', file)
        setFormData(prev => ({
            ...prev,
            receiptImage: file,
        }));
    };

    const handleDeleteImage = (imageUrl) => {
        setFormData((prev) => ({
            ...prev,
            receiptImage: null,
        }));
    }

    const getAutoCompleteData = (data) => {
        console.log('data in get', data)
        const photos = data?.photos?.map((photo) => photo.getUrl()) || [];
        console.log("photos--", photos);
        setFormData(prev => ({
            ...prev,
            businessName: data.name || "",
            location: data.formatted_address || "",
            phoneNumber: data.formatted_phone_number || "",
            websiteUrl: data.website || "",
            googleId: data.place_id || "",
            googleRating: data.rating || "",
            googlePhotos: photos,
            priceLevel: data.price_level || "",
            addressLine1: data.addressLine1 || "",
            addressLine2: data.addressLine2 || "",
            city: data.city || "",
            state: data.state || "",
            country: data.country || "",
            zip: data.zip || "",
            latitude: data.geometry.location.lat() || "",
            longitude: data.geometry.location.lng() || ""
        }));
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log(formData);
        try {
            const form = new FormData();
            form.append('profile_uid', profileId);
            // form.append('rating_business_name',formData.businessName);
            form.append('rating_business_address_line_1', formData.addressLine1);
            form.append('rating_business_address_line_2', formData.addressLine2);
            form.append('rating_business_city', formData.city);
            form.append('rating_business_state', formData.state);
            form.append('rating_business_country', formData.country);
            form.append('rating_business_country', formData.country);
            form.append('rating_business_zip_code', formData.zip);
            form.append('rating_business_latitude', formData.latitude);
            form.append('rating_business_longitude', formData.longitude);
            form.append('rating_business_yelp', formData.yelpUrl);
            form.append('rating_business_website', formData.websiteUrl);
            form.append('rating_star', formData.rating);
            form.append('rating_receipt_date', formData.lastInteraction?.format("MM-DD-YYYY"));
            form.append('rating_description', formData.review);
            // form.append('rating_owner', formData.owner);
            // form.append('rating_phonenumber', formData.phoneNumber);
            // form.append('rating_email', formData.email);
            form.append('rating_business_google_id', formData.googleId);
            // form.append('rating_googleRating', formData.googleRating);
            // form.append('rating_googlePhotos', formData.googlePhotos);
            // form.append('rating_priceLevel', formData.priceLevel);

            //upload image
            if (formData.receiptImage) {
                form.append('img_0', formData.receiptImage);
            }

            const response = await axios.post(`https://ioec2testsspm.infiniteoptions.com/ratings`, form);
            console.log("response from recommendations POST", response);
            if (response.status === 200) {
                handleOpen();
                resetForm();
            } else {
                console.log('Cannot add recommendation')
            }
        } catch (error) {
            console.log("Error occured when adding recommendation", error);
        }
    };

    return (
        <StyledContainer>
            <Header title="Recommendation" />
            <Box sx={{ width: '100%', padding: "10px 40px" }}>
                <form>
                    <Autocomplete getAutoCompleteData={getAutoCompleteData} formData={formData} />
                    {/* <InputField
                        label="Business Name"
                        value={formData.businessName}
                        onChange={(value) => setFormData({ ...formData, businessName: value })}
                    /> */}

                    <InputField
                        label="Location"
                        value={formData.location}
                        onChange={(value) => setFormData({ ...formData, location: value })}
                    />

                    <Box sx={{ mb: 3, display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="caption" sx={{ ml: 1, mb: 0.5, display: "block" }}>Rating (this info will be public)</Typography>
                        <Rating name="size-medium" value={formData.rating} onChange={(e, value) => setFormData({ ...formData, rating: value })} />
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

                    <Box sx={{ display: "flex", alignContent: "center", justifyContent: "space-evenly" }}>
                        <CircleImageUpload onImageUpload={(file) => handleImageUpload(file)}
                            handleDeleteImage={(imageUrl) => handleDeleteImage(imageUrl)}
                            imageUrl={formData.receiptImage} />

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