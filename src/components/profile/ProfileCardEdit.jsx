import React from "react";
import { Box, Typography, styled, Paper, Grid } from "@mui/material";
import { InputField } from "../common/InputField";
import SquareImageUpload from '../common/SquareImageUpload';

const CardContainer = styled(Paper)({
  padding: "20px",
  marginBottom: "20px",
  borderRadius: "10px",
  boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.1)",
  backgroundColor: "#ffffff",
  border: "1px solid #e0e0e0"
});

const SectionTitle = styled(Typography)({
  fontWeight: "500",
  marginBottom: "15px",
  color: "#333",
  borderBottom: "1px solid #eaeaea",
  paddingBottom: "8px"
});

const PreviewContainer = styled(Box)({
  marginTop: "15px",
  padding: "15px",
  backgroundColor: "#f9f9f9",
  borderRadius: "6px",
  border: "1px dashed #ccc"
});

const ProfileCardEdit = ({
  formData,
  errors,
  handleImageUpload,
  handleDeleteImage,
  handleFavImage,
  setFormData,
  user,
  selectedImages,
  deletedImages
}) => {
  return (
    <CardContainer>
      <SectionTitle variant="h6">
        Edit Profile Information
      </SectionTitle>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <InputField
            required
            label="First Name"
            value={formData.firstName}
            onChange={(value) => setFormData({ ...formData, firstName: value })}
            backgroundColor="white"
            error={errors.firstName}
            helperText={errors.firstName}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <InputField
            required
            label="Last Name"
            value={formData.lastName}
            onChange={(value) => setFormData({ ...formData, lastName: value })}
            backgroundColor="white"
            error={errors.lastName}
            helperText={errors.lastName}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <InputField
            required
            label="Phone Number"
            value={formData.phoneNumber}
            onChange={(value) => setFormData({ ...formData, phoneNumber: value })}
            backgroundColor="white"
            error={errors.phoneNumber}
            helperText={errors.phoneNumber}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <InputField
            required
            label="Location"
            value={formData.location}
            onChange={(value) => setFormData({ ...formData, location: value })}
            backgroundColor="white"
            error={errors.location}
            helperText={errors.location}
          />
        </Grid>
        <Grid item xs={12}>
          <InputField
            label="Tag Line"
            optional
            value={formData.tagLine}
            onChange={(value) => setFormData({ ...formData, tagLine: value })}
            backgroundColor="white"
            placeholder="Your professional headline (40 characters max)"
          />
        </Grid>
        <Grid item xs={12}>
          <InputField
            label="Short Bio"
            optional
            multiline
            rows={4}
            value={formData.shortBio}
            onChange={(value) => setFormData({ ...formData, shortBio: value })}
            backgroundColor="white"
            placeholder="Tell others about your professional background and expertise (15 words recommended)"
          />
        </Grid>
      </Grid>

      <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
        Profile Images
      </Typography>
      <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-start", flexWrap: "wrap" }}>
        {[0, 1, 2].map((index) => {
          const existingImage = formData.profileImages && formData.profileImages[index];
          const newUploadedImage = selectedImages?.find(img => img.index === index);
          const imageToDisplay = existingImage || (newUploadedImage?.file);
          
          return (
            <SquareImageUpload
              key={index}
              index={index}
              onImageUpload={(file) => handleImageUpload(index, file)}
              image={newUploadedImage || (existingImage ? { index, file: existingImage } : null)}
              imageUrl={imageToDisplay}
              handleDeleteImage={(imageUrl) => handleDeleteImage(imageUrl)}
              handleFavImage={(imageUrl) => handleFavImage(imageUrl)}
              favImage={formData.favImage}
              isDisabled={false}
              size={100}
              shape="square"
            />
          );
        })}
      </Box>

      <PreviewContainer>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Mini Card Preview
        </Typography>
        
        <Box sx={{ display: "flex", p: 2, border: "1px solid #e0e0e0", borderRadius: "8px", backgroundColor: "white" }}>
          {/* Avatar */}
          <Box sx={{ 
            width: "60px", 
            height: "60px", 
            borderRadius: "50%", 
            overflow: "hidden", 
            marginRight: "15px",
            border: "1px solid #e0e0e0",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#f5f5f5"
          }}>
            {formData.favImage ? (
              <img 
                src={formData.favImage} 
                alt="Profile" 
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <Box sx={{ 
                bgcolor: "#f0f0f0", 
                width: "100%", 
                height: "100%", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: "#999"
              }}>
                {formData.firstName && formData.lastName ? 
                  `${formData.firstName.charAt(0)}${formData.lastName.charAt(0)}` : 
                  "FL"}
              </Box>
            )}
          </Box>
          
          {/* Details */}
          <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <Typography variant="body2" fontWeight="medium">
              {formData.firstName || "First"} {formData.lastName || "Last"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formData.tagLine || "Your professional headline"}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.7rem' }}>
              {user && user.email ? user.email : "email@example.com"}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.7rem' }}>
              {formData.phoneNumber || "Phone Number"}
            </Typography>
          </Box>
        </Box>
      </PreviewContainer>
    </CardContainer>
  );
};

export default ProfileCardEdit;