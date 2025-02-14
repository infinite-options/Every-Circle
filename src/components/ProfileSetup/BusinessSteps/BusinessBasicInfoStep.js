import { Box, Typography, TextField } from '@mui/material';
import React, { useState } from "react";
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import Autocomplete from "../../recommendation/AutoComplete";
import axios from "axios";

const BasicInfoStep = ({ formData, handleChange, errors, setFormData, isClaimed, setIsClaimed }) => {
  const [showSpinner, setShowSpinner] = useState(false);
  

  const getAutoCompleteData = async (data) => {
    console.log('data in get', data)
    const photos = data?.photos?.map((photo) => photo.getUrl()) || [];
    console.log("photos--", photos);
    setFormData(prev => ({
      ...prev,
      businessName: data.name || "",
      location: data.formatted_address || "",
      phoneNumber: data.formatted_phone_number || "",
      website: data.website || "",
      googleId: data.place_id || "",
      googleRating: data.rating || "",
      businessGooglePhotos: photos,
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

    await fetchProfile(data.place_id);
  }

  const fetchProfile = async (googlePlaceId) => {
    try {
        setShowSpinner(true);
        const response = await axios.get(`https://ioec2testsspm.infiniteoptions.com/business/${googlePlaceId}`);
        // console.log('response from business endpoint', response);
        if (response.status === 200) {
            const business = response.data?.result?.[0];
            console.log('business data is', business);
            setIsClaimed(true);
        }else{
            setIsClaimed(false);
        }
    } catch (error) {
        setIsClaimed(false);
        console.error("Error fetching Business profile:", error);
    } finally {
        setShowSpinner(false);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Backdrop sx={{ color: '#fff', zIndex: 1 }} open={showSpinner}>
          <CircularProgress color="inherit" />
      </Backdrop>

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

      <Typography sx={{ color: '#fff', marginTop: "20px", fontSize: "13px" }}>
        EIN Number
      </Typography>
      <TextField
        fullWidth
        required
        placeholder="EIN Number"
        name="einNumber"
        onChange={handleChange}
        margin="normal"
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