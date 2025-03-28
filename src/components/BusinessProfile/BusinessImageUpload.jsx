import React, { useState } from 'react';
import { Box, Typography, styled, IconButton, Paper } from '@mui/material';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import DeleteIcon from '@mui/icons-material/Delete';

const UploadContainer = styled(Box)({
  marginBottom: '20px',
  width: '100%',
});

const ImagePreviewsContainer = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '10px',
});

const ImagePreview = styled(Paper)({
  width: '100px',
  height: '100px',
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '8px',
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  }
});

const UploadButton = styled(Box)({
  border: '2px dashed #ccc',
  borderRadius: '8px',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  backgroundColor: '#f5f5f5',
  '&:hover': {
    backgroundColor: '#e0e0e0',
    borderColor: '#aaa',
  }
});

const DeleteButton = styled(IconButton)({
  position: 'absolute',
  top: '5px',
  right: '5px',
  backgroundColor: 'rgba(255, 255, 255, 0.7)',
  padding: '4px',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  }
});

const BusinessImageUpload = ({ onImagesChange, editMode, publicValue, onPublicToggle }) => {
  const [uploadedImages, setUploadedImages] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  
  const handleImageUpload = (e) => {
    if (!e.target.files || !e.target.files.length) return;
    
    const newFiles = Array.from(e.target.files);
    const newPreviewUrls = newFiles.map(file => URL.createObjectURL(file));
    
    setUploadedImages(prev => [...prev, ...newFiles]);
    setPreviewImages(prev => [...prev, ...newPreviewUrls]);
    
    // Pass the updated files to parent component
    onImagesChange([...uploadedImages, ...newFiles]);
  };
  
  const handleDeleteImage = (index) => {
    const updatedImages = [...uploadedImages];
    const updatedPreviews = [...previewImages];
    
    // Revoke the object URL to avoid memory leaks
    URL.revokeObjectURL(previewImages[index]);
    
    updatedImages.splice(index, 1);
    updatedPreviews.splice(index, 1);
    
    setUploadedImages(updatedImages);
    setPreviewImages(updatedPreviews);
    
    // Pass the updated files to parent component
    onImagesChange(updatedImages);
  };
  
  return (
    <UploadContainer>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 2 
      }}>
        <Typography variant="body1" color="text.secondary">
          Business Images
        </Typography>
        
        {/* Public/Private toggle */}
        {onPublicToggle && (
          <Typography 
            onClick={onPublicToggle}
            sx={{ 
              cursor: editMode ? 'pointer' : 'default', 
              color: '#666',
              fontSize: '14px',
              opacity: editMode ? 1 : 0.7
            }}
          >
            {publicValue === 1 ? 'Public' : <span style={{ color: 'orange' }}>Private</span>}
          </Typography>
        )}
      </Box>
      
      {/* Image previews */}
      {previewImages.length > 0 && (
        <ImagePreviewsContainer>
          {previewImages.map((preview, index) => (
            <ImagePreview key={index} elevation={2}>
              <img src={preview} alt={`Upload ${index + 1}`} />
              {editMode && (
                <DeleteButton 
                  size="small" 
                  onClick={() => handleDeleteImage(index)}
                >
                  <DeleteIcon fontSize="small" />
                </DeleteButton>
              )}
            </ImagePreview>
          ))}
        </ImagePreviewsContainer>
      )}
      
      {/* Upload button */}
      {editMode && (
        <Box sx={{ mt: 2 }}>
          <input
            accept="image/*"
            id="business-image-upload"
            type="file"
            multiple
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
          <label htmlFor="business-image-upload">
            <UploadButton>
              <FileUploadIcon sx={{ fontSize: 40, color: "#666", mb: 1 }} />
              <Typography variant="body2" color="textSecondary">
                Upload Business Images
              </Typography>
              <Typography variant="caption" color="textSecondary">
                (png, jpeg, jpg) Max 5MB
              </Typography>
            </UploadButton>
          </label>
        </Box>
      )}
    </UploadContainer>
  );
};

export default BusinessImageUpload;