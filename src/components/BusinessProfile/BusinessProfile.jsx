/////////   if went wrong change till this 

/// change business minicard call

/// sghjklv


/// delete product  chanege 
import React, { useState, useEffect } from "react";
import { Box, Typography, styled, IconButton, TextField, FormControl, MenuItem, Select, InputLabel, Paper, Switch } from "@mui/material";
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
import BusinessProfileView from './BusinessProfileView';
import moneyBag from "../../assets/moneybag.png";
import youtube from "../../assets/youtube-icon.png";
import BusinessCategoryDropdown from './BusinessCategoryDropdown';
import BusinessCardMini from "./BusinessCardMini";
import yelp from "../../assets/yelp.png";
import google from "../../assets/Google.png";
import BusinessProducts from './BusinessProducts';
//import EnhancedProductDisplay from './EnhancedProductDisplay'; 

import RelatedBusinessMinicard from './RelatedBusinessMinicard';
import BusinessImageUpload from './BusinessImageUpload';

//import VisibilityIcon from "@mui/icons-material/Visibility";



const FormBox = styled(Box)({
    padding: "0 16px",
    width: "100%",
});


const isValidEmail = (email) => {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
};

const InputWrapper = styled(Box)({
    width: '100%',
    position: 'relative',
    marginBottom: '20px',
    '& .MuiInputBase-root': {
        width: '100%'
    },
    '& .MuiTextField-root': {
        width: '100%'
    }
});
// Add these utility functions at the top level
const countWords = (str) => {
    return str.trim().split(/\s+/).filter(Boolean).length;
  };
  
  const truncateToWordLimit = (str, wordLimit) => {
    const words = str.trim().split(/\s+/).filter(Boolean);
    if (words.length <= wordLimit) return str;
    return words.slice(0, wordLimit).join(' ');
  };
  

const PublicLabel = styled(Typography)({
    color: '#666',
    fontSize: '14px',
    cursor: 'pointer',
    textTransform: 'none',
    position: 'absolute',
    right: 16,
    top: -3,
    '&:hover': {
        opacity: 0.8
    }
});

// Add styled component for banner
const BannerContainer = styled(Box)({
    backgroundColor: '#e0e0e0',
    padding: '12px 16px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: '20px',
    marginBottom: '16px'
});

const YesText = styled(Typography)({
    color: '#666',
    cursor: 'pointer',
});

