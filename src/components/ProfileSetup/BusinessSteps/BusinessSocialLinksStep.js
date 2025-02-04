import { Box, Typography } from '@mui/material';
import { StyledTextField } from '../StyledComponents';
import yelp from "../../../assets/yelp.png";
import google from "../../../assets/Google.png";
import website from "../../../assets/website.png";

const BusinessSocialLinksStep = ({ formData, handleChange }) => {
  const socialLinks = [
    { name: 'yelp', img: yelp, label: 'Yelp'},
    { name: 'google', img: google, label: 'Google' },
    { name: 'website', img: website, label: 'Website' },
  ];

  return (
    <Box sx={{ width: '100%' }}>
      <Typography sx={{ color: '#fff', marginTop: "20px", fontSize: "13px", textAlign:"center", mb:1}}>
        Provide links to your Social Media (this info is public)
      </Typography>

      {socialLinks.map((social) => (
        <Box key={social.name} sx={{ 
           display: 'flex',  
          flexDirection: 'column', 
          alignItems: 'center',  
          justifyContent: 'center', 
          // gap: 1, 
          mb: 3,
          textAlign: "center"}}>
          <img src={social.img} style={{width:"80px", height:"45px"}} alt={social.name}></img>
          <StyledTextField
            fullWidth
            placeholder={`Enter ${social.label} Link (optional)`}
            name={social.name}
            value={formData[social.name]}
            onChange={handleChange}
            margin="normal"
          />
        </Box>
      ))}
    </Box>
  );
};

export default BusinessSocialLinksStep; 