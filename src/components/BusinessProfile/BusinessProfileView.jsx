// product added 
import React from 'react';
import { Box, Typography, styled, IconButton, Paper } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import StyledContainer from '../common/StyledContainer';
import Header from '../common/Header';
import NavigationBar from '../navigation/NavigationBar';
import website from "../../assets/web.png";
import yelp from "../../assets/yelp.png";
import google from "../../assets/Google.png";
import youtube from "../../assets/youtube-icon.png";
import noProfileImage from "../../assets/NoProfiePlaceHolder.png";
import moneyBag from "../../assets/moneybag.png";
import axios from "axios";
import BusinessProducts from './BusinessProducts';

const ViewContainer = styled(Box)({
  padding: '20px',
  backgroundColor: '#fff',
  borderRadius: '10px',
  width:'100%'
});


const ProfileHeader = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  marginBottom: '20px'
});

const HeaderContent = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  width: '100%',
});

const BusinessInfo = styled(Box)({
  flex: 1,
});

const MiniCard = styled(Paper)({
  padding: '15px',
  marginTop: '20px',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  backgroundColor: '#f5f5f5',
});



const SectionContainer = styled(Box)({
  marginBottom: '20px',
  padding: '15px',
  borderRadius: '8px',
  border: '1px solid #e0e0e0',
});

const SocialLinkContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  padding: '8px',
  backgroundColor: '#f5f5f5',
  borderRadius: '4px',
  marginBottom: '8px',
  '& img': {
    width: '24px',
    height: '24px',
    marginRight: '12px',
  }
});

const SocialLinkText = styled(Typography)({
  color: '#666',
  flex: 1,
});

const CategoryTag = styled(Box)({
  backgroundColor: '#e0e0e0',
  borderRadius: '16px',
  padding: '4px 12px',
  margin: '4px',
  display: 'inline-block',
});

const ImagePreviewContainer = styled(Box)({
  display: 'flex',
  gap: '8px',
  overflowX: 'auto',
  padding: '4px',
  '&::-webkit-scrollbar': {
    height: '6px',
  },
  '&::-webkit-scrollbar-track': {
    background: '#f1f1f1',
    borderRadius: '3px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: '#888',
    borderRadius: '3px',
  },
});

const ImagePreview = styled(Box)({
  minWidth: '60px',
  width: '60px',
  height: '60px',
  borderRadius: '4px',
  overflow: 'hidden',
  flexShrink: 0,
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  }
});

const CouponBox = styled(Box)({
  border: '2px solid #000',
  borderRadius: '8px',
  padding: '16px',
  textAlign: 'center',
  cursor: 'pointer',
  marginBottom: '16px',
  '&:hover': {
    backgroundColor: '#f5f5f5',
  }
});


const BannerSection = styled(Box)({
  backgroundColor: '#e0e0e0',
  padding: '16px',
  textAlign: 'center',
  marginTop: '24px',
});

export default function BusinessProfileView({ formData, publicFields, onEditClick }) {

  const handleCouponClick = async () => {
    try {
      const payload = {
        "buyer_id": "110-000002",
        "recommender_id": "110-000003",
        "bs_id": formData.businessId 
      };
      
      const response = await axios.post(
        "https://ioEC2testsspm.infiniteoptions.com/api/v1/transactions", 
        payload
      );
      
      console.log("Coupon redeemed successfully:", response.data);
      
    } catch (error) {
      console.error("Error redeeming coupon:", error);
    }
  };
  const renderSocialLink = (icon, link, placeholder) => {
    // Only render if link exists and is not empty
    if (!link || link.trim() === '') {
      return null;
    }
    
    return (
      <SocialLinkContainer
        component="a"
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          textDecoration: 'none',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: '#e8e8e8'
          }
        }}
      >
        <img src={icon} alt={placeholder} />
        <SocialLinkText>
          {link}
        </SocialLinkText>
      </SocialLinkContainer>
    );
  };

  return (
    <StyledContainer sx = {{backgroundColor:'white'}}>
      <Header title="Business Profile" />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', padding: '0px 30px', width: '100%' }}>
            <IconButton 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEditClick();
        }}
        sx={{ cursor: 'pointer' }}
      >
        <EditIcon />
      </IconButton>
      </Box>
      <ViewContainer>
        <ProfileHeader>
          <HeaderContent>
            <BusinessInfo>
              <Typography variant="h4">
                {formData.businessName || "Business Name"}
              </Typography>
              {publicFields.business_tag_line_is_public === 1 && (
              <Typography variant="subtitle1" sx={{ color: '#666', mt: 1 }}>
                {formData.tagLine || ""}
              </Typography>)}
              {publicFields.business_short_bio_is_public === 1 && (
              <Typography variant="body1" sx={{ mt: 2 }}>
                {formData.shortBio || ""}
              </Typography>)}
              <Typography variant="body2" sx={{ mt: 1 }}>
                {formData.phoneNumber || "Add business phone number"}
              </Typography>
                {/* Email - only show if public and exists */}
                  {publicFields.business_email_id_is_public === 1 && formData.email &&  (
                    <Typography variant="body2" sx={{ color: '#666', mt: 1 }}>
                    {formData.email || "email"}
                    </Typography>
                  )}
              {/* Always show location if it exists */}
              {formData.location && (
                <Typography variant="body2">
                  {formData.location}
                </Typography>
              )}
            </BusinessInfo>

          </HeaderContent>
        </ProfileHeader>

        {/* Business Categories */}
        {/*<Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Categories</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {formData.businessTypes?.map((category, index) => (
              <CategoryTag key={index}>
                <Typography variant="body2">{category}</Typography>
              </CategoryTag>
            ))}
          </Box>
        </Box> */}

        {/* Social Links Section */}
        <Box sx={{ mt: 4, mb: 4 }}>
  {/* Only display section heading if any links exist */}
  {(formData.website || formData.yelp || formData.google || formData.youtube) && (
    <Typography variant="h6" sx={{ mb: 2 }}>Social Links</Typography>
  )}
  
  {formData.website && renderSocialLink(website, formData.website, "Website")}
  {formData.yelp && renderSocialLink(yelp, formData.yelp, "Yelp")}
  {formData.google && renderSocialLink(google, formData.google, "Google Business")}
  {formData.youtube && renderSocialLink(youtube, formData.youtube, "YouTube")}
</Box>

        {/* Business Photos */}
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Business Photos</Typography>
          <ImagePreviewContainer>
            {formData.businessGooglePhotos?.slice(0, 4).map((photo, index) => (
              <ImagePreview key={index}>
                <img src={photo} alt={`Business ${index + 1}`} />
              </ImagePreview>
            ))}
          </ImagePreviewContainer>
        </Box>

        {/* Coupon Section */}
        <CouponBox onClick={handleCouponClick}>
  <Typography>
    Click for a $5 Coupon
  </Typography>
</CouponBox>
{/* Business Products Section */}
<BusinessProducts 
  editMode={false}
  businessId={formData.businessId}
  products={formData.businessServices || []}
  onProductsChange={() => {}}
/>

        {/* Banner Section */}
        <BannerSection>
          <Typography variant="h6" sx={{ color: '#333' }}>
            Banner Adds
          </Typography>
        </BannerSection>

      </ViewContainer>
      <NavigationBar />
    </StyledContainer>
  );
}