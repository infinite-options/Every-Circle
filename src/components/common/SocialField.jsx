import React from 'react';
import { Box, TextField, styled } from '@mui/material';

const SocialFieldContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  marginBottom: '16px',
  gap: '12px',
});

const SocialIcon = styled('img')({
  width: '24px',
  height: '24px',
});

const StyledTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    backgroundColor: 'white',
  },
});

export default function SocialField({ icon, placeholder, value, onChange, name, disabled }) {
  return (
    <SocialFieldContainer>
      <SocialIcon src={icon} alt={placeholder} />
      <StyledTextField
        fullWidth
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        name={name}
        disabled={disabled}
      />
    </SocialFieldContainer>
  );
} 