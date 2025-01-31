import { Box, Typography } from '@mui/material';
import { StyledTextField } from '../StyledComponents';
// import ImageUpload from '../../common/ImageUpload';
import SquareImageUpload from '../../common/SquareImageUpload';

const OptionalInfoStep = ({ formData, handleChange, handleImageUpload, handleDeleteImage, handleFavImage }) => {
  return (
    <Box sx={{ width: '100%' }}>
      <Typography sx={{ color: '#fff', marginTop: "20px", fontSize: "13px" }}>
        Provide a short bio of yourself (this info is public)
      </Typography>
      <StyledTextField
        fullWidth
        placeholder="Tag Line (optional)"
        name="tagLine"
        value={formData.tagLine}
        onChange={handleChange}
        margin="normal"
      />
      <StyledTextField
        fullWidth
        placeholder="Short Bio (optional)"
        name="shortBio"
        value={formData.shortBio}
        onChange={handleChange}
        margin="normal"
        multiline
        rows={4}
      />

      <Typography sx={{ color: '#fff', mt: 2, width: '100%', fontSize: "13px" }}>
        Show the world who you are (optional - this info is public)
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mt: 2, width: '100%', justifyContent: 'space-between' }}>
        {[0, 1, 2].map((index) => (
          <SquareImageUpload
            key={index}
            onImageUpload={(imageUrl) => handleImageUpload(index, imageUrl)}
            // imageUrl={formData[`image${index}`]}
            image={formData.selectedImages[index]}
            imageUrl={formData.selectedImages[index]?.file}
            handleDeleteImage={(imageUrl) => handleDeleteImage(imageUrl)}
            handleFavImage={(imageUrl) => handleFavImage(imageUrl)}
            isDisabled={index > 0 && !formData.selectedImages[index - 1]}
            size={100}
            shape="square"
          />
        ))}
      </Box>
    </Box>
  );
};

export default OptionalInfoStep; 