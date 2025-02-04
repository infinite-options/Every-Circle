import { Box, Typography, TextField } from '@mui/material';
import Autocomplete from "../../recommendation/AutoComplete";

const BasicInfoStep = ({ formData, handleChange, errors, setFormData }) => {
  const getAutoCompleteData = (data) => {
    console.log('data in get', data)
    const photos = data?.photos?.map((photo) => photo.getUrl()) || [];
    console.log("photos--", photos);
    setFormData(prev => ({
      ...prev,
      businessName: data.name || "",
      location: data.formatted_address || "",
      phoneNumber: data.formatted_phone_number || "",
      websiteUrl: data.website || "",
      googleId: data.place_id || "",
      googleRating: data.rating || "",
      googlePhotos: photos,
      favImage: photos[0] || "",
      priceLevel: data.price_level || "",
      addressLine1: data.addressLine1 || "",
      addressLine2: data.addressLine2 || "",
      city: data.city || "",
      state: data.state || "",
      country: data.country || "",
      zip: data.zip || "",
      latitude: data.geometry.location.lat() || "",
      longitude: data.geometry.location.lng() || "",
      types: data.types || []
    }));
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Autocomplete getAutoCompleteData={getAutoCompleteData} formData={formData} backgroundColor={"#F5F5F5"} />

      <Typography sx={{ color: '#fff', marginTop: "20px", fontSize: "13px" }}>
        Your location
      </Typography>
      <TextField
        required
        fullWidth
        placeholder="Location"
        name="location"
        value={formData.location}
        onChange={handleChange}
        margin="normal"
        error={!!errors.location}
        helperText={errors.location}
        sx={{
          backgroundColor: "#F5F5F5",
          borderRadius: 2,
          "& .MuiOutlinedInput-root": {
            borderRadius: 2,
          },
        }}
      />

      <Typography sx={{ color: '#fff', marginTop: "20px", fontSize: "13px" }}>
        Your phone number
      </Typography>
      <TextField
        fullWidth
        placeholder="Phone Number"
        name="phoneNumber"
        value={formData.phoneNumber}
        onChange={handleChange}
        margin="normal"
        error={!!errors.phoneNumber}
        helperText={errors.phoneNumber}
        sx={{
          backgroundColor: "#F5F5F5",
          borderRadius: 2,
          "& .MuiOutlinedInput-root": {
            borderRadius: 2,
          },
        }}
      />
    </Box>
  );
};

export default BasicInfoStep; 