import { Box, Typography, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

const AccountSelection = () => {
  const navigate = useNavigate();

  const handleSelection = (accountType) => {
    if (accountType === "personal") {
      navigate("/profile"); // Leads to personal profile setup
    } else {
      navigate("/businessProfileSetup"); // ✅ Should lead to the three-step business profile flow
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
        padding: "20px",
        paddingTop: "40px",
      }}
    >
      <Typography
        variant="h6"
        sx={{
          color: "#007AFF",
          marginBottom: "20px",
          textAlign: "center",
          fontWeight: "bold",
        }}
      >
        Choose Your Account
      </Typography>

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
          }}
        >
          Business
        </Button>
      </Box>
    </Box>
  );
};

export default AccountSelection;
