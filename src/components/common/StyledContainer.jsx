import React from "react";
import { Container, styled, Box } from "@mui/material";

const StyledContainerComponent = styled(Box)({
    width: '500px',
    minHeight: '100vh',
    backgroundColor: "#f5f5f5",
    overflow: "hidden",
    padding: 0,
    alignItems: "center",
    justifyContent: "center",
    display: "flex",
    flexDirection: "column",
    margin: '0 auto',
  });

export default function StyledContainer(props) {
  return <StyledContainerComponent {...props} />;
}
