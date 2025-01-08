import { Box, Typography } from '@mui/material';
import { StyledTextField } from '../StyledComponents';
import ImageUpload from '../ImageUpload';

const OptionalInfoStep = ({ formData, handleChange, handleImageUpload }) => {
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

      <Typography sx={{ color: '#fff', mt: 2, width: '100%', fontSize: "13px"  }}>
        Show the world who you are (optional - this info is public)
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mt: 2, width: '100%', justifyContent: 'space-between'}}>
        {[1, 2, 3].map((index) => (
          <ImageUpload
            key={index}
            onImageUpload={(file) => handleImageUpload(index, file)}
            imageUrl={formData[`image${index}`]}
          />
        ))}
      </Box>
    </Box>
  );
};

export default OptionalInfoStep; 