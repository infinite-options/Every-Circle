import { Box } from '@mui/material';
import ImageUpload from './ImageUpload';

const CircleImageUpload = ({
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
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: "#FF9500",
        "&:hover": {
            backgroundColor: "#ffb300",
        },
        textTransform: "none",
        margin: "8px auto",
      }}
    >
      <ImageUpload
        onImageUpload={onImageUpload}
        imageUrl={imageUrl}
        handleDeleteImage={handleDeleteImage}
        // isDisabled={isDisabled}
        // handleFavImage={handleFavImage}
        // favImage={favImage}
        shape="circle"
      />
    </Box>
  );
};

export default CircleImageUpload;
