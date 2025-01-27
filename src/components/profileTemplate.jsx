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
import { LocationOn, Person, PhoneAndroid } from "@mui/icons-material";

// Template 1: Modern Card Layout
const ModernTemplate = ({ name, username, bio, location, avatarUrl, tagLine, phoneNumber }) => (
  <Card sx={{ width: "450px", height: "450px" }}>
    <Box sx={{ position: "relative" }}>
      <Box
        sx={{
          height: 100,
          background: "linear-gradient(to right, #1976d2, #9c27b0)",
        }}
      />
      <Avatar
        src={avatarUrl}
        sx={{
          width: 80,
          height: 80,
          border: 3,
          borderColor: "white",
          position: "absolute",
          bottom: -40,
          left: 32,
        }}
      >
        {!avatarUrl && <Person />}
      </Avatar>
    </Box>
    <CardContent sx={{ pt: 6, px: 3, pb: 3 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
        {name}
      </Typography>
      <Typography color="text.secondary" variant="body2">
        @{username}
      </Typography>
      {tagLine &&
        <Typography
          sx={{ mt: 2, fontSize: "0.9rem", maxHeight: "150px", overflow: "auto" }}
        >
          {tagLine}
        </Typography>
      }
      <Box sx={{ maxHeight: "100px", overflow: "auto" }}>
        <Typography
          sx={{ mt: 2, fontSize: "0.9rem" }}
        >
          {bio}
        </Typography>
      </Box>
      <Box
        sx={{
          mt: 2,
          display: "flex",
          alignItems: "center",
          color: "text.secondary",
        }}
      >
        <PhoneAndroid sx={{ mr: 1, fontSize: 18 }} />
        <Typography variant="body2">{phoneNumber}</Typography>
      </Box>
      <Box
        sx={{
          mt: 2,
          display: "flex",
          alignItems: "center",
          color: "text.secondary",
        }}
      >
        <LocationOn sx={{ mr: 1, fontSize: 18 }} />
        <Typography variant="body2">{location}</Typography>
      </Box>
    </CardContent>
  </Card>
);

// Template 2: Minimalist Layout
const MinimalistTemplate = ({ name, username, bio, location, avatarUrl, tagLine, phoneNumber }) => (
  <Box
    sx={{
      width: "450px",
      height: "450px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      bgcolor: "#fff",
      borderRadius: "8px",
      p: 3,
    }}
  >
    <Avatar src={avatarUrl} sx={{ width: 80, height: 80, mb: 2 }}>
      {!avatarUrl && <Person />}
    </Avatar>
    <Typography color="text.secondary" variant="h6" sx={{ mb: 1 }}>
      {name}
    </Typography>
    <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
      @{username}
    </Typography>
    <Divider sx={{ width: 48, mb: 2 }} />
    {tagLine &&
      <Typography color="text.secondary" variant="body2"
        sx={{ fontSize: "0.9rem", mb: 1 }}
      >
        {tagLine}
      </Typography>
    }
    <Box sx={{ maxHeight: "150px", overflow: "auto" }}>
      <Typography color="text.secondary" variant="body2"
        sx={{
          textAlign: "center",
          mb: 2,
          fontSize: "0.9rem",
        }}
      >
        {bio}
      </Typography>
    </Box>
    <Box
      sx={{
        mt: 2,
        display: "flex",
        alignItems: "center",
        color: "text.secondary",
      }}
    >
      <PhoneAndroid sx={{ mr: 1, fontSize: 18 }} />
      <Typography variant="body2">{phoneNumber}</Typography>
    </Box>
    <Box
      sx={{
        mb: 1,
        display: "flex",
        alignItems: "center",
        color: "text.secondary",
      }}
    >
      <LocationOn sx={{ mr: 1, fontSize: 18, mb: 2 }} />
      <Typography variant="body2">{location}</Typography>
    </Box>
  </Box>
);

// Template 3: Split Layout with Gradient
const SplitTemplate = ({ name, username, bio, location, avatarUrl, tagLine, phoneNumber }) => (
  <Box
    sx={{
      width: "450px",
      height: "450px",
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
        }}
      >
        <Box
          sx={{
            p: 3,
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
              width: 90,
              height: 90,
              border: "3px solid #333",
              boxShadow: "0 0 20px rgba(0,0,0,0.3)",
              mb: 2,
            }}
          >
            {!avatarUrl && <Person sx={{ fontSize: 40 }} />}
          </Avatar>
          <Typography variant="h6" sx={{ color: "#fff", mb: 0.5 }}>
            {name}
          </Typography>
          <Typography sx={{ color: "#00C7BE", mb: 1, fontSize: "0.9rem" }}>
            @{username}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", color: "#888" }}>
            <PhoneAndroid sx={{ mr: 1, fontSize: 16 }} />
            <Typography variant="body2">{phoneNumber}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", color: "#888" }}>
            <LocationOn sx={{ mr: 1, fontSize: 16 }} />
            <Typography variant="body2">{location}</Typography>
          </Box>
        </Box>

        <Box
          sx={{
            p: 3,
            bgcolor: "rgba(255,255,255,0.03)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: "#fff",
              mb: 2,
              pb: 1,
              borderBottom: "2px solid #00C7BE",
            }}
          >
            About Me
          </Typography>
          <Typography sx={{ color: "#00C7BE", mb: 1, fontSize: "0.85rem", }}>
            {tagLine}
          </Typography>
          <Typography
            sx={{
              color: "#ccc",
              lineHeight: 1.6,
              fontSize: "0.85rem",
              maxHeight: "200px",
              overflow: "auto",
            }}
          >
            {bio}
          </Typography>
        </Box>
      </Box>
    </Paper>
  </Box>
);

// Template 4: Creative Layout with Cards
const CreativeTemplate = ({ name, username, bio, location, avatarUrl, tagLine, phoneNumber }) => (
  <Paper
    sx={{
      width: "450px",
      height: "450px",
      background: "linear-gradient(45deg, #000851, #1CB5E0)",
      borderRadius: "8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      p: 3,
      radius: "8px"
    }}
  >
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        p: 3,
        mt: 2
      }}
    >
      <Box
        sx={{
          position: "relative",
          mb: 3,
          "&::before": {
            content: '""',
            position: "absolute",
            top: -15,
            left: -15,
            right: -15,
            bottom: -15,
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
            width: 80,
            height: 80,
            border: "3px solid rgba(255,255,255,0.3)",
            position: "relative",
          }}
        >
          {!avatarUrl && <Person />}
        </Avatar>
      </Box>

      <Typography
        variant="h5"
        sx={{ color: "#fff", textAlign: "center", mb: 1 }}
      >
        {name}
      </Typography>
      <Typography sx={{ color: "#00C7BE", mb: 1, fontSize: "0.9rem" }}>
        @{username}
      </Typography>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          color: "rgba(255,255,255,0.7)",
          mb: 1,
        }}
      >
        <PhoneAndroid sx={{ mr: 1, fontSize: 16 }} />
        <Typography variant="body2">{phoneNumber}</Typography>
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          color: "rgba(255,255,255,0.7)",
          mb: 1,
        }}
      >
        <LocationOn sx={{ mr: 1, fontSize: 16 }} />
        <Typography variant="body2">{location}</Typography>
      </Box>

      {tagLine && <Typography sx={{ color: "#00C7BE", mb: 1, fontSize: "0.9rem" }}>
        {tagLine}
      </Typography>}

      <Paper
        sx={{
          p: 2,
          bgcolor: "rgba(0,0,0,0.2)",
          borderRadius: 2,
          maxWidth: "300px",
          width: "100%",
        }}
      >
        <Typography
          sx={{
            color: "#fff",
            lineHeight: 1.6,
            textAlign: "center",
            fontStyle: "italic",
            fontSize: "0.85rem",
            maxHeight: "50px",
            overflow: "auto",
            mb: 1,
          }}
        >
          {bio}
        </Typography>
      </Paper>
    </Box>
  </Paper>
);

export { ModernTemplate, MinimalistTemplate, SplitTemplate, CreativeTemplate };
