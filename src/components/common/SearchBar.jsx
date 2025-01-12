import React from "react";
import { Box, TextField, InputAdornment, IconButton } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';

export default function SearchBar() {
    return (
        <Box sx={{ width: "100%" }}>
            <TextField
                fullWidth
                label="Search..."
                slotProps={{
                    input: {
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton>
                                    <SearchIcon />
                                </IconButton>
                            </InputAdornment>
                        )
                    }
                }}
            />
        </Box>
    );
}
