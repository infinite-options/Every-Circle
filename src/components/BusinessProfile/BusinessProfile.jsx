import React, { useState, useEffect } from "react";
import { Box, Typography, styled, IconButton, TextField, FormControl, MenuItem, Select, InputLabel,} from "@mui/material";
import { SocialLink } from "./SocialLink";
import { InputField } from "../common/InputField";
// import ImageUpload from '../common/ImageUpload';
import SquareImageUpload from '../common/SquareImageUpload';
import StyledContainer from "../common/StyledContainer";
import Header from "../common/Header";
import website from "../../assets/web.png";
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
        businessCategory: "",
        subCategory: "",
        subSubCategory: "",
        businessTypes: [],
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
    const [allCategories, setAllCategories] = useState([])
    const [mainCategories, setMainCategories] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);
    const [SubSubCategory, setSubSubCategories] = useState([]);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await axios.get("https://ioEC2testsspm.infiniteoptions.com/category_list/all");
                setAllCategories(response.data.result);

                const mainCategories = response.data.result
                    .filter(cat => cat.category_parent_id === null)
                    .map(cat => ({ id: cat.category_uid, name: cat.category_name }));
                

                setMainCategories(mainCategories);
            } catch (error) {
                console.error("Error fetching categories:", error);
            }
        };

        fetchCategories();
    }, []);

    const navigate = useNavigate();

    const templateMap = {
        0: "dark",
        1: "modern",
        2: "minimalist",
        3: "split",
        4: "creative",
    }

    // const businessCategories = [
    //     { id: "000-000100", name: "Beauty & Personal Care" },
    //     { id: "000-000200", name: "Health & Wellness" },
    //     { id: "000-000300", name: "Home Services" },
    //     { id: "000-000400", name: "Professional Services" },
    //     { id: "000-000500", name: "Automotive" },
    //     { id: "000-000600", name: "Education & Training" },
    //     { id: "000-000700", name: "Events & Entertainment" },
    //     { id: "000-000800", name: "Pet Services" },
    //     { id: "000-000900", name: "Restaurants & Food" },
    //     { id: "000-001000", name: "Retail & Shopping" },
    //     { id: "000-001100", name: "Finance & Banking" },
    // ];

    const handleMainCategoryChange = (value) => {
        // Find the selected category object
        const selectedCategoryObj = allCategories.find(cat => cat.category_uid === value);
        setSelectedCategories((prevCategories) => [...prevCategories, selectedCategoryObj.name]);
        
        if (!selectedCategoryObj) return;
    
        setFormData(prevFormData => ({
            ...prevFormData,
            businessCategory: value, // Store the category ID
            subCategory: "",
            businessTypes: [...(prevFormData.businessTypes || []), value] // Append category name
        }));
    
        // Filter subcategories based on selected main category
        const subCats = allCategories
            .filter(cat => cat.category_parent_id === value)
            .map(cat => ({ id: cat.category_uid, name: cat.category_name }));
    
        setSubCategories(subCats);
    };
    
    const handleSubCategoryChange = (value) => {
        // Find the selected sub-category object
        const selectedSubCategoryObj = allCategories.find(cat => cat.category_uid === value);
        
        if (!selectedSubCategoryObj) return;

        setSelectedCategories((prevCategories) => [...prevCategories, selectedSubCategoryObj.name]);
    
        // console.log(value);
        
        setFormData(prevFormData => ({
            ...prevFormData,
            subCategory: value, // Store the sub-category ID
            businessTypes: [...(prevFormData.businessTypes || []), value] // Append sub-category name
        }));
    
        // Filter sub-subcategories based on selected sub-category
        const subSubCats = allCategories
            .filter(cat => cat.category_parent_id === value)
            .map(cat => ({ id: cat.category_uid, name: cat.category_name }));
    
        setSubSubCategories(subSubCats);
    };

    const handleSubSubCategoryChange = (value) => {
        // Find the selected sub-category object
        const selectedSubCategoryObj = allCategories.find(cat => cat.category_uid === value);
        
        if (!selectedSubCategoryObj) return;

        setSelectedCategories((prevCategories) => [...prevCategories, selectedSubCategoryObj.name]);
    
        // console.log(value);
        
        setFormData(prevFormData => ({
            ...prevFormData,
            subSubCategory: value,
            businessTypes: [...(prevFormData.businessTypes || []), value] // Append sub-category name
        }));
    };

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
                    template: business.business_template || "0",
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
                    // businessTypes: business.business_types ? JSON.parse(business.business_types) : [],
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


    const handleSubmit = async (e) => {
        e.preventDefault();
        if (validateRequiredFields()) {
            const form = new FormData();
            form.append("business_name", formData.businessName);
            form.append("business_address_line_1", formData.addressLine1);
            form.append("business_address_line_2", formData.addressLine2);
            form.append("business_city", formData.city);
            form.append("business_state", formData.state);
            form.append("business_country", formData.country);
            form.append("business_phone_number", formData.phoneNumber);
            form.append("business_ein_number", formData.einNumber);
            form.append("business_tag_line", formData.tagLine);
            form.append("business_short_bio", formData.shortBio);
            form.append("business_yelp", formData.yelp);
            form.append("business_google", formData.google);
            form.append("business_website", formData.website);
            form.append("business_template", formData.template);

            //image related fields 
            // console.log(formData.businessTypes)
            form.append('business_categories_uid', JSON.stringify(formData.businessTypes))
            form.append("business_google_photos", JSON.stringify(formData.businessGooglePhotos));
            form.append("business_favorite_image", formData.favImage);
            form.append("business_uid", businessId);

            try {
                setShowSpinner(true);
                const response = await axios.put(`${APIConfig.baseURL.dev}/api/v2/business`, form);
                console.log("Business Profile updated successfully", response);
                if (response.data.code === 200) {
                    // Fetch the latest profile data from the server
                    await fetchProfile();
                    setEditMode(false);
                    handleOpen("Success", "Business Profile has been updated successfully.");
                    // alert("Profile updated successfully");
                }
            } catch (error) {
                handleOpen("Error", "Cannot update the business profile.");
                console.error("Error updating business profile:", error);
            } finally {
                setShowSpinner(false);
            }
        } else {
            handleOpen("Error", "Cannot update the business profile.");
            // alert("Error updating profile");
        }
    };

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
                            disabled={!editMode}
                            label="Business Types"
                            value={selectedCategories}
                            onChange={(value) => setFormData({ ...formData, businessTypes: value })}
                            isTagInput={true}
                        />
    
                        <InputField
                            disabled={!editMode}
                            label="Business Category"
                            value={formData.businessCategory}
                            onChange={handleMainCategoryChange}
                            options={mainCategories} // pass data for dropdown
                        />
    
                        {formData.businessCategory?.length > 0 && <InputField
                            disabled={!editMode}
                            label="Business SubCategory"
                            value={formData.subCategory}
                            onChange={handleSubCategoryChange}
                            options={subCategories} // pass data for dropdown
                        />}

                        {formData.subCategory?.length > 0 && <InputField
                            disabled={!editMode}
                            label="Business SubSubCategory"
                            value={formData.subSubCategory}
                            onChange={handleSubSubCategoryChange}
                            options={SubSubCategory} // pass data for dropdown
                        />}

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
                            iconSrc={"https://s3-media0.fl.yelpcdn.com/assets/public/cookbook.yji-0a2bf1d9c330d8747446.svg"}
                            alt="Yelp"
                            value={formData.yelp}
                            onChange={(value) => setFormData({ ...formData, yelp: value })}
                            disabled={!editMode}
                            backgroundColor={editMode ? 'white' : '#e0e0e0'}
                        />

                        <SocialLink
                            iconSrc={"https://loodibee.com/wp-content/uploads/Google-Logo.png"}
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

                        {/* for template */}
                        <Box sx={{ mb: 3 }}>
                            <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                                <Typography variant="caption" sx={{ ml: 1, mr: 1 }}>
                                    Template
                                </Typography>
                                <IconButton size="small" sx={{ p: 0 }}
                                    onClick={() => {
                                        if(!editMode){
                                            navigate("/showTemplate", {
                                              state: {
                                                profileId: businessId,
                                                navigatingFrom: "businessProfile",
                                              }
                                            })
                                          }else{
                                            // navigate("/selectTemplate", { state: { data: formData } });
                                            navigate("/selectBusinessTemplate", { state: { data: formData } });
                                          }
                                    }}
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
                        
                        {/* images */}
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
                                mb: 2
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
                                onClick={handleSubmit}
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
