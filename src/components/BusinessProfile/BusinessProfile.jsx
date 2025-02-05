import React, { useState, useEffect } from "react";
import { Box, Typography, styled, IconButton, TextField } from "@mui/material";
import { SocialLink } from "./SocialLink";
import { InputField } from "../common/InputField";
// import ImageUpload from '../common/ImageUpload';
import SquareImageUpload from '../common/SquareImageUpload';
import StyledContainer from "../common/StyledContainer";
import Header from "../common/Header";
import yelp from "../../assets/yelp.png";
import google from "../../assets/Google.png";
import website from "../../assets/website.png";
import CircleButton from "../common/CircleButton";
import NavigationBar from "../navigation/NavigationBar";
import axios from "axios";
import APIConfig from "../../APIConfig";
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserContext } from "../contexts/UserContext";
import { DataValidationUtils } from "../auth/authUtils/DataValidationUtils";
import DialogBox from "../common/DialogBox";
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteIcon from '@mui/icons-material/Delete';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ImageList from '@mui/material/ImageList';
import ImageListItem from '@mui/material/ImageListItem';

const FormBox = styled(Box)({
    padding: "0 16px",
});

export default function BusinessProfile() {
    const location = useLocation();
    const { editMode: initialEditMode = false } = location.state || {};
    const { user, updateUser } = useUserContext();
    // console.log('user data', user);
    const userId = user.userId;
    const [formData, setFormData] = useState({
        businessName: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        zip: "",
        country: "",
        einNumber: "",
        email: "",
        phoneNumber: "",
        tagLine: "",
        shortBio: "",
        template: "",
        website: "",
        yelp: "",
        google: "",
        priceLevel: "",
        googleRating: "0",
        businessImages: [],
        businessGooglePhotos: [],
        favImage: "",
        googleId: "",
        businessId: "",
    });
    const [businessId, setBusinessId] = useState("");
    const [editMode, setEditMode] = useState(initialEditMode);
    const [errors, setErrors] = useState({});
    const { isValidPhoneNumber, formatPhoneNumber } = DataValidationUtils;
    const [dialog, setDialog] = useState({
        open: false,
        title: "",
        content: "",
    });
    const [selectedImages, setSelectedImages] = useState([]);
    const [deletedImages, setDeletedImages] = useState([]);
    const [showSpinner, setShowSpinner] = useState(false);
    const [favoriteIcons, setFavoriteIcons] = useState([]);
    const [deletedIcons, setDeletedIcons] = useState([]);

    const navigate = useNavigate();

    const templateMap = {
        1: "modern",
        2: "minimalist",
        3: "split",
        4: "creative",
    }

    const handleOpen = (title, content) => {
        setDialog({ open: true, title, content });
    };

    const handleClose = () => {
        setDialog({ open: false, title: "", content: "" });
    };


    const handleDeleteImage = (idx) => {
        const updatedGooglePhotos = formData.businessGooglePhotos.filter((photo, index) => index !== idx);
        // console.log(updatedGooglePhotos);
        setFormData((prev) => ({ ...prev, businessGooglePhotos: updatedGooglePhotos }));
    }

    const handleFavImage = (idx) => {
        const newFav = formData.businessGooglePhotos[idx];
        setFormData((prev) => ({ ...prev, favImage: newFav }));
        const updatedFavIcons = favoriteIcons.map((_, index) => index === idx ? true : false);
        // console.log(updatedFavIcons, idx);
        setFavoriteIcons(updatedFavIcons);
    }

    const fetchProfile = async () => {
        try {
            setShowSpinner(true);
            const response = await axios.get(`https://ioec2testsspm.infiniteoptions.com/business/${userId}`);
            console.log('response from business endpoint', response);
            if (response.status === 200) {
                const business = response.data?.result?.[0];
                console.log('business data is', business);
                const googlePhotos = business?.business_google_photos ? JSON.parse(business.business_google_photos) : [];
                // console.log('parsed google images', googlePhotos);
                setFormData({
                    ...formData,
                    businessName: business.business_name || "a",
                    addressLine1: business.business_address_line_1 || "",
                    addressLine2: business.business_address_line_2 || "",
                    city: business.business_city || "",
                    state: business.business_state || "",
                    zip: business.business_zip_code || "",
                    country: business.business_country || "",
                    einNumber: business.business_ein_number || "",
                    email: business.business_email_id || "",
                    phoneNumber: business.business_phone_number || "",
                    tagLine: business.business_tag_line || "",
                    shortBio: business.business_short_bio || "",
                    template: business.business_template || "",
                    website: business.business_website || "",
                    yelp: business.business_yelp || "",
                    google: business.business_google || "",
                    priceLevel: business.business_price_level || "",
                    googleRating: business.business_google_rating || "0",
                    businessImages: business.business_images_url || [],
                    businessGooglePhotos: googlePhotos,
                    favImage: business.business_favorite_image || "",
                    googleId: business.business_google_id || "",
                    businessId: business.business_uid,
                });
                setFavoriteIcons(googlePhotos ? googlePhotos.map((image, index) => index === 0) : []);
                setDeletedIcons(googlePhotos ? new Array(googlePhotos.length).fill(false) : []);
                //update data in context
                updateUser({ businessId: business.business_uid, business: business });
                setBusinessId(business.business_uid);
            }
        } catch (error) {
            console.error("Error fetching Business profile:", error);
        } finally {
            setShowSpinner(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [userId]);

    const validateRequiredFields = () => {
        const newErrors = {};
        ["businessName"].forEach((field) => {
            if (!formData[field]) {
                newErrors[field] = `${field} is required`;
            }
        });

        if (isValidPhoneNumber(formData.phoneNumber) === false) {
            newErrors["phoneNumber"] = "Invalid phone number format";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
        } else {
            setErrors({});
        }
        // console.log('The errors are', errors)
        return Object.keys(newErrors).length === 0;
    }




    //   const handleSubmit = async (e) => {
    //     e.preventDefault();
    //     if (validateRequiredFields()) {
    //       const form = new FormData();
    //       form.append("profile_first_name", formData.firstName);
    //       form.append("profile_last_name", formData.lastName);
    //       form.append("profile_phone", formData.phoneNumber);
    //       // form.append("profile_location", formData.location);
    //       form.append("profile_tag_line", formData.tagLine);
    //       form.append("profile_short_bio", formData.shortBio);
    //       form.append("profile_facebook_link", formData.facebookLink);
    //       form.append("profile_twitter_link", formData.twitterLink);
    //       form.append("profile_linkedin_link", formData.linkedinLink);
    //       form.append("profile_youtube_link", formData.youtubeLink);
    //       form.append("profile_template", formData.template);
    //       form.append("profile_how_can_we_help", JSON.stringify(formData.weHelp));
    //       form.append("profile_how_can_you_help", JSON.stringify(formData.youHelp));

    //       //image related fields 
    //       form.append("profile_images_url", JSON.stringify(formData.profileImages));

    //       let i = 0;
    //       for (const file of selectedImages) {
    //         let key = `img_${i++}`;
    //         form.append(key, file.file);
    //         if (file.coverPhoto) {
    //           form.append("img_favorite", key);
    //         }
    //       }

    //       if (deletedImages.length > 0) {
    //         form.append("delete_images", JSON.stringify(deletedImages));
    //       }

    //       if (formData.favImage) {
    //         form.append("profile_favorite_image", formData.favImage);
    //       } else {
    //         form.append("profile_favorite_image", "");
    //       }

    //       form.append("profile_uid", profileId);
    //       try {
    //         setShowSpinner(true);
    //         const response = await axios.put(`${APIConfig.baseURL.dev}/profile`, form);
    //         console.log("Profile updated successfully", response);
    //         if (response.data.code === 200) {
    //           // Fetch the latest profile data from the server
    //           await fetchProfile();
    //           setEditMode(false);
    //           handleOpen("Success", "Profile has been updated successfully.");
    //           // alert("Profile updated successfully");
    //         }
    //       } catch (error) {
    //         handleOpen("Error", "Cannot update the profile.");
    //         console.error("Error updating profile:", error);
    //       } finally {
    //         setShowSpinner(false);
    //       }
    //     } else {
    //       handleOpen("Error", "Cannot update the profile.");
    //       // alert("Error updating profile");
    //     }
    //   };

    return (
        <StyledContainer>
            <Backdrop sx={{ color: '#fff', zIndex: 1 }} open={showSpinner}>
                <CircularProgress color="inherit" />
            </Backdrop>
            <Header title="Business Profile" />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', padding: '0px 30px', width: '100%', }}>
                <EditIcon
                    onClick={() => setEditMode(!editMode)}
                    sx={{ cursor: 'pointer', color: editMode && "red" }}
                />
            </Box>
            <Box sx={{ borderRadius: '10px', margin: "10px 25px", padding: "10px", width: "100%" }}>
                <form>
                    <FormBox>
                        <InputField
                            required
                            label="Business Name"
                            value={formData.businessName}
                            onChange={(value) => setFormData({ ...formData, businessName: value })}
                            disabled={!editMode}
                            backgroundColor={editMode ? 'white' : '#e0e0e0'}
                            error={errors.businessName}
                            helperText={errors.businessName}
                        />
                        <InputField
                            label="Address Line 1"
                            value={formData.addressLine1}
                            onChange={(value) => setFormData({ ...formData, addressLine1: value })}
                            disabled={!editMode}
                            backgroundColor={editMode ? 'white' : '#e0e0e0'}
                        />

                        <InputField
                            label="Address Line 2"
                            value={formData.addressLine2}
                            onChange={(value) => setFormData({ ...formData, addressLine2: value })}
                            disabled={!editMode}
                            backgroundColor={editMode ? 'white' : '#e0e0e0'}
                        />

                        <InputField
                            label="City"
                            value={formData.city}
                            onChange={(value) => setFormData({ ...formData, city: value })}
                            disabled={!editMode}
                            backgroundColor={editMode ? 'white' : '#e0e0e0'}
                        />

                        <InputField
                            label="State"
                            value={formData.state}
                            onChange={(value) => setFormData({ ...formData, state: value })}
                            disabled={!editMode}
                            backgroundColor={editMode ? 'white' : '#e0e0e0'}
                        />

                        <InputField
                            label="Country"
                            value={formData.country}
                            onChange={(value) => setFormData({ ...formData, country: value })}
                            disabled={!editMode}
                            backgroundColor={editMode ? 'white' : '#e0e0e0'}
                        />

                        <InputField
                            label="EIN Number"
                            value={formData.einNumber}
                            onChange={(value) => setFormData({ ...formData, einNumber: value })}
                            disabled={!editMode}
                            backgroundColor={editMode ? 'white' : '#e0e0e0'}
                        />

                        <InputField
                            label="Tag Line"
                            optional
                            value={formData.tagLine}
                            onChange={(value) => setFormData({ ...formData, tagLine: value })}
                            disabled={!editMode}
                            backgroundColor={editMode ? 'white' : '#e0e0e0'}
                        />
                        <InputField
                            label="Short Bio"
                            optional
                            multiline
                            rows={4}
                            value={formData.shortBio}
                            onChange={(value) => setFormData({ ...formData, shortBio: value })}
                            disabled={!editMode}
                            backgroundColor={editMode ? 'white' : '#e0e0e0'}
                        />

                        <InputField
                            label="Phone Number"
                            value={formData.phoneNumber}
                            onChange={(value) =>
                                setFormData({ ...formData, phoneNumber: formatPhoneNumber(value) })
                            }
                            disabled={!editMode}
                            backgroundColor={editMode ? 'white' : '#e0e0e0'}
                            error={errors.phoneNumber}
                            helperText={errors.phoneNumber}
                        />



                        <SocialLink
                            iconSrc={yelp}
                            alt="Yelp"
                            value={formData.yelp}
                            onChange={(value) => setFormData({ ...formData, yelp: value })}
                            disabled={!editMode}
                            backgroundColor={editMode ? 'white' : '#e0e0e0'}
                        />

                        <SocialLink
                            iconSrc={google}
                            alt="Google"
                            value={formData.google}
                            onChange={(value) => setFormData({ ...formData, google: value })}
                            disabled={!editMode}
                            backgroundColor={editMode ? 'white' : '#e0e0e0'}
                        />

                        <SocialLink
                            iconSrc={website}
                            alt="Website"
                            value={formData.website}
                            onChange={(value) => setFormData({ ...formData, website: value })}
                            disabled={!editMode}
                            backgroundColor={editMode ? 'white' : '#e0e0e0'}
                        />


                        <Box sx={{ mb: 3 }}>
                            <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                                <Typography variant="caption" sx={{ ml: 1, mr: 1 }}>
                                    Template
                                </Typography>
                                <IconButton size="small" sx={{ p: 0 }}
                                    onClick={() => {
                                        navigate("/selectBusinessTemplate", { state: { data: formData } });
                                    }}
                                    disabled={!editMode}
                                >
                                    <VisibilityIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <TextField
                                fullWidth
                                variant="outlined"
                                value={templateMap[formData.template]}
                                placeholder="Template (Optional)"
                                disabled
                                sx={{
                                    backgroundColor: editMode ? 'white' : '#e0e0e0',
                                    borderRadius: 2,
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: 2,
                                    },
                                }}
                            />
                        </Box>

                        <Box
                            sx={{
                                display: 'flex',
                                overflowX: 'auto',
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none',
                                '&::-webkit-scrollbar': {
                                    display: 'none',
                                },
                                maxWidth: "650px",
                                mb:2
                            }}
                        >
                            <ImageList
                                sx={{ display: 'flex', flexWrap: 'nowrap' }}
                                cols={5}
                            >
                                {formData.businessGooglePhotos?.map((image, index) => (
                                    <ImageListItem
                                        key={index}
                                        sx={{
                                            width: 'auto',
                                            flex: '0 0 auto',
                                            border: '1px solid #ccc',
                                            margin: '0 2px',
                                            position: 'relative',
                                        }}
                                    >
                                        <img
                                            src={image}
                                            alt={`place-${index}`}
                                            style={{
                                                height: '120px',
                                                width: '120px',
                                                objectFit: 'cover',
                                            }}
                                        />
                                        <Box sx={{ position: 'absolute', top: 0, right: 0 }}>
                                            <IconButton
                                                onClick={() => handleDeleteImage(index)}
                                                sx={{
                                                    color: deletedIcons[index] ? 'red' : 'black',
                                                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                                    '&:hover': {
                                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                                    },
                                                    margin: '2px',
                                                }}
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </Box>
                                        <Box sx={{ position: 'absolute', bottom: 0, left: 0 }}>
                                            <IconButton
                                                onClick={() => handleFavImage(index)}
                                                sx={{
                                                    color: favoriteIcons[index] ? 'red' : 'black',
                                                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                                    '&:hover': {
                                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                                    },
                                                    margin: '2px',
                                                }}
                                            >
                                                {favoriteIcons[index] ? (
                                                    <FavoriteIcon />
                                                ) : (
                                                    <FavoriteBorderIcon />
                                                )}
                                            </IconButton>
                                        </Box>
                                    </ImageListItem>
                                ))}
                            </ImageList>
                        </Box>

                        {editMode && (
                            <CircleButton
                                // onClick={handleSubmit}
                                width={135}
                                height={135}
                                text="Save"
                            />
                        )}
                    </FormBox>
                </form>
                <DialogBox
                    open={dialog.open}
                    title={dialog.title}
                    content={dialog.content}
                    button1Text="Ok"
                    button1Action={handleClose}
                    handleClose={handleClose}
                />
                <NavigationBar />
            </Box>
        </StyledContainer>
    );
};
