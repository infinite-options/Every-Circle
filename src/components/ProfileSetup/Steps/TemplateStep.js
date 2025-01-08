import { Box, IconButton } from '@mui/material';
import { ArrowBack, ArrowForward } from '@mui/icons-material';
import { useState } from 'react';
import { 
  ModernTemplate, 
  MinimalistTemplate, 
  SplitTemplate, 
  CreativeTemplate 
} from '../../profileTemplate';

const TemplateStep = ({ formData, handleTemplateSelect }) => {
  const [currentTemplate, setCurrentTemplate] = useState(0);

  const templates = [
    {
      component: ModernTemplate,
      value: 'modern'
    },
    {
      component: MinimalistTemplate,
      value: 'minimalist'
    },
    {
      component: SplitTemplate,
      value: 'split'
    },
    {
      component: CreativeTemplate,
      value: 'creative'
    }
  ];

  const handleNext = () => {
    setCurrentTemplate((prev) => (prev + 1) % templates.length);
    // handleTemplateSelect(templates[(currentTemplate + 1) % templates.length].value);
  };

  const handlePrev = () => {
    setCurrentTemplate((prev) => (prev - 1 + templates.length) % templates.length);
    // handleTemplateSelect(templates[(currentTemplate - 1 + templates.length) % templates.length].value);
  };
  
  return (
    <Box sx={{ 
      width: '100%', 
      height: '500px',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Container for all templates */}
      <Box sx={{ 
        position: 'absolute',
        display: 'flex',
        transition: 'transform 0.3s ease-in-out',
        transform: `translateX(-${currentTemplate * 100}%)`, 
        width: '100%',  
        height: '100%',
        marginTop: '20%' 
      }}>
        {templates.map((template, index) => (
          <Box 
            key={index}
            sx={{
              width: '100%', 
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            <Box sx={{ width: '600px', height: '100%' }}>
              <template.component
                name={`${formData.firstName} ${formData.lastName}`}
                username={formData.firstName?.toLowerCase() || 'username'}
                bio={formData.shortBio || 'Your bio will appear here'}
                location={formData.location || 'Location'}
                avatarUrl={formData.image1 ? URL.createObjectURL(formData.image1) : null}
              />
            </Box>
          </Box>
        ))}
      </Box>
  
      {/* Navigation Arrows */}
      <IconButton 
        onClick={handlePrev}
        sx={{ 
          position: 'absolute',
          left: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
          },
          boxShadow: 2,
        }}
      >
        <ArrowBack />
      </IconButton>
  
      <IconButton 
        onClick={handleNext}
        sx={{ 
          position: 'absolute',
          right: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
          },
          boxShadow: 2,
        }}
      >
        <ArrowForward />
      </IconButton>

    </Box>
  );
  
};

export default TemplateStep; 