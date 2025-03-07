import { Box, Typography, TextField } from '@mui/material';
import { StyledTextField } from '../StyledComponents';

const BasicInfoStep = ({ formData, handleChange, errors }) => {
  return (
    <Box sx={{ width: '100%' }}>
      <Typography sx={{ color: '#fff', marginTop: "20px", fontSize: "13px" }}>
        Your full name (this info will be public)
      </Typography>
      <StyledTextField
        fullWidth
        placeholder="First Name"
        name="firstName"
        value={formData.firstName}
        onChange={handleChange}
        margin="normal"
        error={!!errors.firstName}
        helperText={errors.firstName}
      />
      <StyledTextField
        fullWidth
        placeholder="Last Name"
        name="lastName"
        value={formData.lastName}
        onChange={handleChange}
        margin="normal"
        error={!!errors.lastName}
        helperText={errors.lastName}
      />

      {/* <Typography sx={{ color: '#fff', marginTop: "20px", fontSize: "13px" }}>
        Your location (city, state)
      </Typography>
      <StyledTextField
        required
        fullWidth
        placeholder="Location"
        name="location"
        value={formData.location}
        onChange={handleChange}
        margin="normal"
        error={!!errors.location}
        helperText={errors.location}
      /> */}

      <Typography sx={{ color: '#fff', marginTop: "20px", fontSize: "13px" }}>
        Your phone number (this info is private)
      </Typography>
      <StyledTextField
        fullWidth
        placeholder="Phone Number"
        name="phoneNumber"
        value={formData.phoneNumber}
        onChange={handleChange}
        margin="normal"
        error={!!errors.phoneNumber}
        helperText={errors.phoneNumber}
      />
    </Box>
  );
};

export default BasicInfoStep; 