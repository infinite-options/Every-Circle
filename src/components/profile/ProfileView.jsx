////business fetch 

/// resume name display


//// delete resume 

// clickable business


import React from 'react';
import { Box, Typography, styled, IconButton, Paper, TextField, Button, Rating } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import StyledContainer from '../common/StyledContainer';
import Header from '../common/Header';
import NavigationBar from "../navigation/NavigationBar";
import facebook from "../../assets/facebook-icon.png";
import youtube from "../../assets/youtube-icon.png";
import linkedin from "../../assets/linkedin-icon.png";
import twitter from "../../assets/twitter-icon.png";
import moneyBag from "../../assets/moneybag.png";
import noProfileImage from "../../assets/NoProfiePlaceHolder.png";
import { useNavigate } from "react-router-dom";


const ViewContainer = styled(Box)({
  backgroundColor: '#fff',
  width: '100%',
});

const ProfileHeader = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  marginBottom: '20px',
});

const HeaderContent = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  width: '100%',
});

const ProfileInfo = styled(Box)({
  flex: 1,
});

const ProfileImage = styled(Box)({
  width: '120px',
  height: '120px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '12px',
  overflow: 'hidden',
  backgroundColor: '#fff',
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  }
});

const MiniCard = styled(Paper)({
  padding: '20px',
  marginTop: '20px',
  marginBottom: '20px',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  backgroundColor: '#fff',
  border: '1px solid #eee',
  width: '90%',
  maxWidth: '800px',
  marginLeft: 'auto',
  marginRight: 'auto'
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

const SectionContainer = styled(Box)({
  marginBottom: '20px',
  padding: '10px',
  borderRadius: '8px',
  backgroundColor: '#fff',
  
  border: '1px solid #eee',
  marginLeft: '10px',
  width: '100%',
  
});

const SocialIcon = styled('img')({
  width: '24px',
  height: '24px',
  marginRight: '10px',
});

const SocialLinks = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  marginTop: '10px',
  gap: '15px',
});

const SocialLinkContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  padding: '12px 16px',
  backgroundColor: '#f5f5f5',
  borderRadius: '8px',
  marginBottom: '12px',
  width: '90%',
  maxWidth: '800px',
  marginLeft: 'auto',
  marginRight: 'auto',
  '& img': {
    width: '28px',
    height: '28px',
    marginRight: '16px',
  }
});

const SocialLinkText = styled(Typography)({
  color: '#888',
  flex: 1,
  fontSize: '16px',
});

const ExpertiseCard = styled(Box)(({ theme }) => ({
  backgroundColor: 'white',
  borderRadius: '24px',
  //padding: '24px',
  //marginLeft: '10px',
  width: '90%',
  marginBottom: '16px',
  //border: '1px solid #e0e0e0',
}));

const ExpertiseTitle = styled(Typography)({
  fontSize: '20px',
  color: '#666',
  marginBottom: '12px',
  marginLeft: '20px'
});

const ExpertiseDescription = styled(Typography)({
  fontSize: '18px',
  color: '#666',
  marginBottom: '24px',
  marginLeft: '20px'
});

const ExpertiseFooter = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 'auto',
  gap: '10px',
  marginLeft: '20px',
  flexWrap: 'nowrap'
});

const ActionButton = styled(Box)({
  backgroundColor: '#f5f5f5',
  color: '#666',
  padding: '12px 12px',
  borderRadius: '8px',
  fontSize: '16px',
  whiteSpace: 'nowrap',
  marginRight: '20px', 
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: '#e0e0e0',
  },
});

const CostDisplay = styled(Box)({
  backgroundColor: '#f5f5f5',
  color: '#666',
  padding: '12px 12px',
  borderRadius: '8px',
  fontSize: '16px',
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  marginRight: 'auto'
});

const SectionTitle = styled(Typography)({
  fontSize: '24px',
  color: '#333',
  marginBottom: '12px',
  
});

const EditButton = styled(IconButton)({
  marginLeft: 'auto',
});

