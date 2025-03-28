/// amek gdu alt

import { Box, Typography } from '@mui/material';
import { StyledTextField } from '../StyledComponents';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import YouTubeIcon from '@mui/icons-material/YouTube';

const SocialLinksStep = ({ formData, handleChange }) => {
  const socialLinks = [
    { name: 'facebook', icon: <FacebookIcon />, label: 'Facebook' },
    { name: 'twitter', icon: <TwitterIcon />, label: 'Twitter' },
    { name: 'linkedin', icon: <LinkedInIcon />, label: 'LinkedIn' },
    { name: 'youtube', icon: <YouTubeIcon />, label: 'YouTube' },
  ];

  return (
    <Box sx={{ width: '100%' }}>
      <Typography sx={{ color: '#fff', marginTop: "20px", fontSize: "13px", }}>
        Provide links to your Social Media (this info is public)
      </Typography>

      {socialLinks.map((social) => (
        <Box key={social.name} sx={{ display: 'flex', alignItems: 'center', gap: 2}}>
          {social.icon}
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

export default SocialLinksStep; 