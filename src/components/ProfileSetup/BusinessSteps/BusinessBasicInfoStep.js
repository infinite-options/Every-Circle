import { Box, Typography, TextField } from '@mui/material';
import React, { useState } from "react";
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import Autocomplete from "../../recommendation/AutoComplete";
import axios from "axios";
import { useLocation } from "react-router-dom";

const BasicInfoStep = ({ formData, handleChange, errors, setFormData, isClaimed, setIsClaimed }) => {
  const [showSpinner, setShowSpinner] = useState(false);
  const location = useLocation();
    // Extract userId from URL query parameters
    const queryParams = new URLSearchParams(location.search);
    const userId = queryParams.get('userId');
    
  

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
    <Box sx={{ width: '355px' }}>
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
        EIN Number (EIN is required to register your business, EIN number will not be public)
      </Typography>
      <TextField
        fullWidth
        required
        placeholder="EIN Number"
        name="einNumber"
        value={formData.einNumber}
        error={!!errors.einNumber}
        onChange={handleChange}
        helperText={errors.einNumber}
        margin="normal"
        sx={{
          backgroundColor: "#F5F5F5",
          borderRadius: 2,
          "& .MuiOutlinedInput-root": {
            borderRadius: 2,
          },
        }}
      />

    <Typography sx={{ color: '#fff', marginTop: "10px", fontSize: "13px" }}>
        User ID: {userId || "Not available"}
      </Typography> 

    </Box>
    
  );
};

export default BasicInfoStep; 