import React from "react";
import { Box, TextField, InputAdornment, IconButton } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';

export default function SearchBar({setSearchString, handleSearch}) {
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };
    return (
        <Box sx={{ width: "100%" }}>
            <TextField
                fullWidth
                label="Search..."
                slotProps={{
                    input: {
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton onClick={handleSearch}>
                                    <SearchIcon />
                                </IconButton>
                            </InputAdornment>
                        )
                    }
                }}
                onChange={(e)=>setSearchString(e.target.value)}
                onKeyDown={handleKeyDown}
            />
        </Box>
    );
}
