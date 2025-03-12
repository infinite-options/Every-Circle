import { useEffect, useState } from 'react';
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
import { useUserContext } from '../contexts/UserContext';
import HowCanIHelp from './Steps/HowCanIHelp';
import HowCanYouHelp from './Steps/HowCanYouHelp';

const ProfileSetupForm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const userId = location.state?.userId ? location.state.userId : null;
  const [activeStep, setActiveStep] = useState(0);
  const { isValidPhoneNumber, formatPhoneNumber } = DataValidationUtils;
  const { referralId, user } = useUserContext();
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
    template: '1',
    selectedImages: [],
    favImage: '',
    howCanIHelp0: '',
    howCanIHelp1: '',
    howCanIHelp2: '',
    howCanIHelp3: '',
    howCanYouHelp0: '',
    howCanYouHelp1: '',
    howCanYouHelp2: '',
    howCanYouHelp3: '',
  });

  console.log("In ProfileSetupForm.jsx location.state.userID: ", location.state.userId)


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
    const updatedImages = formData.selectedImages.map((img) => ({ ...img, coverPhoto: img.file.name === imageUrl.name }));
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
      data.append("profile_personal_first_name", formData.firstName);
      data.append("profile_personal_last_name", formData.lastName);
      data.append("profile_personal_phone_number", formData.phoneNumber);
      // data.append("profile_location", formData.location);
      // data.append("profile_tag_line", formData.tagLine);
      // data.append("profile_short_bio", formData.shortBio);
      // data.append("profile_facebook_link", formData.facebook);
      // data.append("profile_twitter_link", formData.twitter);
      // data.append("profile_linkedin_link", formData.linkedin);
      // data.append("profile_youtube_link", formData.youtube);
      // data.append("profile_template", formData.template);
      data.append("profile_personal_referred_by", referralId);

      // const imageFields = ["image1", "image2", "image3"];
      // imageFields.forEach((field, index) => {
      //   if (formData[field]) {
      //     data.append(`img_${index}`, formData[field]);
      //   }
      // });

      const howCanIHelp = [];
      const howCanYouHelp = [];

      Object.keys(formData).forEach((key) => {
        if (key.startsWith("howCanIHelp")) {
          howCanIHelp.push(formData[key]);

        } else if (key.startsWith("howCanYouHelp")) {
          howCanYouHelp.push(formData[key]);
        }
      });

      data.append("profile_how_can_we_help", JSON.stringify(howCanIHelp));
      data.append("profile_how_can_you_help", JSON.stringify(howCanYouHelp));

      let i = 0;
      for (const file of formData.selectedImages) {
        let key = `img_${i++}`;
        data.append(key, file.file);
        if (file.coverPhoto) {
          data.append("img_favorite", key);
        }
      }

      try {
        const response = await axios.post(`${APIConfig.baseURL.dev}/api/v1/userprofileinfo`, data, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        console.log("response in profile setup", response);
        if (response.status === 200) {
          navigate("/accountSeletion", {
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
      console.log(formData)
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
    // {
    //   component: <OptionalInfoStep
    //     formData={formData}
    //     handleChange={handleChange}
    //     handleImageUpload={handleImageUpload}
    //     handleDeleteImage={handleDeleteImage}
    //     handleFavImage={handleFavImage}
    //   />,
    //   title: "Optional Info"
    // },
    // {
    //   component: <SocialLinksStep formData={formData} handleChange={handleChange} />,
    //   title: "Social Media Links"
    // },
    // {
    //   component: <HowCanIHelp formData={formData} handleChange={handleChange} setFormData={setFormData}/>,
    //   title: "How Can I Help Others"
    // },
    // {
    //   component: <HowCanYouHelp formData={formData} handleChange={handleChange} setFormData={setFormData}/>,
    //   title: "How Can You Help Me"
    // },
    // {
    //   component: <TemplateStep formData={formData} handleTemplateSelect={handleTemplateSelect} role={"user"}/>,
    //   title: "Select Your Template"
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
              // overflowY: "scroll",
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