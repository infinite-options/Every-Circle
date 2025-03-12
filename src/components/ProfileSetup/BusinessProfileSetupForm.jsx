import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Typography, Button } from '@mui/material';
import ProfileSetupStepper from './ProfileSetupStepper';
import BusinessBasicInfoStep from './BusinessSteps/BusinessBasicInfoStep';
import OptionalBusinessInfoStep from './BusinessSteps/OptionalBusinessInfoStep';
import BusinessSocialLinksStep from './BusinessSteps/BusinessSocialLinksStep';
import BusinessCategoryStep from "./BusinessSteps/BusinessCategoryStep";
import ResponsiveContainer from '../Layout/ResponsiveContainer';
import axios from 'axios';
import APIConfig from '../../APIConfig';
import { DataValidationUtils } from '../auth/authUtils/DataValidationUtils';
import { useUserContext } from '../contexts/UserContext';


const BusinessProfileSetupForm = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const userId = location.state?.userId ? location.state.userId : "100-000098";
    const [activeStep, setActiveStep] = useState(0);
    const { isValidPhoneNumber, formatPhoneNumber, formatEIN, isValidEinNumber } = DataValidationUtils;
    const { referralId, user } = useUserContext();
    const [errors, setErrors] = useState({});
    const [isClaimed, setIsClaimed] = useState(false);
    const [formData, setFormData] = useState({
        businessName: "",
        location: "",
        phoneNumber: "",
        einNumber: ""
    });

    useEffect(() => {
        console.log('referralId', referralId);
    }, [referralId]);

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
        if (!formData.businessName) {
            newErrors.businessName = "Business name is required";
        }
        if (!isValidPhoneNumber(formData.phoneNumber)) {
            newErrors.phoneNumber = "Invalid phone number format";
        }
        if (!isValidEinNumber(formData.einNumber)) {
            newErrors.einNumber = "Invalid EIN number";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = async () => {
        if (activeStep === steps.length - 1) {
            navigate("/businessProfile");
        } else {
            if (validateRequiredFields()) {
                setActiveStep(prev => prev + 1);
            }
        }
    };

    const handleBack = () => {
        setActiveStep(prev => prev - 1);
    };

    const steps = [
        {
            component: <BusinessBasicInfoStep formData={formData} handleChange={handleChange} errors={errors} setFormData={setFormData} isClaimed={isClaimed} setIsClaimed={setIsClaimed} />,
            title: "Welcome to Every Circle!",
            subtitle: "Let's Build Your Business Page!"
        },
        {
            component: <OptionalBusinessInfoStep formData={formData} handleChange={handleChange} setFormData={setFormData} />,
            title: "Optional Info"
        },
        {
            component: <BusinessCategoryStep formData={formData} handleChange={handleChange} errors={errors} setFormData={setFormData} />,
            title: "Select Category",
            subtitle: "Select Tags for your business"
        },
        {
            component: <BusinessSocialLinksStep formData={formData} handleChange={handleChange} />,
            title: "Social Media Links"
        }
    ];

    return (
        <Box sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            position: "relative",
            paddingBottom: "100px" // Ensure space for the Continue button
        }}>
            {/* Properly Positioned Green Circle (Lowered Slightly) */}
            <Box sx={{
                width: "200%",  // Larger width for a proper circular effect
                height: "100vh", // Prevents it from getting cut off
                maxWidth: "800px", // Prevents stretching
                maxHeight: "800px",
                backgroundColor: "#00A82D",
                borderRadius: "50%",
                position: "absolute",
                top: "8vh", // Moves the circle slightly lower so it covers all fields
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: -1
            }} />

            <Box
                sx={{
                    width: "90%", maxWidth: 400,
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    marginTop: "-10vh" // Ensures form fields stay inside the circle
                }}
            >
                {/* Title Section */}
                <Typography variant="h5" sx={{ fontWeight: "bold", color: "#fff", mb: 1 }}>
                    {steps[activeStep].title}
                </Typography>
                {steps[activeStep].subtitle && (
                    <Typography variant="subtitle1" sx={{ mb: 2, color: "#fff" }}>
                        {steps[activeStep].subtitle}
                    </Typography>
                )}

                {/* Form Fields */}
                <Box sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    {steps[activeStep].component}
                </Box>

                {/* Step Indicator */}
                <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
                    {[...Array(steps.length)].map((_, index) => (
                        <Box key={index} sx={{
                            width: 14,  // Make the dot bigger
                            height: 14, // Make the dot bigger
                            borderRadius: "50%",
                            backgroundColor: index === activeStep ? "#00C7F2" : "#A0A0A0", // Change active color to blue
                            marginX: 1,
                            transition: "background-color 0.3s ease-in-out"
                            
                        }} />
                    ))}
                </Box>
            </Box>

            {/* Navigation Buttons (Continue button outside the green circle) */}
            <Box sx={{
                display: "flex",
                justifyContent: "center",
                mt: 3,
                position: "absolute",
                bottom: 150,
                width: "100%"
            }}>
                
                <Button variant="contained" onClick={handleNext} sx={{
                    width: 120, height: 120, borderRadius: "50%",fontSize: "18px",
                    backgroundColor: "#FF9500", color: "#fff",
                    fontWeight: "bold"
                }}>
                    {activeStep === steps.length - 1 ? 'Finish' : 'Continue'}
                </Button>
            </Box>
        </Box>
    );
};

export default BusinessProfileSetupForm;