import React from 'react'
import { Button, styled } from '@mui/material'


const StyledButton = styled(Button)(({ width, height })=>({
    width: width,
    height: height,
    borderRadius: "50%",
    backgroundColor: "#FF9500",
    color: "#fff",
    margin: "14px auto",
    display: "block",
    "&:hover": {
      backgroundColor: "#ffb300",
    },
    textTransform: "none",
  }));

export default function CircleButton({ onClick , width, height, text}) {
  return (
   <StyledButton onClick={onClick} width={width} height={height}>{text}</StyledButton>
  )
}
