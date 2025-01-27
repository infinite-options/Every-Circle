import { useState } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Typography, Button } from '@mui/material';
import ProfileSetupStepper from './ProfileSetupStepper';
import BasicInfoStep from './Steps/BasicInfoStep';
import OptionalInfoStep from './Steps/OptionalInfoStep';
import SocialLinksStep from './Steps/SocialLinksStep';
import TemplateStep from './Steps/TemplateStep';
import ResponsiveContainer from '../Layout/ResponsiveContainer';
import axios from 'axios';
import APIConfig from '../../APIConfig';
import { DataValidationUtils } from '../auth/authUtils/DataValidationUtils';

const ProfileSetupForm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const userId = location.state?.userId ? location.state.userId : null;
  const [activeStep, setActiveStep] = useState(0);
  const { isValidPhoneNumber } = DataValidationUtils;
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: '',
    phoneNumber: '',
    location: '',
    tagLine: '',
    shortBio: '',
    // image1: null,
    // image2: null,
    // image3: null,
    facebook: '',
    twitter: '',
    linkedin: '',
    youtube: '',
    template: '',
    selectedImages: [],
    favImage: '',
  });

  console.log("userId in profile setup", userId);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageUpload = (index, file) => {
    // const newSelectedImages = [...formData.selectedImages, file];
    // setFormData(prev => ({
    //   ...prev,
    //   [`image${index}`]: file,
    //   selectedImages: newSelectedImages,
    // }));
    let currentIndex = formData.selectedImages.length;
    const fileObj = {
      index: currentIndex,
      file: file,
      coverPhoto: currentIndex + index === 0 && !formData.favImage, // Only set the first new image as cover if there's no favorite image
    };
    const newSelectedImages = [...formData.selectedImages, fileObj];
    setFormData(prev => ({
      ...prev,
      selectedImages: newSelectedImages,
    }));
  };

  const handleDeleteImage = (imageUrl) => {
    const updatedImages = formData.selectedImages.filter((img) => img.file.name != imageUrl.name);
    setFormData((prev) => ({
      ...prev,
      selectedImages: updatedImages,
    }));
  }

  const handleFavImage = (imageUrl) => {
    const updatedImages = formData.selectedImages.map((img) => ({...img, coverPhoto: img.file.name === imageUrl.name}));
    setFormData((prev) => ({
      ...prev,
      selectedImages: updatedImages,
    }));
  }


  const validateRequiredFields = () => {
    const newErrors = {};
    ["firstName", "lastName", "location", "phoneNumber"].forEach((field) => {
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
      const data = new FormData();
      data.append("user_uid", userId);
      data.append("profile_first_name", formData.firstName);
      data.append("profile_last_name", formData.lastName);
      data.append("profile_phone", formData.phoneNumber);
      // data.append("profile_location", formData.location);
      data.append("profile_tag_line", formData.tagLine);
      data.append("profile_short_bio", formData.shortBio);
      data.append("profile_facebook_link", formData.facebook);
      data.append("profile_twitter_link", formData.twitter);
      data.append("profile_linkedin_link", formData.linkedin);
      data.append("profile_youtube_link", formData.youtube);
      data.append("profile_template", formData.template);
      data.append("referred_by_code", "12345");

      // const imageFields = ["image1", "image2", "image3"];
      // imageFields.forEach((field, index) => {
      //   if (formData[field]) {
      //     data.append(`img_${index}`, formData[field]);
      //   }
      // });

      let i = 0;
      for (const file of formData.selectedImages) {
        let key = `img_${i++}`;
        data.append(key, file.file);
        if (file.coverPhoto) {
          data.append("img_favorite", key);
        }
      }
      // console.log("userId", formData.selectedImages);
      // console.log('formdata is', formData);
      try {
        const response = await axios.post(`${APIConfig.baseURL.dev}/profile`, data, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        console.log("response in profile setup", response);
        if (response.status === 200) {
          navigate("/profile", {
            state: { userId: userId },
          });
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
      component: <BasicInfoStep formData={formData} handleChange={handleChange} errors={errors} />,
      title: "Welcome to Every Circle!",
      subtitle: "Let's Build Your Profile Page!"
    },
    {
      component: <OptionalInfoStep
        formData={formData}
        handleChange={handleChange}
        handleImageUpload={handleImageUpload}
        handleDeleteImage={handleDeleteImage}
        handleFavImage={handleFavImage}
      />,
      title: "Optional Info"
    },
    {
      component: <SocialLinksStep formData={formData} handleChange={handleChange} />,
      title: "Social Media Links"
    },
    {
      component: <TemplateStep formData={formData} handleTemplateSelect={handleTemplateSelect} />,
      title: "Select Your Template"
    }
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <ResponsiveContainer>
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

export default ProfileSetupForm; 