import React from 'react';
import { Box, Typography, styled, Paper, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
// Import custom icons from assets
import eyeIcon from "../../assets/eye.png";
import closedEyeIcon from "../../assets/closedEye.png";
import verifiedIcon from "../../assets/VerifiedProfile.png";

const MiniCardContainer = styled(Box)({
  marginTop: '30px',
  marginBottom: '30px',
  width: '100%'
});

const MiniCard = styled(Paper)({
  padding: '20px',
  borderRadius: '16px',
  marginBottom: '16px',
  position: 'relative',
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
  border: '1px solid #e0e0e0',
  overflow: 'hidden'
});

const ProfileImage = styled(Box)({
  width: '80px',
  height: '80px',
  borderRadius: '8px',
  overflow: 'hidden',
  marginRight: '16px',
  backgroundColor: '#e0e0e0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  }
});

const ActionIcons = styled(Box)({
  position: 'absolute',
  right: '16px',
  top: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
});

const SectionTitle = styled(Typography)({
  fontWeight: 600,
  marginBottom: '16px',
  borderBottom: '1px solid #e0e0e0',
  paddingBottom: '8px'
});

const HeaderLabels = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '16px',
  paddingLeft: '16px',
  paddingRight: '16px'
});

function RelatedBusinessMinicard({ editMode = true }) {
  return (
    <MiniCardContainer>
      <SectionTitle variant="h6">
        Mini Cards
      </SectionTitle>
      
      <HeaderLabels>
        <Typography variant="subtitle2" sx={{ color: '#666' }}>
          Owners
        </Typography>
        
        <Typography variant="subtitle2" sx={{ color: '#666' }}>
          Public
        </Typography>
      </HeaderLabels>
      
      {/* First Card - Closed Eye */}
      <MiniCard elevation={1}>
        <Box sx={{ display: 'flex' }}>
          <ProfileImage>
            <Typography variant="body2" sx={{ color: '#666' }}>
              No Image
            </Typography>
          </ProfileImage>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 'normal' }}>
              Prashant Marathay
            </Typography>
            <Typography variant="body1" sx={{ color: '#757575' }}>
              Carpe Diem Average Five to Six Words
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: '#757575' }}>
              pmarathay@gmail.com
            </Typography>
            <Typography variant="body2" sx={{ color: '#757575' }}>
              (408) 476-0001
            </Typography>
          </Box>
          
          <ActionIcons>
            <IconButton 
              size="small" 
              sx={{ 
                backgroundColor: '#f5f5f5', 
                width: '36px', 
                height: '36px'
              }}
            >
              <img 
                src={verifiedIcon} 
                alt="Verified" 
                style={{ width: '24px', height: '24px' }} 
              />
            </IconButton>
            
            <IconButton 
              size="small" 
              sx={{ 
                backgroundColor: '#f5f5f5', 
                width: '36px', 
                height: '36px'
              }}
            >
              <img 
                src={closedEyeIcon} 
                alt="Hidden" 
                style={{ width: '24px', height: '24px' }} 
              />
            </IconButton>
            
            <IconButton 
              size="small" 
              sx={{ 
                backgroundColor: '#f5f5f5', 
                width: '36px', 
                height: '36px'
              }}
            >
              <DeleteIcon />
            </IconButton>
          </ActionIcons>
        </Box>
      </MiniCard>
      
      {/* Second Card - Open Eye */}
      <MiniCard elevation={1}>
        <Box sx={{ display: 'flex' }}>
          <ProfileImage>
            <Typography variant="body2" sx={{ color: '#666' }}>
              No Image
            </Typography>
          </ProfileImage>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 'normal' }}>
              Prashant Marathay
            </Typography>
            <Typography variant="body1" sx={{ color: '#757575' }}>
              Carpe Diem Average Five to Six Words
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: '#757575' }}>
              pmarathay@gmail.com
            </Typography>
            <Typography variant="body2" sx={{ color: '#757575' }}>
              (408) 476-0001
            </Typography>
          </Box>
          
          <ActionIcons>
            <IconButton 
              size="small" 
              sx={{ 
                backgroundColor: '#f5f5f5', 
                width: '36px', 
                height: '36px'
              }}
            >
              <img 
                src={verifiedIcon} 
                alt="Verified" 
                style={{ width: '24px', height: '24px' }} 
              />
            </IconButton>
            
            <IconButton 
              size="small" 
              sx={{ 
                backgroundColor: '#f5f5f5', 
                width: '36px', 
                height: '36px'
              }}
            >
              <img 
                src={eyeIcon} 
                alt="Visible" 
                style={{ width: '24px', height: '24px' }} 
              />
            </IconButton>
            
            <IconButton 
              size="small" 
              sx={{ 
                backgroundColor: '#f5f5f5', 
                width: '36px', 
                height: '36px'
              }}
            >
              <DeleteIcon />
            </IconButton>
          </ActionIcons>
        </Box>
      </MiniCard>
    </MiniCardContainer>
  );
}

export default RelatedBusinessMinicard;