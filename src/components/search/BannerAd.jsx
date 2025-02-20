import React from 'react';
import { Paper, Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledPaper = styled(Paper)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: "20px",
  width: '100%',
  backgroundColor: theme.palette.background.paper,
}));

const ContentContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  padding: theme.spacing(0, 4),
}));

const BannerAd = ({ 
  leftImage, 
  rightImage, 
  businessName, 
  tagline, 
  bio 
}) => {
  return (
    <StyledPaper elevation={0}>
      {/* Left Image */}
      <Box 
        sx={{
          width: "100px",
          height: "100px",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img src={leftImage} alt="Left Image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Box>

      {/* Center Content */}
      <ContentContainer>
        <Typography sx={{fontSize: "1.5rem", fontWeight: "bold"}}>
          {businessName}
        </Typography>
        <Typography sx={{fontSize: "1rem"}} color="text.secondary">
          {tagline}
        </Typography>
        <Typography sx={{fontSize: "0.875rem"}} color="text.secondary">
          {bio}
        </Typography>
      </ContentContainer>

      {/* Right Image */}
      <Box
        sx={{
          width: "100px",
          height: "100px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img src={rightImage} alt="Right Image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Box>
    </StyledPaper>
  );
};

export default BannerAd;