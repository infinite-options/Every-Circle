//print userID change to

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Typography, Button } from "@mui/material";
import ProfileSetupStepper from "./ProfileSetupStepper";
import BusinessBasicInfoStep from "./BusinessSteps/BusinessBasicInfoStep";
import OptionalBusinessInfoStep from "./BusinessSteps/OptionalBusinessInfoStep";
import BusinessSocialLinksStep from "./BusinessSteps/BusinessSocialLinksStep";
import BusinessCategoryStep from "./BusinessSteps/BusinessCategoryStep";
import ResponsiveContainer from "../Layout/ResponsiveContainer";
import axios from "axios";
import APIConfig from "../../APIConfig";
import { DataValidationUtils } from "../auth/authUtils/DataValidationUtils";
import { useUserContext } from "../contexts/UserContext";

const BusinessProfileSetupForm = () => {
  console.log("We are in business profile steup form:");

  const location = useLocation();
  const navigate = useNavigate();
  // Extract userId from both location state and URL query parameters
  const queryParams = new URLSearchParams(location.search);
  const urlUserId = queryParams.get("userId");
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
    template: "0",
    einNumber: "",
    categories: [],
    customTags: [],
  });

  //console.log("In BusinessProfileSetupForm.jsx location.state.userID: ", location.state.userId)
  console.log("business data: ", userId);

  useEffect(() => {
    window.scrollTo(0, 0);
    console.log("referralId", referralId);
  }, [referralId]);

  const handleChange = (e) => {
    const { name, value: rawValue } = e.target;
    const value = name === "phoneNumber" ? formatPhoneNumber(rawValue) : name === "einNumber" ? formatEIN(rawValue) : rawValue;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
  console.log("before handle next");
  const handleNext = async () => {
    console.log("activeStep", activeStep);
    console.log("StepLength", steps.length);
    if (activeStep === steps.length - 1) {
      console.log("form data before submission", formData);
      console.log("raw images", formData.businessGooglePhotos);
      console.log("JSON.stringify(formData.businessGooglePhotos)", JSON.stringify(formData.businessGooglePhotos));
      const data = new FormData();
      // data.append("profile_uid", userId);
      data.append("user_uid", userId);

      console.log("userId from form data BPSF : ", userId);

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
      data.append("business_tags", JSON.stringify(formData.customTags));
      //
      console.log("Data info:", data);
      try {
        const response = await axios.post(`${APIConfig.baseURL.dev}/api/v3/business_v3`, data, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        console.log("response in business setup", response);
        if (response.status === 200) {
          console.log(" ahahhahah", response.data.business_uid);

          const newBusinessId = response.data.business_uid;
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
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleClaimed = async () => {
    if (activeStep === steps.length - 1) {
      navigate("/businessProfile");
    } else {
      if (validateRequiredFields()) {
        setActiveStep((prev) => prev + 1);
      }
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };
  console.log("Form data getting passed:", formData);
  const steps = [
    {
      component: <BusinessBasicInfoStep formData={formData} handleChange={handleChange} errors={errors} setFormData={setFormData} isClaimed={isClaimed} setIsClaimed={setIsClaimed} />,
      title: "Welcome to Every Circle!",
      subtitle: "Let's Build Your Business Page!",
    },
    {
      component: <OptionalBusinessInfoStep formData={formData} handleChange={handleChange} setFormData={setFormData} />,
      title: "Optional Info",
    },
    {
      component: <BusinessCategoryStep formData={formData} handleChange={handleChange} errors={errors} setFormData={setFormData} />,
      title: "Select Category",
      subtitle: "Select Tags for your business",
    },
    {
      component: <BusinessSocialLinksStep formData={formData} handleChange={handleChange} />,
      title: "Social Media Links",
    },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        position: "relative",
        paddingBottom: "100px", // Ensure space for the Continue button
      }}
    >
      {/* Properly Positioned Green Circle (Lowered Slightly) */}
      <Box
        sx={{
          width: "200%", // Larger width for a proper circular effect
          height: "100vh", // Prevents it from getting cut off
          maxWidth: "800px", // Prevents stretching
          maxHeight: "800px",
          backgroundColor: "#00A82D",
          borderRadius: "50%",
          position: "absolute",
          top: "8vh", // Moves the circle slightly lower so it covers all fields
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: -1,
        }}
      />

      <Box
        sx={{
          width: "90%",
          maxWidth: 400,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: "-10vh", // Ensures form fields stay inside the circle
        }}
      >
        {/* Title Section */}
        <Typography variant='h5' sx={{ fontWeight: "bold", color: "#fff", mb: 1 }}>
          {steps[activeStep].title}
        </Typography>
        {steps[activeStep].subtitle && (
          <Typography variant='subtitle1' sx={{ mb: 2, color: "#fff" }}>
            {steps[activeStep].subtitle}
          </Typography>
        )}
        <Button
          variant='contained'
          onClick={isClaimed ? handleClaimed : handleNext}
          sx={{
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            backgroundColor: "#FF9500",
            color: "#fff",
            "&:hover": {
              backgroundColor: "#e68600",
            },
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isClaimed ? "Claimed" : activeStep === steps.length - 1 ? "Finish" : "Continue!!"}
        </Button>
      </Box>
    </Box>
  );
};

export default BusinessProfileSetupForm;
