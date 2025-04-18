//print userID change to

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Typography, Button } from '@mui/material';
import ProfileSetupStepper from './ProfileSetupStepper';
import BusinessBasicInfoStep from './BusinessSteps/BusinessBasicInfoStep';
import OptionalBusinessInfoStep from './BusinessSteps/OptionalBusinessInfoStep';
import BusinessSocialLinksStep from './BusinessSteps/BusinessSocialLinksStep';
import BusinessTemplateStep from './BusinessSteps/BusinessTemplateStep';
import ResponsiveContainer from '../Layout/ResponsiveContainer';
import axios from 'axios';
import APIConfig from '../../APIConfig';
import { DataValidationUtils } from '../auth/authUtils/DataValidationUtils';
import { useUserContext } from '../contexts/UserContext';
import BusinessCategoryStep from "./BusinessSteps/BusinessCategoryStep";


const BusinessProfileSetupForm = () => {

    console.log("We are in business profile steup form:")

    

    const location = useLocation();
    const navigate = useNavigate();
     // Extract userId from both location state and URL query parameters
     const queryParams = new URLSearchParams(location.search);
     const urlUserId = queryParams.get('userId');
     const stateUserId = location.state?.userId;   
     const userId = urlUserId || stateUserId || null;
    //const userId = location.state?.userId ? location.state.userId : null; // change this now
    const [activeStep, setActiveStep] = useState(0);
    const { isValidPhoneNumber, formatPhoneNumber, formatEIN, isValidEinNumber } = DataValidationUtils;
    const { referralId, user } = useUserContext();
    const [errors, setErrors] = useState({});
    const [isClaimed, setIsClaimed] = useState(false);
    const [formData, setFormData] = useState({
        businessName: "",
        location: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        country: "",
        zip: "",
        latitude: "",
        longitude: "",
        phoneNumber: "",
        googleRating: "",
        businessGooglePhotos: [],
        favImage: "",
        priceLevel: "",
        googleId: "",
        types: [],
        yelp: "",
        google: "",
        website: "",
        tagLine: "",
        shortBio: "",
        template: '0',
        einNumber: "",
        categories: [],
        customTags: []
    });

   //console.log("In BusinessProfileSetupForm.jsx location.state.userID: ", location.state.userId)
   console.log("business data: ",userId)

    useEffect(() => {
        window.scrollTo(0, 0);
        console.log('referralId', referralId)
    }, [referralId])



    const handleChange = (e) => {
        const { name, value: rawValue } = e.target;
        const value = name === "phoneNumber" ? formatPhoneNumber(rawValue) : name === "einNumber" ? formatEIN(rawValue) : rawValue;

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

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

        if (isValidEinNumber(formData.einNumber) === false) {
            newErrors["einNumber"] = "Invalid EIN number";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
        } else {
            setErrors({});
        }
        return Object.keys(newErrors).length === 0;
    }
    console.log("before handle next")
    const handleNext = async () => {
        console.log("activeStep", activeStep);
        console.log("StepLength", steps.length);
        if (activeStep === steps.length - 1) {
            console.log('form data before submission', formData);
            console.log('raw images', formData.businessGooglePhotos);
            console.log('JSON.stringify(formData.businessGooglePhotos)', JSON.stringify(formData.businessGooglePhotos))
            const data = new FormData();
            // data.append("profile_uid", userId);
            data.append("user_uid", userId);
            
            console.log("userId from form data BPSF : ", userId)
            
            data.append("business_name", formData.businessName);
            data.append("business_address_line_1", formData.addressLine1);
            data.append("business_city", formData.city);
            data.append("business_state", formData.state);
            data.append("business_country", formData.country);
            data.append("business_zip_code", formData.zip);
            data.append("business_latitude", formData.latitude);
            data.append("business_longitude", formData.longitude);
            data.append("business_phone_number", formData.phoneNumber);
            data.append("business_google_rating", formData.googleRating);
            data.append("business_google_photos", JSON.stringify(formData.businessGooglePhotos));
            data.append("business_favorite_image", formData.favImage);
            data.append("business_price_level", formData.priceLevel);
            data.append("business_google_id", formData.googleId);
            // data.append("business_types", JSON.stringify(formData.types));
            data.append("business_tag_line", formData.tagLine);
            data.append("business_short_bio", formData.shortBio);
            data.append("business_yelp", formData.yelp);
            data.append("business_google", formData.google);
            data.append("business_ein_number", formData.einNumber);
            data.append("business_website", formData.website);
            data.append("business_template", formData.template);
            // data.append('business_categories_uid', JSON.stringify(formData.categories))
            data.append('business_tags', JSON.stringify(formData.customTags))
            // 
            console.log("Data info:", data)
            try {
                const response = await axios.post(`${APIConfig.baseURL.dev}/api/v3/business_v3`, data, {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                });
                console.log("response in business setup", response);
                if (response.status === 200) {
                    console.log(" ahahhahah",response.data.business_uid)

                    const newBusinessId = response.data.business_uid
                    //navigate("/businessProfile");
                    navigate(`/businessProfile?newBusinessId=${newBusinessId}&fromProfile=true`);
                } else {
                    console.log("Error finishing profile setup");
                }
            } catch (error) {
                console.log("Error updating profile data", error);
            }
        } else if (activeStep === 0) {
            if (validateRequiredFields()) {
                setActiveStep((prev) => prev + 1);
            }
        }
        else {
            setActiveStep((prev) => prev + 1);
        }
    };

    const handleClaimed = async () => {
        console.log('form data before submission', formData);
    };

    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
    };

    const handleTemplateSelect = (template) => {
        // console.log('template---', template)
        setFormData((prev) => ({
            ...prev,
            template: template,
        }));
    };
    console.log("Form data getting passed:", formData)
    const steps = [
        {
            component: <BusinessBasicInfoStep formData={formData} handleChange={handleChange} errors={errors} setFormData={setFormData} isClaimed={isClaimed} setIsClaimed={setIsClaimed}/>,
            title: "Welcome to Every Circle!",
            subtitle: "Let's Build Your Business Page!"
        },
        {
            component: <OptionalBusinessInfoStep

                formData={formData}
                
                handleChange={handleChange}
                setFormData={setFormData}
            />,
            title: "Optional Info"
        },
        {
            component: <BusinessCategoryStep formData={formData} handleChange={handleChange} errors={errors} setFormData={setFormData}/>,
            title: "Select Category",
            subtitle: "Select Tags for your business"
        },
        {
            component: <BusinessSocialLinksStep formData={formData} handleChange={handleChange} />,
            title: "Social Media Links"
        }
        // {
        //     component: <BusinessTemplateStep formData={formData} handleTemplateSelect={handleTemplateSelect} role={"business"}/>,
        //     title: "Select Your Template"
        // }
    ];

    return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <ResponsiveContainer role={user.role}>
                <Box
                    sx={{
                        padding: { xs: 3, sm: 4 },
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        color: '#fff',
                    }}
                >
                    {/* For Title */}
                    <Typography
                        variant="h5"
                        component="h3"
                        sx={{
                            mb: (steps[activeStep].subtitle ? 1.5 : 2),
                            fontWeight: 'bold',
                            textAlign: 'center',
                        }}
                    >
                        {steps[activeStep].title}
                    </Typography>

                    {/* For subtitle */}
                    {steps[activeStep].subtitle && (
                        <Typography
                            variant="subtitle1"
                            sx={{
                                mb: 2,
                                textAlign: 'center',
                            }}
                        >
                            {steps[activeStep].subtitle}
                        </Typography>
                    )}

                    <Box
                        component="form"
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            width: '100%',
                            height: '500px',
                            overflowY: "scroll",
                            "&::-webkit-scrollbar": {
                                display: "none",
                            },
                        }}
                    >
                        {steps[activeStep].component}

                        <Box sx={{ mt: 4 }}>
                            <ProfileSetupStepper
                                activeStep={activeStep}
                                steps={steps.length}
                            />
                        </Box>

                    </Box>
                </Box>
            </ResponsiveContainer>
            <Box
                sx={{
                    display: 'flex',
                    gap: 2,
                    mt: 3,
                    width: '100%',
                    justifyContent: 'center',
                    position: "relative",
                    paddingBottom: "10px",
                }}
            >
                {activeStep > 0 && (
                    <Button
                        variant="contained"
                        onClick={handleBack}
                        sx={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '50%',
                            minWidth: 'unset',
                            backgroundColor: '#000000',
                            color: '#fff',
                            '&:hover': {
                                backgroundColor: '#333333',
                            },
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        Back
                    </Button>
                )}
                <Button
                    variant="contained"
                    onClick={isClaimed ? handleClaimed : handleNext}
                    sx={{
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        backgroundColor: '#FF9500',
                        color: '#fff',
                        '&:hover': {
                            backgroundColor: '#e68600',
                        },
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {isClaimed ? "Claimed" : activeStep === steps.length - 1 ? 'Finish' : 'Continue!!'}
                </Button>
            </Box>
        </Box>
    );
};

export default BusinessProfileSetupForm; 