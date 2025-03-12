import React from 'react';
import { Box, Typography } from '@mui/material';
import SocialField from '../../common/SocialField';
import yelp from "../../../assets/yelp.png";
import google from "../../../assets/Google.png";
// import website from "../../../assets/website.png";
import website from "../../../assets/web.png";

const BusinessSocialLinksStep = ({ formData, handleChange }) => {
  const socialLinks = [
    { name: 'yelp', img: "https://s3-media0.fl.yelpcdn.com/assets/public/cookbook.yji-0a2bf1d9c330d8747446.svg", label: 'Yelp'},
    { name: 'google', img: "https://loodibee.com/wp-content/uploads/Google-Logo.png", label: 'Google' },
    { name: 'website', img: website, label: 'Website' },
  ];

  return (
    <Box sx={{ width: '100%' }}>
      <Typography sx={{ color: '#fff', marginTop: "20px", fontSize: "13px", textAlign: "center", mb: 3 }}>
        Provide links to your Social Media (this info is public)
      </Typography>

      <SocialField
        icon={website}
        placeholder="Website URL"
        value={formData.website}
        onChange={(value) => handleChange({ target: { name: 'website', value }})}
        name="website"
      />
      
      <SocialField
        icon="https://s3-media0.fl.yelpcdn.com/assets/public/cookbook.yji-0a2bf1d9c330d8747446.svg"
        placeholder="Yelp Profile URL"
        value={formData.yelp}
        onChange={(value) => handleChange({ target: { name: 'yelp', value }})}
        name="yelp"
        
      />
      
      <SocialField
        icon="https://loodibee.com/wp-content/uploads/Google-Logo.png"
        placeholder="Google Business URL"
        value={formData.google}
        onChange={(value) => handleChange({ target: { name: 'google', value }})}
        name="google"
        
        
      />
    </Box>
  );
};

export default BusinessSocialLinksStep; 