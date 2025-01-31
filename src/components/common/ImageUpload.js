import { Box, IconButton, Typography } from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import CloseIcon from '@mui/icons-material/Close';
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";

const ImageUpload = ({ onImageUpload, image, imageUrl, handleDeleteImage, isDisabled, handleFavImage, favImage, shape }) => {
  // console.log("Image--", image);
  // console.log("ImageUrl--", imageUrl);
  // console.log("favImage--", favImage);
  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file && file.size <= 2.5 * 1024 * 1024) { // 2.5MB limit
      onImageUpload(file);
    } else {
      alert('Please upload an image smaller than 2.5MB');
    }
  };

  return (
    <>
      {imageUrl ? (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <img
            src={typeof (imageUrl) === "string" ? imageUrl : URL.createObjectURL(imageUrl)}
            // src={imageUrl}
            alt="Uploaded"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {shape === "square" &&
            <IconButton disabled={isDisabled} onClick={() => handleFavImage(imageUrl)}
              style={{
                position: 'absolute',
                top: '1px',
                right: '40px',
                background: 'rgba(0, 0, 0, 0.5)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '25px',
                height: '25px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              {favImage ? (
                imageUrl === favImage ? (
                  <FavoriteIcon color='primary' sx={{ color: "red" }} />
                ) : (
                  <FavoriteBorderIcon color='red' />
                )
              ) : image?.coverPhoto ? (
                <FavoriteIcon color='primary' sx={{ color: "red" }} />
              ) : (
                <FavoriteBorderIcon color='red' />
              )}
            </IconButton>
          }
          <CloseIcon disabled={isDisabled}
            onClick={() => {
              if (!isDisabled)
                handleDeleteImage(imageUrl)
            }
            }
            style={{
              position: 'absolute',
              top: shape === "square" ? '1px' : '10px',
              right: shape === "square" ? '8px' : '14px',
              background: 'rgba(0, 0, 0, 0.5)',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              width: '25px',
              height: '25px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
          </CloseIcon>
        </div>
      ) : (
        <IconButton component="label" sx={{ width: '100%', height: '100%' }}>
          <input
            type="file"
            hidden
            accept="image/*"
            onChange={handleImageChange}
            disabled={isDisabled}
          />
          {shape === "square" ? <AddPhotoAlternateIcon />
            : <Typography sx={{ color: "white", fontSize: "14px" }}>Upload Receipt</Typography>}
        </IconButton>
      )}
    </>
  );
};

export default ImageUpload; 