import { useState } from 'react';
import { useLocation } from "react-router-dom";
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import ProfileSetupStepper from './ProfileSetupStepper';
import BasicInfoStep from './Steps/BasicInfoStep';
import OptionalInfoStep from './Steps/OptionalInfoStep';
import SocialLinksStep from './Steps/SocialLinksStep';
import TemplateStep from './Steps/TemplateStep';
import ResponsiveContainer from '../Layout/ResponsiveContainer';
import axios from 'axios';
import APIConfig from '../../APIConfig';

const ProfileSetupForm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const userId = location.state?.userId ? location.state.userId : null;
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: '',
    phoneNumber: '',
    tagLine: '',
    shortBio: '',
    image1: null,
    image2: null,
    image3: null,
    facebook: '',
    twitter: '',
    linkedin: '',
    youtube: '',
    template: '',
  });

  const [lastSubmittedData, setLastSubmittedData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
  });


  console.log("userId", userId);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageUpload = (index, file) => {
    setFormData(prev => ({
      ...prev,
      [`image${index}`]: file
    }));
  };

  const handleNext = async () => {
    console.log("activeStep", activeStep);
    if (activeStep === steps.length - 1) {
      const data = new FormData();
      data.append("user_uid", userId);
      data.append("profile_tag_line", formData.tagLine);
      data.append("profile_short_bio", formData.shortBio);
      data.append("profile_facebook_link", formData.facebook);
      data.append("profile_twitter_link", formData.twitter);
      data.append("profile_linkedin_link", formData.linkedin);
      data.append("profile_youtube_link", formData.youtube);
      data.append("profile_template", formData.template);
      data.append("referred_by_code", "12345");

      // console.log("data", data);
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
      const hasChanges =
        formData.firstName !== lastSubmittedData.firstName ||
        formData.lastName !== lastSubmittedData.lastName ||
        formData.phoneNumber !== lastSubmittedData.phoneNumber;

      if (hasChanges) {
        try {
          const data = {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone_number: formData.phoneNumber,
            user_uid: userId,
          };
          const response = await axios.put(`${APIConfig.baseURL.dev}/userinfo`, data);
          // console.log("response", response);

          if (response.status === 200) {
            setLastSubmittedData({
              firstName: formData.firstName,
              lastName: formData.lastName,
              phoneNumber: formData.phoneNumber,
            });
            setActiveStep((prev) => prev + 1);
          } else {
            console.log("Error updating user info data");
          }
        } catch (error) {
          console.log("Error updating user info data", error);
        }
      }
    }
    else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const steps = [
    {
      component: <BasicInfoStep formData={formData} handleChange={handleChange} />,
      title: "Welcome to Every Circle!",
      subtitle: "Let's Build Your Profile Page!"
    },
    {
      component: <OptionalInfoStep
        formData={formData}
        handleChange={handleChange}
        handleImageUpload={handleImageUpload}
      />,
      title: "Optional Info"
    },
    {
      component: <SocialLinksStep formData={formData} handleChange={handleChange} />,
      title: "Social Media Links"
    },
    {
      component: <TemplateStep formData={formData} />,
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