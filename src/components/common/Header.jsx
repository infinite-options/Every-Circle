import React from "react";
import { Box, Typography, styled } from "@mui/material";

const HeaderBox = styled(Box)({
    position: 'relative',
    width: '100%',
    height: '10vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    overflow: 'hidden',
    margin: '0 auto', 
    '&:before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        width: '100%',
        background:
            'linear-gradient(to right, #AF52DE, #BF58F3)',
        borderRadius: '0 0 50% 50%/0 0 100% 100%',
        transform: 'scaleX(1.1)',
        zIndex: 0,
    },
});


export default function Header({ title }) {
    return (
        <HeaderBox>
            <Typography variant="h5" color="white" sx={{
                zIndex: 1,
                color: 'white',
            }}>
                {title}
            </Typography>
        </HeaderBox>
    );
}