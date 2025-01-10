import React from "react";
import { Container, styled } from "@mui/material";

const StyledContainerComponent = styled(Container)({
    width: '500px',
    minHeight: '100vh',
    backgroundColor: "#f5f5f5",
    overflow: "hidden",
    padding: 0,
    alignItems: "center",
    justifyContent: "center",
    display: "flex",
    flexDirection: "column",
  });

export default function StyledContainer(props) {
  return <StyledContainerComponent {...props} />;
}
