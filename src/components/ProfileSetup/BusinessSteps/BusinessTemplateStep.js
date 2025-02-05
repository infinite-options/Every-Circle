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

const BusinessTemplateStep = ({ formData, handleTemplateSelect, role }) => {
  console.log('form data in business template step', formData);
  const [currentTemplate, setCurrentTemplate] = useState(0);
  const avatarUrl = formData.favImage;
  const businessGooglePhotos = formData.businessGooglePhotos.filter((photo) => photo != formData.favImage);
  const templates = [
    {
      component: DarkTemplate,
      value: 'Dark',
      id: 0,
    },
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
    },
    {
      component: CreativeTemplate,
      value: 'creative',
      id: 4
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
      my: 1
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
        minHeight: '500px',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
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
                name={`${formData.businessName}`}
                tagLine={formData.tagLine || ''}
                phoneNumber={formData.phoneNumber || ""}
                bio={formData.shortBio || 'Your bio will appear here'}
                location={`${formData.city || ''}, ${formData.state || ''}, ${formData.country || ''}` || 'Location'}
                avatarUrl={avatarUrl}
                imageList={businessGooglePhotos}
                yelp={formData.yelp}
                google={formData.google}
                website={formData.website}
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

export default BusinessTemplateStep; 