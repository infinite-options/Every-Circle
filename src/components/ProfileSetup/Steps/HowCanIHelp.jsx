import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { StyledTextField } from '../StyledComponents';

const HowCanIHelp = ({ formData, handleChange, setFormData }) => {
    // console.log(formData.howCanIHelp)
    return (
        <Box sx={{ width: '100%' }}>
            {[0, 1, 2, 3].map((id) => {
                const nameTemp = `howCanIHelp${id}`;

                return (<Box key={id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <StyledTextField
                        fullWidth
                        name={nameTemp}
                        placeholder={`Enter Tag`}
                        value={formData[nameTemp] || ""} 
                        onChange={handleChange} 
                        margin="normal"
                    />
                </Box>)
            })}
        </Box>
    );
};

export default HowCanIHelp;