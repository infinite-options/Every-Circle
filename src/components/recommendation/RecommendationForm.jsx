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
import SquareImageUpload from '../common/SquareImageUpload';
import Autocomplete from "./AutoComplete";

export default function RecommendationForm() {
    const initialFormData = {
        businessName: "",
        location: "",
        rating: 0,
        lastInteraction: null,
        review: "",
        ownerFname: "",
        ownerLname: "",
        phoneNumber: "",
        yelpUrl: "",
        websiteUrl: "",
        email: "",
        receiptImage: null,
        googleId: "",
        googleRating: "",
        googlePhotos: [],
        priceLevel: "",
        businessCategory: "",
    };
    const [formData, setFormData] = useState(initialFormData);
    const { user } = useUserContext();
    const { profileId } = user
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedImages, setSelectedImages] = useState([]);

    const businessCategories = [
        { id: "000-000100", name: "Beauty & Personal Care" },
        { id: "000-000200", name: "Health & Wellness" },
        { id: "000-000300", name: "Home Services" },
        { id: "000-000400", name: "Professional Services" },
        { id: "000-000500", name: "Automotive" },
        { id: "000-000600", name: "Education & Training" },
        { id: "000-000700", name: "Events & Entertainment" },
        { id: "000-000800", name: "Pet Services" },
        { id: "000-000900", name: "Restaurants & Food" },
        { id: "000-001000", name: "Retail & Shopping" },
        { id: "000-001100", name: "Finance & Banking" },
    ];

    const handleOpen = () => setDialogOpen(true);
    const handleClose = () => setDialogOpen(false);

    const resetForm = () => {
        setFormData(initialFormData);
        setSelectedImages([]);
    };

    const handleReceiptUpload = (file) => {
        console.log('in file upload', file)
        setFormData(prev => ({
            ...prev,
            receiptImage: file,
        }));
    };

    const handleDeleteReceiptImage = () => {
        setFormData((prev) => ({
            ...prev,
            receiptImage: null,
        }));
    }

    const handleImageUpload = (index, file) => {
        let currentIndex = selectedImages.length;
        const fileObj = {
            index: currentIndex,
            file: file,
            coverPhoto: currentIndex + index === 0
        };
        setSelectedImages(prev => ([
            ...prev,
            fileObj,
        ]));
    };

    const handleDeleteImage = (imageUrl) => {
        const updatedImages = selectedImages.filter((img) => img.file.name != imageUrl.name);
        setSelectedImages(updatedImages);
    }

    const handleFavImage = (imageUrl) => {
        const updatedImages = formData.selectedImages.map((img) => ({ ...img, coverPhoto: img.file.name === imageUrl.name }));
        setSelectedImages(updatedImages);
    }

    const getAutoCompleteData = (data) => {
        console.log('data in get', data)
        const photos = data?.photos?.map((photo) => photo.getUrl()) || [];
        console.log("photos--", photos, typeof (photos));
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
            longitude: data.geometry.location.lng() || "",
            types: data.types || []
        }));
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log(formData);
        try {
            const form = new FormData();
            form.append('profile_uid', profileId);
            form.append('rating_business_name', formData.businessName);
            form.append('rating_business_address_line_1', formData.addressLine1);
            form.append('rating_business_address_line_2', formData.addressLine2);
            form.append('rating_business_city', formData.city);
            form.append('rating_business_state', formData.state);
            form.append('rating_business_country', formData.country);
            form.append('rating_business_zip_code', formData.zip);
            form.append('rating_business_latitude', formData.latitude);
            form.append('rating_business_longitude', formData.longitude);
            form.append('rating_business_yelp', formData.yelpUrl);
            form.append('rating_business_website', formData.websiteUrl);
            form.append('rating_star', formData.rating);
            form.append('rating_receipt_date', formData.lastInteraction?.format("MM-DD-YYYY"));
            form.append('rating_description', formData.review);
            // form.append('rating_business_owner_fn', formData.ownerFname);
            // form.append('rating_business_owner_ln', formData.ownerLname);
            form.append('rating_business_phone_number', formData.phoneNumber);
            form.append('rating_business_email_id', formData.email);
            form.append('rating_business_google_id', formData.googleId);
            form.append('rating_business_google_rating', formData.googleRating);
            form.append('rating_business_google_photos', JSON.stringify(formData.googlePhotos));
            form.append('rating_business_price_level', formData.priceLevel);
            // form.append('rating_business_types', JSON.stringify(formData.types))

            //upload image
            if (formData.receiptImage) {
                form.append('img_receipt', formData.receiptImage);
            }

            let i = 0;
            for (const file of selectedImages) {
                let key = `img_${i++}`;
                form.append(key, file.file);
                if (file.coverPhoto) {
                    form.append("img_favorite", key);
                }
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
                        label="Business Category"
                        value={formData.businessCategory}
                        onChange={(value) => setFormData({ ...formData, businessCategory: value })}
                        options={businessCategories} // pass data for dropdown
                    />

                    <InputField
                        label="Owner First Name"
                        value={formData.ownerFname}
                        onChange={(value) => setFormData({ ...formData, ownerFname: value })}
                    />

                    <InputField
                        label="Owner Last Name"
                        value={formData.ownerLname}
                        onChange={(value) => setFormData({ ...formData, ownerLname: value })}
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

                    <Box sx={{ display: "flex", gap: 2, my: 3, justifyContent: "space-between" }}>
                        {[0, 1, 2].map((index) => {
                            return (
                                <SquareImageUpload
                                    key={index}
                                    index={index}
                                    onImageUpload={(file) => handleImageUpload(index, file)}
                                    image={selectedImages[index]}
                                    imageUrl={selectedImages[index]?.file}
                                    handleDeleteImage={(imageUrl) => handleDeleteImage(imageUrl)}
                                    handleFavImage={(imageUrl) => handleFavImage(imageUrl)}
                                    size={100}
                                    shape="square"
                                />
                            )
                        })}
                    </Box>

                    <Box sx={{ display: "flex", alignContent: "center", justifyContent: "space-evenly" }}>
                        <CircleImageUpload onImageUpload={(file) => handleReceiptUpload(file)}
                            handleDeleteImage={(imageUrl) => handleDeleteReceiptImage(imageUrl)}
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