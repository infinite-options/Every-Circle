import React from 'react';
import { Paper, Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledPaper = styled(Paper)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2),
  marginTop: "20px",
  width: '100%',
  backgroundColor: theme.palette.background.paper,
}));

const ImageContainer = styled(Box)(({ theme }) => ({
  width: 96,
  height: 96,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& img': {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  },
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
    <StyledPaper elevation={1}>
      {/* Left Image */}
      <ImageContainer>
        <img 
          src={leftImage} 
          alt="Left banner"
        />
      </ImageContainer>

      {/* Center Content */}
      <ContentContainer>
        <Typography variant="h5" component="h1" gutterBottom={0.5}>
          {businessName}
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom={0.5}>
          {tagline}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {bio}
        </Typography>
      </ContentContainer>

      {/* Right Image */}
      <ImageContainer>
        <img 
          src={rightImage} 
          alt="Right banner"
        />
      </ImageContainer>
    </StyledPaper>
  );
};

export default BannerAd;