import { Box } from '@mui/material';
import ImageUpload from './ImageUpload';

const SquareImageUpload = ({
  onImageUpload,
  imageUrl,
  handleDeleteImage,
  isDisabled,
  handleFavImage,
  favImage,
  size = 100,
}) => {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: isDisabled ? '#e0e0e0' : '#fff',
      }}
    >
      <ImageUpload
        onImageUpload={onImageUpload}
        imageUrl={imageUrl}
        handleDeleteImage={handleDeleteImage}
        isDisabled={isDisabled}
        handleFavImage={handleFavImage}
        favImage={favImage}
        shape="square"
      />
    </Box>
  );
};

export default SquareImageUpload;
