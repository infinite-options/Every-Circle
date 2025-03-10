import React from 'react';
import { Box, Typography, styled, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

const CategoryContainer = styled(Box)({
  marginBottom: '20px',
  width: '100%',
});

const CategoryLabel = styled(Typography)({
  color: '#666',
  fontSize: '16px',
  marginBottom: '8px',
});

const StyledFormControl = styled(FormControl)({
  width: '100%',
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    backgroundColor: '#f5f5f5',
    '&:hover fieldset': {
      borderColor: '#ccc',
    },
  },
  '& .MuiInputLabel-root': {
    color: '#666',
  },
  '& .MuiSelect-icon': {
    color: '#ff9933', // Orange color for the dropdown arrow
  },
});

const BusinessCategoryDropdown = ({ 
  label, 
  value, 
  onChange, 
  options = [], 
  disabled = false,
  placeholder = "Select category" 
}) => {
  return (
    <CategoryContainer>
      <CategoryLabel>{label}</CategoryLabel>
      <StyledFormControl variant="outlined" disabled={disabled}>
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          displayEmpty
          IconComponent={KeyboardArrowDownIcon}
          renderValue={(selected) => {
            if (!selected) {
              return <Typography sx={{ color: '#888' }}>{placeholder}</Typography>;
            }
            
            const selectedOption = options.find(option => option.id === selected);
            return selectedOption ? selectedOption.name : selected;
          }}
        >
          {options.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.name}
            </MenuItem>
          ))}
        </Select>
      </StyledFormControl>
    </CategoryContainer>
  );
};

export default BusinessCategoryDropdown;