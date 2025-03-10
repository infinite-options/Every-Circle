import React from 'react';
import { Box, Typography, styled, Paper } from '@mui/material';
import noProfileImage from "../../assets/NoProfiePlaceHolder.png";

const MiniCard = styled(Paper)({
  padding: '20px',
  marginTop: '20px',
  marginBottom: '20px',
  borderRadius: '8px',
  boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.08)',
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  backgroundColor: '#fff',
  border: '1px solid #eee',
  width: '90%',
  marginLeft: '30px'
});

const MiniCardImage = styled(Box)({
  width: '50px',
  height: '50px',
  borderRadius: '4px',
  overflow: 'hidden',
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  }
});

const DetailsContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center'
});

const BusinessCardMini = ({
  businessName,
  tagLine,
  email,
  phoneNumber,
  imageUrl,
  businessImages = [],
  publicFields = {}
}) => {
  // Determine which image to display
  const displayImage = imageUrl || 
    (businessImages && businessImages.length > 0 ? businessImages[0] : null);

  return (
    <MiniCard>
      <MiniCardImage>
        {displayImage ? (
          <img 
            src={displayImage} 
            alt="Business"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = noProfileImage;
            }}
          />
        ) : (
          <img 
            src={noProfileImage}
            alt="No Business Image"
            style={{ 
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        )}
      </MiniCardImage>
      <DetailsContainer>
        <Typography variant="subtitle2" fontWeight="medium">
          {businessName || "Business Name"}
        </Typography>
        {(publicFields.business_tag_line_is_public !== 0) && tagLine && (
          <Typography variant="caption" color="text.secondary">
            {tagLine}
          </Typography>
        )}
        {(publicFields.business_email_id_is_public !== 0) && email && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.7rem' }}>
            {email}
          </Typography>
        )}
        {(publicFields.business_phone_number_is_public !== 0) && phoneNumber && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.7rem' }}>
            {phoneNumber}
          </Typography>
        )}
      </DetailsContainer>
    </MiniCard>
  );
};

export default BusinessCardMini;