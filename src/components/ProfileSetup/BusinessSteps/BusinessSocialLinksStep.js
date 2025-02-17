import { Box, Typography } from '@mui/material';
import { StyledTextField } from '../StyledComponents';
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
          mb: 1,
          textAlign: "center"}}>
          <img src={social.img} style={{width: social.name !== "website" ? "80px" : "90px", height: social.name === "website" ? "70px" : "80px"}} alt={social.name}></img>
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