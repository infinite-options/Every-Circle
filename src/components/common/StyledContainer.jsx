import React from "react";
import { Container, styled, Box } from "@mui/material";

const StyledContainerComponent = styled(Box) (({theme}) => ({
    width: '700px',
    minHeight: '100vh',
    backgroundColor: "#f5f5f5",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    display: "flex",
    flexDirection: "column",
    margin: '0 auto',
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
  }));

export default function StyledContainer(props) {
  return <StyledContainerComponent {...props} />;
}
