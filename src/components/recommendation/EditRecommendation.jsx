import React, { useEffect, useState } from "react";
import StyledContainer from "../common/StyledContainer";
import NavigationBar from "../navigation/NavigationBar";
import { Box, Rating, Typography} from "@mui/material";
import { InputField } from "../common/InputField";
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CircleButton from "../common/CircleButton";
import DialogBox from "../common/DialogBox";
import CircleImageUpload from '../common/CircleImageUpload';
import SquareImageUpload from '../common/SquareImageUpload';
import { useLocation, useNavigate } from "react-router-dom";
import dayjs from 'dayjs';
import axios from "axios";
import Header from "../common/Header";

const EditRecommendation = ({ prevData, onSave }) => {
    const location = useLocation();
    const [formData, setFormData] = useState(location.state?.formData || {});
    const [selectedImages, setSelectedImages] = useState([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (location?.state?.formData) {
            setSelectedImages(formData?.selectedImages);
            console.log("selected images", location?.state?.formData?.selectedImages);  
        }
    }, [location?.state?.formData]);

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
        const updatedImages = selectedImages.filter((img) => img.file != imageUrl);
        setSelectedImages(updatedImages);
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.rating) {
            setRatingDialogOpen(true);
            return;
        }
        try {
            const form = new FormData();
            // form.append('rating_business_yelp', formData.yelpUrl);
            // form.append('rating_business_website', formData.websiteUrl);
            form.append('rating_star', formData.rating);
            form.append('rating_receipt_date', formData.lastInteraction ? dayjs(formData.lastInteraction).format("MM-DD-YYYY") : "");
            form.append('rating_description', formData.review);
            form.append('rating_uid', formData.ratingid);
            // form.append('rating_business_phone_number', formData.phoneNumber);
            // form.append('rating_business_email_id', formData.email);

            //upload image
            if (formData.receiptImage) {
                form.append('img_receipt', formData.receiptImage);
            }


            let i = 0;
            let index = 0;
            for (const file of selectedImages) {
                if(file.file !== formData.selectedImages[i]?.file){
                    let key = `img_${index++}`;
                    form.append(key, file.file);
                    if (file.coverPhoto) {
                        form.append("img_favorite", key);
                    }
                }else{
                    i++;
                }
            }

            const response = await axios.put(`https://ioec2testsspm.infiniteoptions.com/api/v3/ratings_v3`, form);
            // console.log("response from recommendations put", response);
            if (response.status === 200) {
                navigate(-1)
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
            <Box sx={{ width: "100%", padding: "10px 40px" }}>
                <form>
                    <InputField
                        disabled
                        label="Business Name"
                        value={formData.businessName}
                        onChange={(value) => setFormData({ ...formData, businessName: value })}
                    />

                    <InputField
                        disabled
                        label="Location"
                        value={formData.location}
                        onChange={(value) => setFormData({ ...formData, location: value })}
                    />

                    <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="caption">Rating (this info will be public)</Typography>
                        <Rating
                            name="size-medium"
                            value={formData.rating}
                            onChange={(e, value) => setFormData({ ...formData, rating: value })}
                        />
                    </Box>

                    <Box sx={{ mb: 3 }}>
                        <Typography variant="caption">Last Interaction</Typography>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                                value={dayjs(formData.lastInteraction, "MM-DD-YYYY")}
                                onChange={(newValue) => setFormData({ ...formData, lastInteraction: newValue })}
                                sx={{ width: "100%", backgroundColor: "#e0e0e0" }}
                            />
                        </LocalizationProvider>
                    </Box>

                    <InputField
                        label="Short Review"
                        value={formData.review}
                        onChange={(value) => setFormData({ ...formData, review: value })}
                        multiline
                        rows={4}
                    />

                    <InputField
                        disabled
                        label="Owner First Name"
                        value={formData.ownerFname}
                        onChange={(value) => setFormData({ ...formData, ownerFname: value })}
                    />

                    <InputField
                        disabled
                        label="Owner Last Name"
                        value={formData.ownerLname}
                        onChange={(value) => setFormData({ ...formData, ownerLname: value })}
                    />

                    <InputField
                        disabled
                        label="Phone Number"
                        value={formData.phoneNumber}
                        onChange={(value) => setFormData({ ...formData, phoneNumber: value })}
                    />

                    <InputField
                        disabled
                        label="Yelp Link"
                        value={formData.yelpUrl}
                        onChange={(value) => setFormData({ ...formData, yelpUrl: value })}
                    />

                    <InputField
                        disabled
                        label="Website Link"
                        value={formData.websiteUrl}
                        onChange={(value) => setFormData({ ...formData, websiteUrl: value })}
                    />

                    <InputField
                        disabled
                        label="Business Email"
                        value={formData.email}
                        onChange={(value) => setFormData({ ...formData, email: value })}
                    />

                    <Box sx={{ display: "flex", gap: 2, my: 3 }}>
                        {[0, 1, 2].map((index) => (
                            <SquareImageUpload
                                key={index}
                                index={index}
                                onImageUpload={(file) => handleImageUpload(index, file)}
                                image={selectedImages[index]}
                                imageUrl={selectedImages[index]?.file}
                                handleDeleteImage={(imageUrl) => handleDeleteImage(imageUrl)}
                                size={100}
                                shape="square"
                            />
                        ))}
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "space-evenly" }}>
                        <CircleImageUpload
                            onImageUpload={(file) => setFormData({ ...formData, receiptImage: file })}
                            imageUrl={formData.receiptImage}
                        />

                        <CircleButton width={100} height={100} text="Save Changes" onClick={handleSubmit} />
                    </Box>
                </form>

                <DialogBox
                    open={dialogOpen}
                    title="Success"
                    content="Your changes have been saved!"
                    button1Text="Ok"
                    button1Action={() => setDialogOpen(false)}
                    handleClose={() => setDialogOpen(false)}
                />

                <DialogBox
                    open={ratingDialogOpen}
                    title="Error"
                    content="Please rate the business before saving."
                    button1Text="Ok"
                    button1Action={() => setRatingDialogOpen(false)}
                    handleClose={() => setRatingDialogOpen(false)}
                />
            </Box>
            <NavigationBar />
        </StyledContainer>
    );
};

export default EditRecommendation;
