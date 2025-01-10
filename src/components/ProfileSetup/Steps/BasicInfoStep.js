import { Box, Typography } from '@mui/material';
import { StyledTextField } from '../StyledComponents';

const BasicInfoStep = ({ formData, handleChange }) => {
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
      />
      <StyledTextField
        fullWidth
        placeholder="Last Name"
        name="lastName"
        value={formData.lastName}
        onChange={handleChange}
        margin="normal"
      />
      
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
      />
    </Box>
  );
};

export default BasicInfoStep; 