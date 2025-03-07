import React from 'react';
import { Box, Typography, styled } from '@mui/material';
import SocialField from '../../common/SocialField';
import website from "../../../assets/web.png";
import yelp from "../../../assets/yelp.png";
import google from "../../../assets/Google.png";

const StepContainer = styled(Box)({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
});

export default function BusinessProfileStep({ formData, handleChange }) {
  return (
    <StepContainer>
      <Typography variant="h6" sx={{ color: '#fff', textAlign: 'center', mb: 2 }}>
        Add Your Business Social Links
      </Typography>
      
      <SocialField
        icon={website}
        placeholder="Website URL"
        value={formData.website}
        onChange={(value) => handleChange({ target: { name: 'website', value }})}
        name="website"
      />
      
      <SocialField
        icon={yelp}
        placeholder="Yelp Profile URL"
        value={formData.yelp}
        onChange={(value) => handleChange({ target: { name: 'yelp', value }})}
        name="yelp"
      />
      
      <SocialField
        icon={google}
        placeholder="Google Business URL"
        value={formData.google}
        onChange={(value) => handleChange({ target: { name: 'google', value }})}
        name="google"
      />
    </StepContainer>
  );
} 