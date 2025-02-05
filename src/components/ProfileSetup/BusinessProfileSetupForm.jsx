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

const BusinessProfileSetupForm = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const userId = location.state?.userId ? location.state.userId : null;
    const [activeStep, setActiveStep] = useState(0);
    const { isValidPhoneNumber, formatPhoneNumber } = DataValidationUtils;
    const { referralId, user } = useUserContext();
    const [errors, setErrors] = useState({});
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
        googlePhotos: [],
        favImage: "",
        priceLevel: "",
        googleId: "",
        types: [],
        yelp: "",
        google: "",
        website: "",
        tagline: "",
        shortBio: "",
        template: '1'
    });

    useEffect(() => {
        console.log('referralId', referralId)
    }, [referralId])


    const handleChange = (e) => {
        const { name, value: rawValue } = e.target;
        const value = name === "phoneNumber" ? formatPhoneNumber(rawValue) : rawValue;
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

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
        } else {
            setErrors({});
        }
        return Object.keys(newErrors).length === 0;
    }

    const handleNext = async () => {
        // console.log("activeStep", activeStep);
        if (activeStep === steps.length - 1) {
            console.log('form data before submission', formData);
            console.log('raw images', formData.googlePhotos);
            console.log('JSON.stringify(formData.googlePhotos)', JSON.stringify(formData.googlePhotos))
            const data = new FormData();
            // data.append("profile_uid", userId);
            data.append("user_uid", userId);
            data.append("business_name", formData.businessName);
            data.append("business_address_line_1", formData.addressLine1);
            data.append("business_city", formData.city);
            data.append("business_state", formData.state);
            data.append("business_country", formData.country);
            data.append("business_zip_code", formData.zip);
            data.append("business_latitude", formData.latitude);
            data.append("business_longitude", formData.longitude);
            data.append("business_phone_number", formData.phoneNumber);
            data.append("business_phone_number", formData.phoneNumber);
            data.append("business_google_rating", formData.googleRating);
            data.append("business_google_photos", JSON.stringify(formData.googlePhotos));
            data.append("business_favorite_image", formData.favImage);
            data.append("business_price_level", formData.priceLevel);
            data.append("business_google_id", formData.googleId);
            // data.append("business_types", JSON.stringify(formData.types));
            data.append("business_tag_line", formData.tagLine);
            data.append("business_short_bio", formData.shortBio);
            data.append("business_yelp", formData.yelp);
            data.append("business_google", formData.google);
            data.append("business_website", formData.website);
            data.append("business_template", formData.template);

            try {
                const response = await axios.post(`${APIConfig.baseURL.dev}/business`, data, {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                });
                console.log("response in business setup", response);
                if (response.status === 200) {
                    navigate("/businessProfile");
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

    const steps = [
        {
            component: <BusinessBasicInfoStep formData={formData} handleChange={handleChange} errors={errors} setFormData={setFormData} />,
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
            component: <BusinessSocialLinksStep formData={formData} handleChange={handleChange} />,
            title: "Social Media Links"
        },
        {
            component: <BusinessTemplateStep formData={formData} handleTemplateSelect={handleTemplateSelect} role={"business"}/>,
            title: "Select Your Template"
        }
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
                    onClick={handleNext}
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
                    {activeStep === steps.length - 1 ? 'Finish' : 'Continue'}
                </Button>
            </Box>
        </Box>
    );
};

export default BusinessProfileSetupForm; 