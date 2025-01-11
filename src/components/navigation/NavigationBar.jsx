import React from "react";
import { useNavigate } from "react-router";
import { Box, IconButton } from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ShareIcon from '@mui/icons-material/Share';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

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
       <IconButton aria-label="home" sx={{ width: '60px', height: '60px' }} onClick={() => navigate('/profile')}>
        <AccountCircleIcon sx={{ width: '30px', height: '30px' }} />
      </IconButton>
      <IconButton aria-label="search" sx={{ width: '60px', height: '60px' }} onClick={() => navigate('/settings')}>
        <SettingsIcon sx={{ width: '30px', height: '30px' }} />
      </IconButton>
      <IconButton aria-label="add" sx={{ width: '60px', height: '60px' }} onClick={() => navigate('/account')}>
        <AccountBalanceIcon sx={{ width: '30px', height: '30px' }} />
      </IconButton>
      <IconButton aria-label="favorites" sx={{ width: '60px', height: '60px'}} onClick={()=>navigate('/network')}>
        <ShareIcon sx={{ width: '30px', height: '30px' }} />
      </IconButton>
      <IconButton aria-label="profile" sx={{ width: '60px', height: '60px' }} onClick={()=>navigate('/search')}>
        <SearchOutlinedIcon sx={{ width: '30px', height: '30px' }} />
      </IconButton>
    </Box>
  );
};  

export default NavigationBar;
