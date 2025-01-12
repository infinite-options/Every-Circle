import React from "react";
import { useNavigate } from "react-router";
import { Box, IconButton, styled } from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ShareIcon from '@mui/icons-material/Share';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

const StyledIconButton = styled(IconButton)({
  width: '60px',
  height: '60px',
});

const NavigationBar = () => {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        width: "100%",
        marginTop: "auto",
      }}
    >
       <StyledIconButton aria-label="home" onClick={() => navigate('/profile')}>
        <AccountCircleIcon sx={{ width: '30px', height: '30px' }} />
      </StyledIconButton>
      <StyledIconButton aria-label="search" onClick={() => navigate('/settings')}>
        <SettingsIcon sx={{ width: '30px', height: '30px' }} />
      </StyledIconButton>
      <StyledIconButton aria-label="add" onClick={() => navigate('/account')}>
        <AccountBalanceIcon sx={{ width: '30px', height: '30px' }} />
      </StyledIconButton>
      <StyledIconButton aria-label="favorites" onClick={()=>navigate('/network')}>
        <ShareIcon sx={{ width: '30px', height: '30px' }} />
      </StyledIconButton>
      <StyledIconButton aria-label="profile" onClick={()=>navigate('/search')}>
        <SearchOutlinedIcon sx={{ width: '30px', height: '30px' }} />
      </StyledIconButton>
    </Box>
  );
};  

export default NavigationBar;
