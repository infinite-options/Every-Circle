import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { StyledTextField } from '../StyledComponents';

const HowCanYouHelp = ({ formData, handleChange, setFormData }) => {
    return (
        <Box sx={{ width: '100%' }}>
            {[0, 1, 2, 3].map((id) => {
                const nameTemp = `howCanYouHelp${id}`;

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

export default HowCanYouHelp;