export default function BusinessProfile() {
    const location = useLocation();
    //const { editMode: initialEditMode = false } = location.state || {};
    const { 
        editMode: initialEditMode = false,
        selectedBusinessId = null,
        fromProfile = false 
      } = location.state || {};
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
        youtube: "",
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
        businessServices: [],
        location: "",
        allowBanner: false,
        
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
    const [deletedProducts, setDeletedProducts] = useState([]);
    const [showSpinner, setShowSpinner] = useState(false);
    const [favoriteIcons, setFavoriteIcons] = useState([]);
    const [deletedIcons, setDeletedIcons] = useState([]);
    const [allCategories, setAllCategories] = useState([])
    const [mainCategories, setMainCategories] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);
    const [SubSubCategory, setSubSubCategories] = useState([]);
    const [uploadedBusinessImages, setUploadedBusinessImages] = useState([]);


    const [publicFields, setPublicFields] = useState({
        business_name_is_public: 1,
        business_location_is_public: 1,
        business_phone_number_is_public: 1,
        business_images_is_public: 1,
        business_tag_line_is_public: 1,
        business_short_bio_is_public: 1,
        business_banner_ads_is_public: 1,
        business_email_id_is_public: 1,
        business_services_is_public: 1

    });
    useEffect(() => {
        console.log("deletedProducts state updated:", deletedProducts);
    }, [deletedProducts]);

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
    //const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const newBusinessId = queryParams.get('newBusinessId');

    const templateMap = {
        0: "dark",
        1: "modern",
        2: "minimalist",
        3: "split",
        4: "creative",
        5: "company",
        6: "housemint",
        7: "sculpty",
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
    const handleBusinessImagesChange = (images) => {
        setUploadedBusinessImages(images);
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

            console.log("NewBusiess id akbajaal: ",newBusinessId)

                    // Use the selected business ID if coming from profile, otherwise use userId
                    const endpoint = selectedBusinessId 
                    ? `https://ioec2testsspm.infiniteoptions.com/api/v1/businessinfo/${selectedBusinessId}`
                    :(newBusinessId ? `https://ioec2testsspm.infiniteoptions.com/api/v1/businessinfo/${newBusinessId}`: `https://ioec2testsspm.infiniteoptions.com/api/v1/businessinfo/${userId}`);    

            const response = await axios.get(endpoint);
            console.log('response from business endpoint', response);
            if (response.status === 200) {
                const business = response.data?.result?.[0] || response.data?.business;  /////////// //////
                console.log('business data is', business);
                console.log("name froo ras", business.business_name )
                let businessServices = [];

                console.log("Out of if")
                if (response.data.services && Array.isArray(response.data.services) && response.data.services.length > 0) {
                    console.log("Processing services array with length:", response.data.services.length);
                    
                    // Map services from the API response format to our component format
                    businessServices = response.data.services.map(service => {
                        // Log each service for debugging
                        console.log("Processing service:", service);
                        
                        // Check if the service object exists and has the required properties
                        if (service) {
                            console.log(`Service ${service.bs_service_name || 'unnamed'} visibility from API:`, 
                                      service.bs_is_visible, 
                                      typeof service.bs_is_visible);
                            
                            return {
                                bs_uid: service.bs_uid || "",
                                bs_service_name: service.bs_service_name || "",
                                bs_bounty: service.bs_bounty || "",
                                bs_cost: service.bs_cost || "0",
                                bs_service_desc: service.bs_service_desc || "",
                                bs_is_visible: service.bs_is_visible === null ? true : service.bs_is_visible
                            };
                        }
                        return null;
                    }).filter(service => service !== null); // Remove any null entries from mapping
                } else {
                    console.log("No services array found, checking business_services field");
                    // Try parsing business_services if available
                    try {
                        if (business.business_services && typeof business.business_services === 'string' 
                            && business.business_services !== "null") {
                            businessServices = JSON.parse(business.business_services);
                            console.log("Successfully parsed business services");
                        } else {
                            console.log("No valid business_services data found");
                            businessServices = [];
                        }
                    } catch (e) {
                        console.error("Error parsing business services:", e);
                        console.log("Raw business_services string (first 100 chars):", 
                            business?.business_services?.substring(0, 100) + "...");
                        businessServices = [];
                    }
                }
                
if (deletedProducts.length > 0) {
    businessServices = businessServices.filter(service => 
        !deletedProducts.includes(service.bs_uid)
    );
}
                //const googlePhotos = business?.business_google_photos ? JSON.parse(business.business_google_photos) : [];
                let googlePhotos = [];
                try {
                  if (business?.business_google_photos) {
                    // Check if the string starts with "[" and ends with "]"
                    const photoString = business.business_google_photos.trim();
                    if (photoString.startsWith('[') && photoString.endsWith(']')) {
                      googlePhotos = JSON.parse(photoString);
                      console.log("Successfully parsed Google photos");
                    } else {
                      // Try to fix common JSON parsing issues
                      console.log("Attempting to fix malformed JSON for Google photos");
                      // Handle case where the string might be missing closing quotes or brackets
                      let fixedString = photoString;
                      if (!photoString.endsWith(']')) {
                        fixedString = fixedString + '"]';
                      }
                      try {
                        googlePhotos = JSON.parse(fixedString);
                        console.log("Fixed and parsed Google photos successfully");
                      } catch (innerError) {
                        console.error("Could not fix JSON format:", innerError);
                        // As a last resort, try to extract URLs using regex
                        const urlRegex = /(https:\/\/maps\.googleapis\.com\/[^"]*)/g;
                        const matches = photoString.match(urlRegex);
                        if (matches && matches.length > 0) {
                          googlePhotos = matches;
                          console.log("Extracted Google photo URLs using regex");
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.error("Error parsing business_google_photos:", e);
                  console.log("Raw business_google_photos string (first 100 chars):", 
                    business?.business_google_photos?.substring(0, 100) + "...");
                  // Continue with an empty array instead of crashing
                  googlePhotos = [];
                }
                
                // Update form data
                setFormData({
                    ...formData,
                    businessName: business.business_name || "",
                    location: business.business_country || "",
                    einNumber: business.business_ein_number || "",
                    email: business.business_email_id || "",
                    phoneNumber: business.business_phone_number || "",
                    tagLine: business.business_tag_line || "",
                    shortBio: business.business_short_bio || "",
                    template: business.business_template || "0",
                    website: business.business_website || "",
                    yelp: business.business_yelp || "",
                    google: business.business_google || "",
                    //youtube: business.business_youtube || "",
                    priceLevel: business.business_price_level || "",
                    googleRating: business.business_google_rating || "0",
                    businessImages: business.business_images_url || [],
                    businessGooglePhotos: googlePhotos,
                    favImage: business.business_favorite_image || "",
                    googleId: business.business_google_id || "",
                    businessId: business.business_uid,
                    businessServices: businessServices,
                    //allowBanner: business.business_allow_banner || false,
                });

                // Update public fields from the response
                setPublicFields({
                    //business_name_is_public: business.business_name_is_public ?? 1,
                    business_location_is_public: business.business_location_is_public ?? 1,
                    business_phone_number_is_public: business.business_phone_number_is_public ?? 1,
                    business_email_id_is_public: parseInt(business.business_email_id_is_public || 1, 10),
                    business_images_is_public: business.business_images_is_public ?? 1,
                    business_tag_line_is_public: business.business_tag_line_is_public ?? 1,
                    business_short_bio_is_public: business.business_short_bio_is_public ?? 1,
                    business_banner_ads_is_public: business.business_banner_ads_is_public ?? 1,
                    business_services_is_public: business.business_services_is_public ?? 1

                });

                setFavoriteIcons(googlePhotos ? googlePhotos.map((image, index) => index === 0) : []);
                setDeletedIcons(googlePhotos ? new Array(googlePhotos.length).fill(false) : []);
                updateUser({ businessId: business.business_uid, business: business });
                setBusinessId(business.business_uid);
            }
        } catch (error) {
            console.error("Error fetching Business profile:", error);
            // If there's an error and we came from profile, maybe navigate back
            if (fromProfile) {
                handleOpen("Error", "Could not find the selected business.");
                // Optional: navigate back to profile after a delay
                // setTimeout(() => navigate('/profile'), 3000);
            }
        } finally {
            setShowSpinner(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [userId],[selectedBusinessId],[newBusinessId]);
    

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
        if (formData.email && !isValidEmail(formData.email)) {
            newErrors["email"] = "Invalid email format";
        }
    // Link validation - ensure they start with https://
    const linkFields = ["yelp", "google", "website"];
    linkFields.forEach(field => {
      const link = formData[field];
      // Only validate if the link is not empty
      if (link && !link.startsWith("https://")) {
        newErrors[field] = "Link must start with https://";
      }
    });
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
        } else {
            setErrors({});
        }
        // console.log('The errors are', errors)
        return Object.keys(newErrors).length === 0;
    }

    const handlePublicToggle = (field) => {
        if (!editMode) return;
        setPublicFields(prev => ({
            ...prev,
            [field]: prev[field] === 1 ? 0 : 1
        }));
    };



    const handleSubmit = async (e) => {
        e.preventDefault();
        if (validateRequiredFields()) {
            
            const form = new FormData();
            
            // Basic business info
            form.append("business_name", formData.businessName);
            form.append("business_country", formData.location);
            form.append("business_phone_number", formData.phoneNumber);
            form.append("business_email_id", formData.email || "");
            form.append("business_ein_number", formData.einNumber);
            form.append("business_tag_line", formData.tagLine);
            form.append("business_short_bio", formData.shortBio);
            form.append("business_yelp", formData.yelp);
            form.append("business_google", formData.google);
            form.append("business_website", formData.website);
            //form.append("business_youtube", formData.youtube);
            //form.append("business_allow_banner", formData.allowBanner ? 1 : 0);
            form.append("business_uid", businessId);

            // if (deletedProducts.length > 0) {
            //     form.append("delete_services", JSON.stringify(deletedProducts));
            //     console.log("Products to delete:", deletedProducts);
            //   }
            if (deletedProducts.length > 0) {
                // Make sure deleted IDs are properly formatted as strings in an array
                const formattedDeletedProducts = deletedProducts.map(id => id.toString());
                // Log for debugging
                console.log("Deleted products to send:", formattedDeletedProducts);
                form.append("delete_business_services", JSON.stringify(formattedDeletedProducts));
            }
            // IMPROVED IMAGE UPLOAD HANDLING
// In your handleSubmit function, modify the image upload part:
            if (uploadedBusinessImages && uploadedBusinessImages.length > 0) {
                console.log(`Uploading ${uploadedBusinessImages.length} business images`);
                
                // Use the exact field name that's showing up in your form data
                uploadedBusinessImages.forEach((image) => {
                console.log(`Appending image: ${image.name}, type: ${image.type}, size: ${image.size} bytes`);
                form.append('business_images_url', image); // Use the same name as in your form data
                });
            }


    

            if (formData.businessServices && formData.businessServices.length > 0) {
                console.log(formData.businessServices)
                const formattedServices = formData.businessServices.map(service => {
                    console.log(`Service Before: ${service.bs_service_name}`, service.bs_is_visible, typeof service.bs_is_visible);

                    //console.log(`Service Before:, ${service.bs_service_name}`, service.bs_is_visible, type(service.bs_is_visible))
                  const visibilityValue = service.bs_is_visible;
                  //onsole.log(`Service 1 ${service.bs_service_name} visibility being submitted: ${visibilityValue}`);
                  
                  return {
                    bs_uid: service.bs_uid,
                    bs_service_desc: service.bs_service_desc || "",
                    bs_service_name: service.bs_service_name || "",
                    bs_bounty: service.bs_bounty || "",
                    bs_cost: service.bs_cost || "0",
                    bs_is_visible: service.bs_is_visible
                  };
                });
                
                console.log("Services being saved:", formattedServices);
                form.append("business_services", JSON.stringify(formattedServices));
            }
            // Image related fields 
            form.append("business_google_photos", JSON.stringify(formData.businessGooglePhotos));
            form.append("business_favorite_image", formData.favImage);

            // Public/Private fields
            //form.append("business_name_is_public", publicFields.business_name_is_public);
            //form.append("business_address_line_1_is_public", publicFields.business_location_is_public);
            form.append("business_phone_number_is_public", publicFields.business_phone_number_is_public);
            form.append("business_images_is_public", publicFields.business_images_is_public);
            form.append("business_tag_line_is_public", publicFields.business_tag_line_is_public);
            form.append("business_short_bio_is_public", publicFields.business_short_bio_is_public);
            form.append("business_banner_ads_is_public", publicFields.business_banner_ads_is_public);
            form.append("business_email_id_is_public", publicFields.business_email_id_is_public); 
            form.append("business_services_is_public", publicFields.business_services_is_public); 

            

            try {
                setShowSpinner(true);
                console.log("Submitting form data:", Object.fromEntries(form));
                const response = await axios.put(`${APIConfig.baseURL.dev}/api/v1/businessinfo`, form, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
                console.log("Business Profile updated successfully", response);
                if (response.data.code === 200) {
                    
                    setDeletedProducts([]);
                    console.log("Response from server 1:", response.data);
                    console.log("Products:", response.data)
                    await fetchProfile();
                    setEditMode(false);
                    window.scrollTo(0, 0);
                    handleOpen("Success", "Business Profile has been updated successfully.");
                } else {
                    handleOpen("Error", response.data.message || "Cannot update the business profile.");
                }
            } catch (error) {
                handleOpen("Error", error.response?.data?.message || "Cannot update the business profile.");
                console.error("Error updating business profile:", error);
            } finally {
                setShowSpinner(false);
            }
        } else {
            handleOpen("Error", "Please fill in all required fields.");
        }
    };

    if (!editMode) {
        return (
          <BusinessProfileView 
            formData={formData}
            publicFields={publicFields}
            userId={userId}
            onEditClick={() => {
              setEditMode(true);
              setDialog({ open: false, title: "", content: "" });
            }}
          />
        );
      }

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
                        <InputWrapper>
                            <Box sx={{ position: 'relative', display: editMode}}>
                                <InputField
                                    required
                                    label="Business Name (Public)"
                                    value={formData.businessName}
                                    onChange={(value) => setFormData({ ...formData, businessName: value })}
                                    disabled={!editMode}
                                    backgroundColor={editMode ? 'white' : '#e0e0e0'}
                                    error={errors.businessName}
                                    helperText={errors.businessName}
                                    fullWidth
                                />

                            </Box>
                        </InputWrapper>

                        <InputWrapper>
                            <Box sx={{ position: 'relative', display: editMode || publicFields.business_location_is_public === 1 ? 'block' : 'none' }}>
                                <InputField
                                    label="Location (Public)"
                                    value={formData.location}
                                    onChange={(value) => setFormData({ ...formData, location: value })}
                                    disabled={!editMode}
                                    backgroundColor={editMode ? 'white' : '#e0e0e0'}
                                    fullWidth
                                />
                            </Box>
                        </InputWrapper>

                        <InputWrapper>
                            <Box sx={{ position: 'relative', display: editMode || publicFields.business_phone_number_is_public === 1 ? 'block' : 'none' }}>
                                <InputField
                                    label="Phone Number"
                                    value={formData.phoneNumber}
                                    onChange={(value) => setFormData({ ...formData, phoneNumber: formatPhoneNumber(value) })}
                                    disabled={!editMode}
                                    backgroundColor={editMode ? 'white' : '#e0e0e0'}
                                    error={errors.phoneNumber}
                                    helperText={errors.phoneNumber}
                                    fullWidth
                                />
                                <PublicLabel 
                                    onClick={() => handlePublicToggle('business_phone_number_is_public')}
                                >
                                    {publicFields.business_phone_number_is_public === 1 ? ('Public') : (
  <span style={{ color: 'orange' }}>Private</span>
)}
                                </PublicLabel>
                            </Box>
                        </InputWrapper>
                        <InputWrapper>
                        <Box sx={{ position: 'relative', display: editMode || publicFields.business_email_id_is_public === 1 ? 'block' : 'none' }}>
                            <InputField
                                label="Email"
                                value={formData.email || ""}
                                onChange={(value) => setFormData({ ...formData, email: value })}
                                disabled={!editMode}
                                backgroundColor={editMode ? 'white' : '#e0e0e0'}
                                error={errors.email}
                                helperText={errors.email}
                                fullWidth
                            />
                            <PublicLabel 
                                onClick={() => handlePublicToggle('business_email_id_is_public')}
                                disabled={!editMode}
                            >
                                {publicFields.business_email_id_is_public === 1 ? ('Public') : (
  <span style={{ color: 'orange' }}>Private</span>
)}
                            </PublicLabel>
                        </Box>
                    </InputWrapper>

                        <InputWrapper>
                            <Box sx={{ position: 'relative', display: editMode || publicFields.business_images_is_public === 1 ? 'block' : 'none' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, width: '100%' }}>
                                    <Typography variant="body1">Business Images</Typography>
                                    <PublicLabel 
                                        onClick={() => handlePublicToggle('business_images_is_public')}
                                    >
                                        {publicFields.business_images_is_public === 1 ? ('Public') : (
  <span style={{ color: 'orange' }}>Private</span>
)}
                                    </PublicLabel>
                                </Box>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        gap: 2,
                                        mb: 2,
                                        width: '100%'
                                    }}
                                >
                                    {formData.businessGooglePhotos?.slice(0, 4).map((image, index) => (
                                        <Box
                                            key={index}
                                            sx={{
                                                flex: '1',
                                                border: '1px solid #ccc',
                                                position: 'relative',
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                height: '80px',
                                                width: '80px'
                                            }}
                                        >
                                            <img
                                                src={image}
                                                alt={`place-${index}`}
                                                style={{
                                                    height: '100%',
                                                    width: '100%',
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
                                                        padding: '4px',
                                                        margin: '2px',
                                                    }}
                                                >
                                                    <DeleteIcon fontSize="small" />
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
                                                        padding: '4px',
                                                        margin: '2px',
                                                    }}
                                                >
                                                    {favoriteIcons[index] ? (
                                                        <FavoriteIcon fontSize="small" />
                                                    ) : (
                                                        <FavoriteBorderIcon fontSize="small" />
                                                    )}
                                                </IconButton>
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        </InputWrapper>

                        <InputWrapper>
                            <Box sx={{ position: 'relative', display: editMode || publicFields.business_tag_line_is_public === 1 ? 'block' : 'none' }}>
                                <InputField
                                    label="Tag Line"
                                    optional
                                    value={formData.tagLine || ""}
                                    placeholder="Tag Line"
                                    onChange={(value) => setFormData({ ...formData, tagLine: value })}
                                    disabled={!editMode}
                                    backgroundColor={editMode ? 'white' : '#e0e0e0'}
                                    fullWidth
                                />
                                <PublicLabel 
                                    onClick={() => handlePublicToggle('business_tag_line_is_public')}
                                >
                                    {publicFields.business_tag_line_is_public === 1 ? ('Public') : (
  <span style={{ color: 'orange' }}>Private</span>
)}
                                </PublicLabel>
                            </Box>
                        </InputWrapper>

                        <Box sx={{ marginTop: '20px' }}>
            {/* <SectionTitle variant="subtitle1">
              Mini Card (how you'll appear in searches)
            </SectionTitle>
            
            <BusinessMiniCard
              businessName={businessData.business_name}
              tagLine={businessData.business_tag_line}
              email={businessData.business_email_id}
              phoneNumber={businessData.business_phone_number}
              imageUrl={businessData.business_favorite_image}
              businessImages={businessData.business_images_url}
              publicFields={publicFields}
            /> */}
            <Box sx={{ marginTop: '20px' }}>
            <BusinessCardMini
                businessName={formData.businessName}
                tagLine={formData.tagLine}
                email={formData.email}
                phoneNumber={formData.phoneNumber}
                imageUrl={formData.favImage}
                businessImages={formData.businessGooglePhotos}
                publicFields={publicFields}
            />
            </Box>
          </Box> 
            <InputWrapper>
            <BusinessCategoryDropdown
                label="Primary Business Category"
                value={formData.businessCategory || ""}
                onChange={(value) => handleMainCategoryChange(value)}
                options={mainCategories}
                disabled={!editMode}
                placeholder="Category" // Default placeholder
            />
            </InputWrapper>

            <InputWrapper>
            <BusinessCategoryDropdown
                label="Secondary Business Category"
                value={formData.subCategory || ""}
                onChange={(value) => handleSubCategoryChange(value)}
                options={subCategories}
                disabled={!editMode || !formData.businessCategory}
                placeholder="Sub Category" // Default placeholder
            />
            </InputWrapper>

                        <InputWrapper>
                            <Box sx={{ position: 'relative', display: editMode || publicFields.business_short_bio_is_public === 1 ? 'block' : 'none' }}>
                                <InputField
                                    label="Short Bio"
                                    optional
                                    multiline
                                    rows={4}
                                    value={formData.shortBio}
                                    //onChange={(value) => setFormData({ ...formData, shortBio: value })}
                                    onChange={(value) => {
                                        // Check if exceeds 50 words
                                        if (countWords(value) > 50) {
                                          const truncatedBio = truncateToWordLimit(value, 50);
                                          setFormData(prev => ({ ...prev, shortBio: truncatedBio }));
                                        } else {
                                          setFormData(prev => ({ ...prev, shortBio: value }));
                                        }
                                      }}
                                    disabled={!editMode}
                                    backgroundColor={editMode ? 'white' : '#e0e0e0'}
                                    helperText={`${countWords(formData.shortBio || '')}/50 words`}
                                    fullWidth
                                />
                                <PublicLabel 
                                    onClick={() => handlePublicToggle('business_short_bio_is_public')}
                                >
                                    {publicFields.business_short_bio_is_public === 1 ? ('Public') : (
  <span style={{ color: 'orange' }}>Private</span>
)}
                                </PublicLabel>
                            </Box>
                        </InputWrapper>
                        <Box>
                        <Box>
                        <BusinessProducts 
  editMode={editMode}
  businessId={businessId}
  products={formData.businessServices}
  onProductsChange={(newProducts) => 
    setFormData(prev => ({ ...prev, businessServices: newProducts }))
  }
  onDeleteProduct={(productId) => {
    setDeletedProducts(prev => [...prev, productId]);
  }}
  publicFieldValue={publicFields.business_services_is_public}
  onPublicToggle={() => handlePublicToggle('business_services_is_public')}
  PublicLabelComponent={PublicLabel}
/>
</Box>
    {/* Remove the original PublicLabel from here */}



</Box>


<InputWrapper>
  <BusinessImageUpload 
    onImagesChange={handleBusinessImagesChange}
    editMode={editMode}
    publicValue={publicFields.business_images_is_public}
    onPublicToggle={() => handlePublicToggle('business_images_is_public')}
  />
</InputWrapper>

<InputWrapper>
                            <Box sx={{ position: 'relative', display: editMode || publicFields.business_banner_ads_is_public === 1 ? 'block' : 'none' }}>
                                <Box sx={{ position: 'relative', width: '100%' }}>
                                    <BannerContainer>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Typography>Allow Banner Adds</Typography>
                                            <img 
                                                src={moneyBag} 
                                                alt="Money Bag" 
                                                style={{ width: '24px', height: '24px' }} 
                                            />
                                        </Box>
                                        <YesText
                                            onClick={() => !editMode ? null : setFormData({ ...formData, allowBanner: !formData.allowBanner })}
                                            sx={{ 
                                                opacity: editMode ? 1 : 0.5,
                                                pointerEvents: editMode ? 'auto' : 'none'
                                            }}
                                        >
                                            Yes
                                        </YesText>
                                    </BannerContainer>

                                </Box>
                            </Box>
                        </InputWrapper>

                        <Box sx={{ width: '100%' }}>
                            <SocialLink
                                iconSrc={"https://s3-media0.fl.yelpcdn.com/assets/public/cookbook.yji-0a2bf1d9c330d8747446.svg"}
                                alt="Yelp"
                                value={formData.yelp}
                                onChange={(value) => setFormData({ ...formData, yelp: value })}
                                disabled={!editMode}
                                backgroundColor={editMode ? 'white' : '#e0e0e0'}
                                fullWidth
                            />

                            <SocialLink
                                iconSrc={"https://loodibee.com/wp-content/uploads/Google-Logo.png"}
                                alt="Google"
                                value={formData.google}
                                onChange={(value) => setFormData({ ...formData, google: value })}
                                disabled={!editMode}
                                backgroundColor={editMode ? 'white' : '#e0e0e0'}
                                fullWidth
                            />

                            <SocialLink
                                iconSrc={website}
                                alt="Website"
                                value={formData.website}
                                onChange={(value) => setFormData({ ...formData, website: value })}
                                disabled={!editMode}
                                backgroundColor={editMode ? 'white' : '#e0e0e0'}
                                fullWidth
                            />

                            <SocialLink
                                iconSrc={youtube}
                                alt="YouTube"
                                value={formData.youtube}
                                onChange={(value) => setFormData({ ...formData, youtube: value })}
                                disabled={!editMode}
                                backgroundColor={editMode ? 'white' : '#e0e0e0'}
                                fullWidth
                            />
                        </Box>



{/* Add the RelatedBusinessMinicard component here */}
<RelatedBusinessMinicard editMode={editMode} />

{/* Then continue with your next section (Banner section) */}
<InputWrapper>
    <Box sx={{ position: 'relative', display: editMode || publicFields.business_banner_ads_is_public === 1 ? 'block' : 'none' }}>
        {/* Banner section content */}
    </Box>
</InputWrapper>

                        

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
