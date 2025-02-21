import { TextField, styled } from '@mui/material';

export const StyledTextField = styled(TextField)(({ multiline, required }) => ({
  '& .MuiInputBase-root': {
    backgroundColor: '#fff',
    borderRadius: '8px',
    height: multiline ? 'auto' : '46px'
  },
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: 'transparent',
    },
    '&:hover fieldset': {
      borderColor: 'transparent',
    },
    '&.Mui-focused fieldset': {
      borderColor: 'transparent',
    },
  },
  '& input:-webkit-autofill': {
    WebkitBoxShadow: '0 0 0 1000px #fff inset', // Ensures the background stays white
    backgroundColor: '#fff', 
    height: multiline ? 'auto' : '10px'
  },
  '& input:-webkit-autofill:focus': {
    WebkitBoxShadow: '0 0 0 1000px #fff inset', // Ensures consistency on focus
    backgroundColor: '#fff',
    borderColor: 'transparent',
    height: multiline ? 'auto' : '10px'
  },
  '& input:-webkit-autofill:hover': {
    WebkitBoxShadow: '0 0 0 1000px #fff inset',
    backgroundColor: '#fff',
    height: multiline ? 'auto' : '10px'
  },
})); 