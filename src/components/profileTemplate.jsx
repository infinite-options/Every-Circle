import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Avatar,
  Divider,
  Paper,
  Box,
} from "@mui/material";
import { LocationOn, Person } from "@mui/icons-material";

// Template 1: Modern Card Layout
const ModernTemplate = ({ name, username, bio, location, avatarUrl }) => (
  <Card sx={{ height: "400px" }}>
    <Box sx={{ position: "relative" }}>
      <Box
        sx={{
          height: 128,
          background: "linear-gradient(to right, #1976d2, #9c27b0)",
        }}
      />
      <Avatar
        src={avatarUrl}
        sx={{
          width: 96,
          height: 96,
          border: 4,
          borderColor: "white",
          position: "absolute",
          bottom: -48,
          left: 32,
        }}
      >
        {!avatarUrl && <Person />}
      </Avatar>
    </Box>
    <CardContent sx={{ pt: 8, px: 4, pb: 4 }}>
      <Typography variant="h4" fontWeight="bold">
        {name}
      </Typography>
      <Typography color="text.secondary">@{username}</Typography>
      <Typography sx={{ mt: 2 }}>{bio}</Typography>
      <Box
        sx={{
          mt: 2,
          display: "flex",
          alignItems: "center",
          color: "text.secondary",
        }}
      >
        <LocationOn sx={{ mr: 1, fontSize: 20 }} />
        <Typography>{location}</Typography>
      </Box>
    </CardContent>
  </Card>
);

// Template 2: Minimalist Layout
const MinimalistTemplate = ({ name, username, bio, location, avatarUrl }) => (
  <Box
    sx={{
      height: "400px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      bgcolor: "#fff",
      borderRadius: "8px",
    }}
  >
    <Avatar
      src={avatarUrl}
      sx={{
        width: 128,
        height: 128,
        mb: 3,
      }}
    >
      {!avatarUrl && <Person />}
    </Avatar>
    <Typography variant="h3" fontWeight="light" sx={{ mb: 1 }}>
      {name}
    </Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>
      @{username}
    </Typography>
    <Divider sx={{ width: 64, mb: 3 }} />
    <Typography
      sx={{
        maxWidth: "400px",
        textAlign: "center",
        mb: 3,
      }}
    >
      {bio}
    </Typography>
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "text.secondary",
      }}
    >
      <LocationOn sx={{ mr: 1 }} />
      <Typography>{location}</Typography>
    </Box>
  </Box>
);

// Template 3: Split Layout with Gradient
const SplitTemplate = ({ name, username, bio, location, avatarUrl }) => (
  <Box
    sx={{
      height: "400px",
      bgcolor: "#1a1a1a",
      borderRadius: "8px",
      overflow: "hidden",
    }}
  >
    <Paper
      sx={{
        height: "100%",
        background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
        boxShadow: "none",
      }}
    >
      <Box
        sx={{
          height: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            p: 4,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            "&::after": {
              content: '""',
              position: "absolute",
              top: "10%",
              right: 0,
              width: "1px",
              height: "80%",
              background:
                "linear-gradient(to bottom, transparent, #444, transparent)",
            },
          }}
        >
          <Avatar
            src={avatarUrl}
            sx={{
              width: 140,
              height: 140,
              border: "4px solid #333",
              boxShadow: "0 0 20px rgba(0,0,0,0.3)",
              mb: 3,
            }}
          >
            {!avatarUrl && <Person sx={{ fontSize: 60 }} />}
          </Avatar>
          <Typography variant="h4" sx={{ color: "#fff", mb: 1 }}>
            {name}
          </Typography>
          <Typography sx={{ color: "#00C7BE", mb: 2 }}>@{username}</Typography>
          <Box sx={{ display: "flex", alignItems: "center", color: "#888" }}>
            <LocationOn sx={{ mr: 1 }} />
            <Typography>{location}</Typography>
          </Box>
        </Box>

        <Box
          sx={{
            p: 4,
            bgcolor: "rgba(255,255,255,0.03)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Typography
            variant="h5"
            sx={{
              color: "#fff",
              mb: 3,
              pb: 2,
              borderBottom: "2px solid #00C7BE",
            }}
          >
            About Me
          </Typography>
          <Typography sx={{ color: "#ccc", lineHeight: 1.8 }}>{bio}</Typography>
        </Box>
      </Box>
    </Paper>
  </Box>
);

// Template 4: Creative Layout with Cards
const CreativeTemplate = ({ name, username, bio, location, avatarUrl }) => (
  <Box
    sx={{
      height: "400px",
      background: "linear-gradient(45deg, #000851, #1CB5E0)",
      borderRadius: "8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      p: 2,
    }}
  >
    <Paper
      sx={{
        width: "100%",
        height: "100%",
        borderRadius: 4,
        overflow: "hidden",
        bgcolor: "rgba(255,255,255,0.1)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          p: 2,
        }}
      >
        <Box
          sx={{
            position: "relative",
            mb: 2,
            "&::before": {
              content: '""',
              position: "absolute",
              top: -10,
              left: -10,
              right: -10,
              bottom: -10,
              background: "linear-gradient(45deg, #00C7BE, #1CB5E0)",
              borderRadius: "50%",
              opacity: 0.3,
              animation: "pulse 2s infinite",
            },
          }}
        >
          <Avatar
            src={avatarUrl}
            sx={{
              width: 100,
              height: 100,
              border: "4px solid rgba(255,255,255,0.3)",
              position: "relative",
            }}
          >
            {!avatarUrl && <Person />}
          </Avatar>
        </Box>

        <Typography
          variant="h4"
          sx={{ color: "#fff", textAlign: "center", mb: 1 }}
        >
          {name}
        </Typography>
        <Typography sx={{ color: "#00C7BE", mb: 2, fontSize: "1rem" }}>
          @{username}
        </Typography>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            color: "rgba(255,255,255,0.7)",
            mb: 2,
          }}
        >
          <LocationOn sx={{ mr: 1 }} />
          <Typography>{location}</Typography>
        </Box>

        <Paper
          sx={{
            p: 2,
            bgcolor: "rgba(0,0,0,0.2)",
            borderRadius: 2,
            maxWidth: "400px",
            width: "100%",
            maxHeight: "100px",
            overflow: "auto",
          }}
        >
          <Typography
            sx={{
              color: "#fff",
              lineHeight: 1.6,
              textAlign: "center",
              fontStyle: "italic",
              fontSize: "0.9rem",
            }}
          >
            {bio}
          </Typography>
        </Paper>
      </Box>
    </Paper>
  </Box>
);

export { ModernTemplate, MinimalistTemplate, SplitTemplate, CreativeTemplate };
