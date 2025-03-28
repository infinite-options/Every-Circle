//print user option page
import React, {useState} from 'react';
import { Box, Typography } from '@mui/material';
import { StyledTextField } from '../StyledComponents';
import DeleteIcon from '@mui/icons-material/Delete';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import IconButton from '@mui/material/IconButton';
import ImageList from '@mui/material/ImageList';
import ImageListItem from '@mui/material/ImageListItem';

const OptionalBusinessInfoStep = ({ formData, handleChange, setFormData, userId }) => {
  console.log('formData in optionalBusinessInfostep', formData);
  const [favoriteIcons, setFavoriteIcons] = useState(
		formData?.businessGooglePhotos ? formData?.businessGooglePhotos.map((image, index) => index === 0): []);

    const [deletedIcons, setDeletedIcons] = useState(
      formData?.businessGooglePhotos ? new Array(formData?.businessGooglePhotos.length).fill(false) : []);

  const handleDeleteImage = (idx) => {
    const updatedGooglePhotos = formData.businessGooglePhotos.filter((photo, index) => index !== idx);
    // console.log(updatedGooglePhotos);
    setFormData((prev) => ({...prev, businessGooglePhotos : updatedGooglePhotos}));
  }

  const handleFavImage = (idx) => {
    const newFav = formData.businessGooglePhotos[idx];
    setFormData((prev) => ({...prev, favImage: newFav}));
    const updatedFavIcons = favoriteIcons.map((_, index) => index === idx ? true : false);
    // console.log(updatedFavIcons, idx);
    setFavoriteIcons(updatedFavIcons);
  }

  return (
    <Box sx={{ width: '355px' }}>
      <Typography sx={{ color: '#fff', marginTop: "20px", fontSize: "13px" }}>
        Provide a short bio of your business (this info is public)
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
      <Box
        sx={{
          display: 'flex',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          maxWidth: "600px",
        }}
      >
        <ImageList
          sx={{ display: 'flex', flexWrap: 'nowrap' }}
          cols={5}
        >
          {formData.businessGooglePhotos?.map((image, index) => (
            <ImageListItem
              key={index}
              sx={{
                width: 'auto',
                flex: '0 0 auto',
                border: '1px solid #ccc',
                margin: '0 2px',
                position: 'relative',
              }}
            >
              <img
                src={image}
                alt={`place-${index}`}
                style={{
                  height: '120px',
                  width: '120px',
                  objectFit: 'cover',
                }}
              />
              <Box sx={{ position: 'absolute', top: 0, right: 0 }}>
                <IconButton
                  onClick={() => handleDeleteImage(index)}
                  sx={{
                    color: deletedIcons[index] ? 'red' : 'black',
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    },
                    margin: '2px',
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
              <Box sx={{ position: 'absolute', bottom: 0, left: 0 }}>
                <IconButton
                  onClick={() => handleFavImage(index)}
                  sx={{
                    color: favoriteIcons[index] ? 'red' : 'black',
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    },
                    margin: '2px',
                  }}
                >
                  {favoriteIcons[index] ? (
                    <FavoriteIcon />
                  ) : (
                    <FavoriteBorderIcon />
                  )}
                </IconButton>
              </Box>
            </ImageListItem>
          ))}
        </ImageList>
      </Box>

      {/* User ID display */}
      <Typography sx={{ color: '#fff', marginTop: "20px", fontSize: "13px", borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: "10px" }}>
        User ID: {userId || "Not available"}
      </Typography>

    </Box>
  );
};

export default OptionalBusinessInfoStep;