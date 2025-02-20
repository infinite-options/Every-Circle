import { Box, Typography, TextField } from '@mui/material';
import React, { useState } from "react";
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import CategorySelector from '../../common/CategorySelector';

const BusinessCategoryStep = ({ formData, handleChange, errors, setFormData, isClaimed, setIsClaimed }) => {
    const [showSpinner, setShowSpinner] = useState(false);


    return (
        <Box sx={{ width: '100%' }}>
            <Backdrop sx={{ color: '#fff', zIndex: 1 }} open={showSpinner}>
                <CircularProgress color="inherit" />
            </Backdrop>

            <CategorySelector setFormData={setFormData} formData={formData}></CategorySelector>
        </Box>
    );
};
  
  export default BusinessCategoryStep; 