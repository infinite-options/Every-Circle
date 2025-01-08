import { Box, IconButton } from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';

const ImageUpload = ({ onImageUpload, imageUrl }) => {
  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file && file.size <= 2.5 * 1024 * 1024) { // 2.5MB limit
      onImageUpload(file);
    } else {
      alert('Please upload an image smaller than 2.5MB');
    }
  };

  return (
    <Box
      sx={{
        width: 100,
        height: 100,
        bgcolor: '#fff',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {imageUrl ? (
        <img
          src={URL.createObjectURL(imageUrl)}
          alt="Uploaded"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <IconButton component="label">
          <input
            type="file"
            hidden
            accept="image/*"
            onChange={handleImageChange}
          />
          <AddPhotoAlternateIcon />
        </IconButton>
      )}
    </Box>
  );
};

export default ImageUpload; 