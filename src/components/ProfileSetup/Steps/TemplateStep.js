import { Box, IconButton } from '@mui/material';
import { ArrowBack, ArrowForward } from '@mui/icons-material';
import { useState } from 'react';
import { 
  DarkTemplate,
  ModernTemplate, 
  MinimalistTemplate, 
  SplitTemplate, 
  CreativeTemplate 
} from '../../profileTemplate';

const TemplateStep = ({ formData, handleTemplateSelect, role }) => {
  const [currentTemplate, setCurrentTemplate] = useState(0);
  const avatarUrl = formData.selectedImages?.find((image) => image?.coverPhoto === true) || formData.favImage;
  console.log('form data in template step', formData)
  console.log('avatarUrl', avatarUrl, typeof avatarUrl)
  const howCanIHelp = [];
  const howCanYouHelp = [];

  // Iterate over the object and classify values into respective arrays
  for (const key in formData) {
      if (key.startsWith("howCanIHelp")) {
          howCanIHelp.push(formData[key]);
      } else if (key.startsWith("howCanYouHelp")) {
          howCanYouHelp.push(formData[key]);
      }
  }

  //when a profile is new, the images will be an instance of file else as links
  const imageList = formData.selectedImages?.filter((image) => image?.coverPhoto === false) || formData.profileImages;
  console.log('imagelist', imageList);

  const templates = [
    {
      component: ModernTemplate,
      value: 'modern',
      id: 1,
    },
    {
      component: MinimalistTemplate,
      value: 'minimalist',
      id: 2,
    },
    {
      component: SplitTemplate,
      value: 'split',
      id: 3,
    }
  ];

  const handleNext = () => {
    setCurrentTemplate((prev) => (prev + 1) % templates.length);
    handleTemplateSelect(templates[(currentTemplate + 1) % templates.length].id);
  };

  const handlePrev = () => {
    setCurrentTemplate((prev) => (prev - 1 + templates.length) % templates.length);
    handleTemplateSelect(templates[(currentTemplate - 1 + templates.length) % templates.length].id);
  };
  
  return (
    <Box sx={{ 
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      width: '100%',
      my: 2
    }}>
      {/* Previous Arrow */}
      <IconButton 
        onClick={handlePrev}
        sx={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
          },
          boxShadow: 2,
          position: 'relative', // Changed from absolute
        }}
      >
        <ArrowBack />
      </IconButton>

      {/* Template Container */}
      <Box sx={{ 
        width: '400px',
        height: '400px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Box sx={{ 
          position: 'absolute',
          display: 'flex',
          transition: 'transform 0.3s ease-in-out',
          transform: `translateX(-${currentTemplate * 100}%)`,
          width: '100%',
          height: '100%',
        }}>
          {templates.map((template, index) => (
            <Box 
              key={index}
              sx={{
                minWidth: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <template.component
                name={`${formData.firstName} ${formData.lastName}`}
                username={formData.firstName?.toLowerCase() || 'username'}
                tagLine={formData.tagLine || ''}
                phoneNumber={formData.phoneNumber || ""}
                bio={formData.shortBio || 'Your bio will appear here'}
                location={formData.location || 'Location'}
                avatarUrl={ typeof avatarUrl === "object" && avatarUrl !== null 
                  ? URL.createObjectURL(avatarUrl.file) 
                  : (typeof avatarUrl === "string" ? avatarUrl : null)}
                facebook= {formData.facebook || ''}
                twitter= {formData.twitter || ''}
                linkedin= {formData.linkedin || ''}
                youtube= {formData.youtube || ''}
                imageList={imageList}
                helpTags= {formData.weHelp|| howCanIHelp || []} 
                needHelpTags = {formData.youHelp || howCanYouHelp || []}
                role={role}
              />
            </Box>
          ))}
        </Box>
      </Box>

      {/* Next Arrow */}
      <IconButton 
        onClick={handleNext}
        sx={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
          },
          boxShadow: 2,
          position: 'relative', // Changed from absolute
        }}
      >
        <ArrowForward />
      </IconButton>
    </Box>
  );
};

export default TemplateStep; 