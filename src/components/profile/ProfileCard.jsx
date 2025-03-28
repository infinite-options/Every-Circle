import React, { useEffect, useState } from "react";
import { Box, Typography, styled, Paper } from "@mui/material";
import PersonIcon from '@mui/icons-material/Person';
import noProfileImage from "../../assets/NoProfiePlaceHolder.png";

const CardContainer = styled(Paper)({
  //padding: "15px",
  marginBottom: "20px",
  //borderRadius: "10px",
  //boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.08)",
  boxShadow: "none",
  backgroundColor: "white",
  //border: "1px solid #e0e0e0"
});

const ImageContainer = styled(Box)({
  width: "60px",
  height: "60px",
  borderRadius: "50%", // Changed to circle
  overflow: "hidden",
  marginRight: "15px",
  border: "1px solid #e0e0e0",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "#f5f5f5"
});

const DetailsContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center"
});

const MiniCardContent = styled(Box)({
  display: "flex",
  padding: "10px",
 border: "1px solid #e0e0e0",
  borderRadius: "8px",
  backgroundColor: "white"
});

const ProfileCard = ({
  firstName,
  lastName,
  tagLine,
  imageUrl,
  email,
  phoneNumber,
  selectedImages = [],
  deletedImages = []
}) => {
  const [displayImage, setDisplayImage] = useState("");
  
  useEffect(() => {
    // Cleanup function for object URLs
    let objectUrl = null;
    
    // Update the image to display based on various conditions
    if (deletedImages && deletedImages.includes(imageUrl)) {
      // If the current imageUrl is in the deletedImages list, don't display it
      setDisplayImage("");
    } else if (imageUrl) {
      // If there's a valid imageUrl and it's not deleted, display it
      setDisplayImage(imageUrl);
    } else if (selectedImages && selectedImages.length > 0) {
      // If there's no imageUrl but there are newly selected images,
      // find the one marked as coverPhoto (favorite)
      const coverPhoto = selectedImages.find(img => img.coverPhoto);
      if (coverPhoto && coverPhoto.file instanceof File) {
        // Create an object URL for the file
        objectUrl = URL.createObjectURL(coverPhoto.file);
        setDisplayImage(objectUrl);
      } else if (coverPhoto && typeof coverPhoto.file === 'string') {
        // If the file is already a string URL
        setDisplayImage(coverPhoto.file);
      }
    } else {
      // No image available
      setDisplayImage("");
    }
    
    // Clean up function to revoke object URL when component unmounts or when dependencies change
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imageUrl, selectedImages, deletedImages]);

  return (
    <CardContainer>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Mini Card (how you'll appear in searches)
      </Typography>
      
      <MiniCardContent>
        <ImageContainer>
          {displayImage ? (
            <img
              src={displayImage}
              alt="Profile"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={() => setDisplayImage("")} // Handle image load errors
            />
          ) :  <img 
          src={noProfileImage}
          alt="No Profile"
          style={{ 
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
          }
        </ImageContainer>
        <DetailsContainer>
          <Typography variant="body2" fontWeight="medium">
            {firstName || "First"} {lastName || "Last"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {tagLine || ""}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.7rem' }}>
            {email || ""}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.7rem' }}>
            {phoneNumber || ""}
          </Typography>
        </DetailsContainer>
      </MiniCardContent>
    </CardContainer>
  );
};

export default ProfileCard;