const WishCard = styled(Box)(({ theme }) => ({
  backgroundColor: 'white',
  borderRadius: '16px',
  //padding: '20px',
  marginBottom: '16px',
  //border: '2px solid black',
  marginLeft: '30px',
  width: '90%',
}));

const WishTitle = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    borderRadius: '24px',
    backgroundColor: 'white',
  },
  '& .MuiOutlinedInput-input': {
    padding: '12px 20px',
  },
  marginBottom: '16px',
});

const WishDescription = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: '#f5f5f5',
  },
  marginBottom: '20px',
});

const WishFooter = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

const BountyDisplay = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  backgroundColor: '#f5f5f5',
  padding: '8px 16px',
  borderRadius: '8px',
  '& img': {
    width: '20px',
    height: '20px',
  },
});

const BusinessCard = styled(Box)(({ theme }) => ({
  backgroundColor: 'white',
  borderRadius: '16px',
  padding: '20px',
  marginBottom: '16px',
  border: '1px solid #e0e0e0',
  marginLeft: '30px',
  width: '90%',
}));

const BannerSection = styled(Box)({
  backgroundColor: '#fff',
  borderRadius: '8px',
  padding: '16px 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '24px',
  border: '1px solid #eee',
  
});

const SectionHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '16px',
});

const VerifiedBadge = styled('img')({
  width: '28px',
  height: '28px',
  marginRight: '10px',
});

