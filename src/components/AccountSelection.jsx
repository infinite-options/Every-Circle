import { Box, Typography, Button } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";

const Banner = () => {
  return (
    <Box
      sx={{
        width: "105%",
        height: "80px",
        backgroundColor: "#007AFF",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: "0 0 50% 50%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Typography variant='h6' sx={{ color: "white", fontWeight: "bold" }}>
        Choose Your Account
      </Typography>
    </Box>
  );
};

const AccountSelection = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSelection = (accountType) => {
    if (accountType === "personal") {
      navigate("/profile");
    } else {
      const userId = location.state?.userId;
      navigate("/businessProfileSetup", { state: { userId } });
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        bgcolor: "white",
        padding: "20px",
        paddingTop: "100px",
        position: "relative",
      }}
    >
      {/* Blue Arch */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "120px",
          backgroundColor: "#007AFF",
          borderBottomLeftRadius: "50%",
          borderBottomRightRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography sx={{ color: "white", fontSize: "18px", fontWeight: "bold" }}>Choose Your Account</Typography>
      </Box>

      {/* Buttons */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "15px",
          alignItems: "center",
          width: "100%",
          maxWidth: "300px",
        }}
      >
        <Button
          onClick={() => handleSelection("personal")}
          sx={{
            width: "100%",
            maxWidth: "200px",
            aspectRatio: "1",
            borderRadius: "50%",
            backgroundColor: "#FF9500",
            color: "white",
            fontSize: "24px",
            fontWeight: "bold",
            textTransform: "none",
            "&:hover": {
              backgroundColor: "#e68600",
            },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "flex-end",
            marginTop: "-400px",
          }}
        >
          Personal
        </Button>

        <Button
          onClick={() => handleSelection("business")}
          sx={{
            width: "100%",
            maxWidth: "200px",
            aspectRatio: "1",
            borderRadius: "50%",
            backgroundColor: "#4CAF50",
            color: "white",
            fontSize: "24px",
            fontWeight: "bold",
            textTransform: "none",
            "&:hover": {
              backgroundColor: "#388E3C",
            },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "flex-start",
            marginTop: "20px",
          }}
        >
          Business
        </Button>
      </Box>
    </Box>
  );
};

export default AccountSelection;
