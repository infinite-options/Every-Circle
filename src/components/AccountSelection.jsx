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
      <Typography
        variant="h6"
        sx={{ color: "white", fontWeight: "bold" }}
      >
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
        justifyContent: "flex-start",
        minHeight: "100vh",
        bgcolor: "white",
        paddingTop: "0px",
      }}
    >
      {/* Add the Banner at the top */}
      <Banner />

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "15px",
          alignItems: "center",
          width: "100%",
          maxWidth: "300px",
          marginTop: "40px",
        }}
      >
        <Button
          onClick={() => handleSelection("personal")}
          sx={{
            width: "100%",
            maxWidth: "327px",
            aspectRatio: "1",
            borderRadius: "50%",
            backgroundColor: "#FF9500",
            color: "white",
            fontSize: "24px",
            fontWeight: "bold",
            textTransform: "none",
            "&:hover": { backgroundColor: "#e68600" },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: "260px",
          }}
        >
          Personal
        </Button>

        <Button
          onClick={() => handleSelection("business")}
          sx={{
            width: "100%",
            maxWidth: "327px",
            aspectRatio: "1",
            borderRadius: "50%",
            backgroundColor: "#4CAF50",
            color: "white",
            fontSize: "24px",
            fontWeight: "bold",
            textTransform: "none",
            "&:hover": { backgroundColor: "#388E3C" },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: "260px",
            marginTop: "-90px"
          }}
        >
          Business
        </Button>
      </Box>
    </Box>
  );
};

export default AccountSelection;
