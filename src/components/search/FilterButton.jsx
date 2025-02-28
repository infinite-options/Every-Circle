import React, { useState } from 'react';
import { IconButton, Menu, MenuItem, Checkbox, FormControlLabel } from '@mui/material';
// Here's the correct import path
import filterIcon from '../../assets/filter_list_icon.png';

const FilterButton = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [filters, setFilters] = useState({
    option1: false,
    option2: false,
    option3: false
  });
  
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleClose = () => {
    setAnchorEl(null);
  };
  
  const handleFilterChange = (event) => {
    setFilters({
      ...filters,
      [event.target.name]: event.target.checked
    });
  };
  
  return (
    <>
      <IconButton 
        onClick={handleClick}
        aria-label="filter"
        aria-controls="filter-menu"
        aria-haspopup="true"
      >
        <img 
          src={filterIcon} 
          alt="Filter" 
          style={{ width: '24px', height: '24px' }} 
        />
      </IconButton>
      <Menu
        id="filter-menu"
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        <MenuItem onClick={(e) => e.stopPropagation()}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={filters.option1}
                onChange={handleFilterChange}
                name="option1"
              />
            }
            label="Option 1"
          />
        </MenuItem>
        <MenuItem onClick={(e) => e.stopPropagation()}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={filters.option2}
                onChange={handleFilterChange}
                name="option2"
              />
            }
            label="Option 2"
          />
        </MenuItem>
        <MenuItem onClick={(e) => e.stopPropagation()}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={filters.option3}
                onChange={handleFilterChange}
                name="option3"
              />
            }
            label="Option 3"
          />
        </MenuItem>
      </Menu>
    </>
  );
};

export default FilterButton;