export default function ProfileView({ formData, publicFields, onEditClick, verifiedIcon }) {
  const navigate = useNavigate(); 
  const renderExperience = (exp) => (
    <SectionContainer>
      <Typography variant="subtitle1" sx={{ color: '#888', fontWeight: 'normal' }}>
        {exp.startDate ? exp.startDate.replace(/\d{4}/, match => match.slice(2)) : ""} {exp.startDate || exp.endDate ? "-" : ""} {exp.endDate ? exp.endDate.replace(/\d{4}/, match => match.slice(2)) : ""}
      </Typography>
      <Typography variant="h6" sx={{ color: '#888', mt: 1 }}>
        {exp.company || ""}
      </Typography>
      <Typography variant="body1" sx={{ color: '#888', mt: 1 }}>
        {exp.title || ""}
      </Typography>
    </SectionContainer>
  );

  // Add this new function alongside your other render functions
  const renderResume = () => {
    // If resume is not set to public, don't show this section
    if (publicFields.profile_personal_resume_is_public !== 1 || !formData.resume) {
      return null;
    }
    
    // Extract resume details
    let fileName = "";
    let resumeUrl = "";
    
    try {
      // Handle resume data stored as JSON string array
      if (typeof formData.resume === 'string') {
        try {
          // Try to parse as JSON first (for the array format)
          const resumeData = JSON.parse(formData.resume);
          if (Array.isArray(resumeData) && resumeData.length > 0) {
            fileName = resumeData[0].filename || "Resume";
            resumeUrl = resumeData[0].link || "";
          } else {
            // Fallback to treating as a direct URL
            fileName = formData.resume.split('/').pop();
            resumeUrl = formData.resume;
          }
        } catch (e) {
          // If parsing fails, treat as direct URL
          fileName = formData.resume.split('/').pop();
          resumeUrl = formData.resume;
        }
      } 
      // If we have resumeDetails, use that
      else if (formData.resumeDetails && formData.resumeDetails.fileName) {
        fileName = formData.resumeDetails.fileName;
        // For File objects, we don't have a URL
        resumeUrl = typeof formData.resume === 'string' ? formData.resume : null;
      }
      // Fallback for File objects
      else if (formData.resume instanceof File) {
        fileName = formData.resume.name;
        resumeUrl = null;
      }
    } catch (e) {
      console.error("Error processing resume data:", e);
      fileName = "Resume";
      resumeUrl = null;
    }
  
    return (
      <SectionContainer sx={{ 
        display: 'flex', 
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px'
      }}>
        <Box>
          <Typography variant="h6" sx={{ color: '#888', fontWeight: 'normal' }}>
            Resume
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: resumeUrl ? 'primary.main' : '#888', 
              mt: 1,
              textDecoration: resumeUrl ? 'underline' : 'none',
              cursor: resumeUrl ? 'pointer' : 'default'
            }}
            component={resumeUrl ? "a" : "p"}
            href={resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {fileName}
          </Typography>
        </Box>
        <Box 
          sx={{ 
            width: '100px',
            height: '100px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            cursor: resumeUrl ? 'pointer' : 'default'
          }}
          component={resumeUrl ? "a" : "div"}
          href={resumeUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Typography variant="body2" color="text.secondary">
            Resume
          </Typography>
        </Box>
      </SectionContainer>
    );
  };
  const renderEducation = (edu) => (
    <SectionContainer>
      <Typography variant="subtitle1" sx={{ color: '#888', fontWeight: 'normal' }}>
        {edu.startDate ? edu.startDate.replace(/\d{4}/, match => match.slice(2)) : ""} {edu.startDate || edu.endDate ? "-" : ""} {edu.endDate ? edu.endDate.replace(/\d{4}/, match => match.slice(2)) : ""}
      </Typography>
      <Typography variant="h6" sx={{ color: '#888', mt: 1 }}>
        {edu.school || ""}
      </Typography>
      <Typography variant="body1" sx={{ color: '#888', mt: 1 }}>
        {edu.degree || ""}
      </Typography>
    </SectionContainer>
  );

  const renderExpertise = (expertise) => {
    if (!expertise || expertise.length === 0) return null;

    return (
      <Box>
        <Typography variant="h5" sx={{ fontFamily: 'Lexend',
    //fontSize: '16px',
    fontWeight: 'bold',
    lineHeight: '18px',
    letterSpacing: '0',
    
    mb: 3,color: '#888', paddingLeft: '20px' }}>
          Expertise
        </Typography>
        {expertise.map((item, index) => (
          <ExpertiseCard key={index}>
            <ExpertiseTitle>
              {item.headline || ""}
            </ExpertiseTitle>
            <ExpertiseDescription>
              {item.description || ""}
            </ExpertiseDescription>
            <ExpertiseFooter>
            Cost: 
              <CostDisplay>
                {item.cost && item.cost !== "0" ? `$${item.cost}/hr` : "Free"}
              </CostDisplay>
              <ActionButton>
                Book a Session
              </ActionButton>
            </ExpertiseFooter>
          </ExpertiseCard>
        ))}
      </Box>
    );
  };

  const renderWishes = (wishes) => {
    if (!wishes || wishes.length === 0) return null;
  
    return (
      <Box>
        <Typography variant="h5" sx={{ fontFamily: 'Lexend',
    //fontSize: '16px',
    fontWeight: 'bold',
    lineHeight: '18px',
    letterSpacing: '0',
    mb: 3,color: '#888',paddingLeft: '20px'  }}>
          Wishes
        </Typography>
        {wishes.map((wish, index) => (
          <Box 
            key={index}
            sx={{ 
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '16px',
              //border: '1px solid black',
              marginLeft: '10px',
              width: '90%',
            }}
          >
            <Typography variant="h6" sx={{ color: '#666', mb: 2, fontWeight: 'normal' }}>
              {wish.helpNeeds || ""}
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#666', mb: 3 }}>
              {wish.details || ""}
            </Typography>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  backgroundColor: '#f5f5f5',
                  padding: '8px 16px',
                  borderRadius: '8px',
                }}
              >
                <img src={moneyBag} alt="Bounty" style={{ width: '20px', height: '20px', marginRight: '8px' }}/>
                ${wish.bounty && wish.bounty !== "0" ? wish.bounty : "1000"}
              </Box>
              
              <Box 
                sx={{ 
                  backgroundColor: '#f5f5f5',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  color: '#666',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: '#e0e0e0',
                  }
                }}
              >
                Contact Me
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    );
  };

  const renderSocialLink = (icon, link, placeholder) => {
    // Only render if the link is not empty
    if (!link) return null;
    
    return (
      <SocialLinkContainer>
        <img src={icon} alt={placeholder} />
        <SocialLinkText
          component="a"
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: '#888',
            textDecoration: 'none',
            '&:hover': {
              color: '#555',
              textDecoration: 'underline'
            }
          }}
        >
          {link}
        </SocialLinkText>
      </SocialLinkContainer>
    );
  };

  const editButton = (section) => (
    <EditButton
      onClick={() => onEditClick(section)}
      sx={{ cursor: 'pointer' }}
    >
      <EditIcon />
    </EditButton>
  );

  const renderBannerSection = () => {
    // Only show if banner ads are allowed (public)
    if (publicFields.profile_personal_allow_banner_ads !== 1) {
      return null;
    }
    
    return (
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h5" sx={{ color: '#888', mb: 2, fontWeight: 'normal', paddingLeft: '20px' }}>
          Banner Ads
        </Typography>
        <Box sx={{ 
          backgroundColor: '#fff',
          borderRadius: '8px',
          marginLeft: '30px',
          height: '60px',
          width: '90%',
          border: '1px solid #eee'
        }} />
      </Box>
    );
  };

  const renderBusinesses = () => {
    if (!formData.businesses || formData.businesses.length === 0 || 
        (formData.businesses.length === 1 && !formData.businesses[0].name)) {
      return null;
    }
  
    // Helper function to get business image with fallback logic
    const getBusinessImage = (business) => {
      // First check business_favorite_image
      if (business.business_favorite_image) {
        return business.business_favorite_image;
      }
      
      // Then check business_images_url
      if (business.business_images_url) {
        return business.business_images_url;
      }
      
      // Finally, try to get the first image from business_google_photos
      if (business.business_google_photos) {
        try {
          // If it's a string, try to parse it as JSON
          if (typeof business.business_google_photos === 'string') {
            const photos = JSON.parse(business.business_google_photos);
            if (photos && photos.length > 0) {
              return photos[0];
            }
          } 
          // If it's already an array
          else if (Array.isArray(business.business_google_photos) && business.business_google_photos.length > 0) {
            return business.business_google_photos[0];
          }
        } catch (e) {
          console.error("Error parsing business_google_photos:", e);
        }
      }
      
      // Default: return null if no image found
      return null;
    };

    const handleBusinessClick = (business) => {
      // Navigate to the business profile edit page with the selected business data
      navigate('/businessProfile', { 
        state: { 
          editMode: true,
          selectedBusinessId: business.uid,
          fromProfile: true
        } 
      });
      // Log navigation for debugging
      console.log(`Navigating to business profile for: ${business.name}, ID: ${business.uid}`);
    };

    return (
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h5" sx={{ 
          color: '#888', 
          fontWeight: 'normal', 
          mb: 2,
          paddingLeft: '20px' 
        }}>
          Related Businesses
        </Typography>
        
        {formData.businesses.map((business, index) => {
          const businessImage = getBusinessImage(business);
          
          return (
            <Box 
              key={index}
              onClick={() => handleBusinessClick(business)}
              sx={{ 
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                padding: '16px',
                marginBottom: '16px',
                width: '90%',
                maxWidth: '800px',
                marginLeft: 'auto',
                marginRight: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                cursor: 'pointer', // Make it look clickable
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: '#f9f9f9',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                  transform: 'translateY(-2px)'
                },
                '&:active': {
                  transform: 'translateY(0px)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }
              }}
            >
              {/* Business image */}
              <Box sx={{ 
                width: '80px', 
                height: '80px', 
                backgroundColor: '#f5f5f5', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #eee',
                overflow: 'hidden'
              }}>
                {businessImage ? (
                  <img 
                    src={businessImage} 
                    alt={business.name || "Business"}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    image
                  </Typography>
                )}
              </Box>
              
              {/* Business details */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ 
                  mb: 0.5,
                  color: '#666',
                  fontSize: '18px',
                  fontWeight: 'medium'
                }}>
                  {business.name || ""}
                </Typography>
                
                <Typography variant="body2" sx={{ 
                  color: '#888',
                  fontSize: '14px'
                }}>
                  {business.business_tag_line || ""}
                </Typography>
                
                <Typography variant="body2" sx={{ 
                  color: '#888',
                  fontSize: '14px',
                  mt: 0.5
                }}>
                  {business.business_email_id || ""}
                </Typography>
                
                <Typography variant="body2" sx={{ 
                  color: '#888',
                  fontSize: '14px'
                }}>
                  {business.business_phone_number || ""}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  };
  

  
 

  return (
    <StyledContainer sx={{ backgroundColor: 'transparent', padding: 0, maxWidth: '100%',  display: 'flex',
      flexDirection: 'column',
      alignItems: 'center' }}>
      <Header title="Profile" />
      
      {/* Icons row */}
      <Box sx={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        marginLeft: '20px',
        width: '95%',
      }}>
        <Box>
          {verifiedIcon && (
            <img src={verifiedIcon} alt="Verified" style={{ width: '28px', height: '28px' }} />
          )}
        </Box>
        <IconButton 
          onClick={(e) => {
            // Prevent default form submission behavior
            e.preventDefault();
            // Stop event propagation
            e.stopPropagation();
            // Call the provided edit handler with the event
            onEditClick(e);
          }} 
          size="small"
        >

          <EditIcon />
        </IconButton>
      </Box>
      
      <ViewContainer>
        <ProfileHeader>
          <HeaderContent sx={{ padding: '20px' }}>
            <ProfileInfo sx={{ paddingLeft: '0px' }}>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontFamily: 'Lexend',
                  fontWeight: 'bold', 
                  fontSize: '24px',
                  lineHeight: '30px',
                  letterSpacing: '-4%',
                }}
              >
                {formData.firstName || ""} {formData.lastName || ""}
              </Typography>
              
              {publicFields.profile_personal_tag_line_is_public === 1 && (
                <Typography variant="subtitle1" sx={{ color: '#888', mt: 1 }}>
                  {formData.tagLine || ""}
                </Typography>
              )}
              {publicFields.profile_personal_short_bio_is_public === 1 && (
                <Typography variant="body1" sx={{ mt: 2, color: '#888' }}>
                  {formData.shortBio || ""}
                </Typography>
              )}
              {publicFields.profile_personal_phone_number_is_public === 1 && (
                <Typography variant="body2" sx={{ mt: 1, color: '#888' }}>
                  {formData.phoneNumber || ""}
                </Typography>
              )}
              {publicFields.profile_personal_email_is_public === 1 && (
              <Typography variant="body2" sx={{ mt: 1, color: '#888' }}>
                {formData.user_email || ""}
              </Typography>)}
            </ProfileInfo>
            
            {publicFields.profile_personal_image_is_public === 1 && (
              <ProfileImage sx={{ paddingRight: '0px' }} >
                {formData.profileImages[0] ? (
                  <img 
                    src={typeof formData.profileImages[0] === 'string' 
                      ? formData.profileImages[0] 
                      : URL.createObjectURL(formData.profileImages[0])} 
                    alt="Profile"
                  />
                ) : (
                  <img 
                    src={noProfileImage}
                    alt="No Profile"
                    style={{ 
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                )}
              </ProfileImage>
            )}
          </HeaderContent>

          <MiniCard>
            <MiniCardImage>
              {formData.profileImages[0] && publicFields.profile_personal_image_is_public ==1 ? (
                <img 
                  src={typeof formData.profileImages[0] === 'string' 
                    ? formData.profileImages[0] 
                    : URL.createObjectURL(formData.profileImages[0])} 
                  alt="Profile"
                />
              ) : <img 
                  src={noProfileImage}
                  alt="No Profile"
                  style={{ 
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
                }
            </MiniCardImage>
            <Box>
              
              <Typography variant="subtitle2">
                {formData.firstName || ""} {formData.lastName || ""}
              </Typography>
              {publicFields.profile_personal_tag_line_is_public === 1 && (
              <Typography variant="body2" color="#888">
                {formData.tagLine || ""}
              </Typography>)}
              {publicFields.profile_personal_phone_number_is_public === 1 && (
              <Typography variant="caption" color="#888" display="block">
                {formData.phoneNumber || ""}
              </Typography>)}
              {publicFields.profile_personal_email_is_public === 1 && (
              <Typography variant="caption" color="#888" display="block">
                {formData.user_email || ""}
              </Typography>)}
            </Box>
          </MiniCard>
        </ProfileHeader>

        {publicFields.profile_personal_experience_is_public === 1 && (
          <Box sx={{ 
            mt: 4, 
            mb: 4,
            border: '1px solid black',
            borderRadius: '8px',
            padding: '20px',
            width: '90%',
            maxWidth: '800px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            <Typography variant="h5" sx={{ fontFamily: 'Lexend',
    //fontSize: '16px',
    fontWeight: 'bold',
    lineHeight: '18px',
    letterSpacing: '0',
    mb: 3,  color: '#888',paddingLeft: '20px' }}>Experience</Typography>
            {formData.experience.length > 0 ? (
              formData.experience.map((exp, index) => (
                <Box key={`exp-${index}`}>
                  {renderExperience(exp)}
                </Box>
              ))
            ) : (
              renderExperience({})
            )}
          </Box>
        )}

{/* Add this new block right after the experience section and before education section */}
{publicFields.profile_personal_resume_is_public === 1 && formData.resume && (
  <Box sx={{ mt: 4 }}>
    <Typography variant="h5" sx={{ mb: 2, fontWeight: 'normal', color: '#888',paddingLeft: '20px' }}>Resume</Typography>
    {renderResume()}
  </Box>
)}
        {publicFields.profile_personal_education_is_public === 1 && (
          <Box sx={{ 
              mt: 4, 
              mb: 4,
              border: '1px solid black',
              borderRadius: '8px',
              padding: '20px',
              width: '90%',
              maxWidth: '800px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
            <Typography variant="h5" sx={{fontFamily: 'Lexend',
    //fontSize: '16px',
    fontWeight: 'bold',
    lineHeight: '18px',
    letterSpacing: '0',
    mb: 3, color: '#888',paddingLeft: '20px'}}>Education</Typography>
            {formData.education.length > 0 ? (
              formData.education.map((edu, index) => (
                <Box key={`edu-${index}`}>
                  {renderEducation(edu)}
                </Box>
              ))
            ) : (
              renderEducation({})
            )}
          </Box>
        )}
        
        {/* Social Links Section - Positioned exactly after Education */}
        {(formData.facebookLink || formData.twitterLink || formData.linkedinLink || formData.youtubeLink) && (
        <Box sx={{ mt: 4, mb: 4 }}>
          {renderSocialLink(facebook, formData.facebookLink, "facebook")}
          {renderSocialLink(twitter, formData.twitterLink, "twitter")}
          {renderSocialLink(linkedin, formData.linkedinLink, "linkedin")}
          {renderSocialLink(youtube, formData.youtubeLink, "youtube")}
        </Box>)}
        
        {/* Banner Adds Section */}
        {renderBannerSection()}

        {publicFields.profile_personal_expertise_is_public === 1 && (
          <Box sx={{ 
            mt: 4, 
            mb: 4,
            border: '1px solid black',
            borderRadius: '8px',
            padding: '20px',
            width: '90%',
            maxWidth: '800px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            {renderExpertise(formData.expertise)}
          </Box>
        )}

        {publicFields.profile_personal_wishes_is_public === 1 && (
          <Box sx={{ 
            mt: 4, 
            mb: 4,
            border: '1px solid black',
            borderRadius: '8px',
            padding: '20px',
            width: '90%',
            maxWidth: '800px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            {renderWishes(formData.wishes)}
          </Box>
        )}

        {/* Related Businesses Section */}
        {renderBusinesses()}
      </ViewContainer>
      <NavigationBar />
    </StyledContainer>
  );
}