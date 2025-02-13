import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Avatar,
  Divider,
  Grid,
  Chip,
  Paper,
  Stack,
  IconButton,
  Button,
  Box,
} from "@mui/material";

import { 
  LocationOn, 
  Person, 
  PhoneAndroid, 
  Facebook,
  Instagram,
  YouTube,
  Add as AddIcon,
  Twitter,
  Message as MessageIcon,  
  X,
  Translate,
  Send,
  LinkedIn,
} from "@mui/icons-material";

import SendIcon from '@mui/icons-material/Send';
import CommentIcon from '@mui/icons-material/Comment';
import yelpIcon from "../assets/yelp-icon-small.png";
import GoogleIcon from "../assets/google-small-icon.webp";
import websiteIcon from "../assets/website-black-icon.png";
// import { makeStyles } from '@mui/core/styles';


import facebookIcon from "../assets/fb-icon.png";
import youtubeIcon from "../assets/yt-icon.png";
import linkedinIcon from "../assets/linkedin-icon.webp";
import twitterIcon from "../assets/x-icon.webp";


// Template 0: 
const DarkTemplate = ({ name, bio, location, avatarUrl, tagLine, phoneNumber, facebook, twitter, linkedin, youtube, website, yelp, google, role, imageList, rating }) => (
  <Card
    sx={{
      width: "250px",
      height: "400px",
      minHeight: "100%",
      maxHeight: "100%",
      background: "linear-gradient(135deg, #120F0E 0%, #263542 50%, #120F0E 100%)",
      borderRadius: 2,
      boxShadow: 3,
      border: "1px solid rgba(255, 255, 255, 0.1)",
      overflowY: "auto",
      flexGrow: 1, 
      "::-webkit-scrollbar": {
        width: "5px",
      },
      "::-webkit-scrollbar-track": {
        background: "rgba(255, 255, 255, 0.1)",
        borderRadius: "10px",
      },
      "::-webkit-scrollbar-thumb": {
        background: "rgba(255, 255, 255, 0.3)",
        backdropFilter: "blur(5px)",
        "&:hover": {
          background: "rgba(255, 255, 255, 0.6)", // Brighter on hover
        },
      },
    }}
  >
    <CardContent sx={{ pt: 3, px: 3, pb: 3 }}>
      {/* Name Section */}
      <Typography
        variant="h5"
        sx={{
          mb: 0.5,
          textAlign: "center",
          color: "#CAAC44",
          fontFamily: "'Playfair Display', serif",
          fontWeight: "bold",
          fontSize: "1.8rem",
          letterSpacing: "0.05em",
        }}
      >
        {name}
      </Typography>

      {/* Avatar Section */}
      <Box
        sx={{
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 5,
          mt: 1
        }}
      >
        {/* Left Avatar */}
        <Avatar
          // src={imageList?.[0]}
          src={typeof imageList?.[0] === "object" && imageList?.[0] !== null
            ? URL.createObjectURL(imageList[0].file)
            : (typeof imageList?.[0] === "string" ? imageList?.[0] : null)}
          sx={{
            width: 80,
            height: 80,
            border: 3,
            borderColor: "white",
            boxShadow: 3,
            zIndex: 1,
          }}
        >
          {!avatarUrl && <Person />} {/* Fallback icon if no avatar */}
        </Avatar>

        {/* Right Avatar */}
        <Avatar
          src={typeof imageList?.[1] === "object" && imageList?.[1] !== null
            ? URL.createObjectURL(imageList[1].file)
            : (typeof imageList?.[1] === "string" ? imageList?.[1] : null)}
          sx={{
            width: 80,
            height: 80,
            border: 3,
            borderColor: "white",
            boxShadow: 3,
            zIndex: 1,
          }}
        >
          {!avatarUrl && <Person />} {/* Fallback icon if no avatar */}
        </Avatar>

        {/* Center Avatar (Overlapping) */}
        <Avatar
          src={avatarUrl}
          sx={{
            width: 80,
            height: 80,
            border: 3,
            borderColor: "white",
            boxShadow: 3,
            position: "absolute",
            zIndex: 2,
          }}
        >
          {!avatarUrl && <Person />} {/* Fallback icon if no avatar */}
        </Avatar>
      </Box>

      {/* Tagline Section */}
      {tagLine && (
        <Typography
          sx={{
            mt: 2,
            fontSize: "0.9rem",
            maxHeight: "150px",
            overflow: "auto",
            color: "#CAAC44",
            fontFamily: "sans-serif",
            lineHeight: 1.5,
            textAlign: "center"
          }}
        >
          {tagLine}
        </Typography>
      )}

      {/* Bio Section */}
      <Box>
        <Typography
          sx={{
            mt: 2,
            fontSize: "0.9rem",
            color: "#FFFFFF",
            fontFamily: "sans-serif",
            lineHeight: 1.5,
            textAlign: "justify"
          }}
        >
          {bio}
        </Typography>
      </Box>
      <Box
        sx={{
          mt: 2,
          display: "block",
        }}
      >
        {rating && (
          <Box
          sx={{
            display: "flex",
            alignItems: "center",
            color: "text.secondary",
            mb: 2
          }}
        >
          <CommentIcon sx={{ mr: 1, fontSize: 18, color: "#CAAC44" }} />
          <Typography variant="body2" sx={{ color: "#FFFFFF" }}>
            {rating}
          </Typography>
        </Box>
        )}

        {/* Phone Number Section */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            color: "text.secondary",
            mb: 2
          }}
        >
          <PhoneAndroid sx={{ mr: 1, fontSize: 18, color: "#CAAC44" }} />
          <Typography variant="body2" sx={{ color: "#FFFFFF" }}>
            {phoneNumber}
          </Typography>
        </Box>

        {/* Location Section */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            color: "text.secondary",
          }}
        >
          <LocationOn sx={{ mr: 1, fontSize: 18, color: "#CAAC44" }} />
          <Typography variant="body2" sx={{ color: "#FFFFFF" }}>
            {location}
          </Typography>
        </Box>
      </Box>

      {role === "business" ? (
        <>
          {/* Links Section */}
          <Box
            sx={{
              mt: 3,
              display: "flex",
              justifyContent: "space-evenly",
              alignItems: "center",
              mb: 3,
            }}
          >
            {/* Website Icon */}
            <a href={website} target="_blank" rel="noopener noreferrer">
              <img
                src={websiteIcon}
                alt="Website"
                style={{ width: 25, height: 25, cursor: "pointer" }}
              />
            </a>


            {/* Yelp Icon */}
            <a href={yelp} target="_blank" rel="noopener noreferrer">
              <img
                src={yelpIcon}
                alt="Yelp"
                style={{ width: 25, height: 25, cursor: "pointer" }}
              />
            </a>

            {/* Google Icon */}
            <a href={google} target="_blank" rel="noopener noreferrer">
              <img
                src={GoogleIcon}
                alt="Google"
                style={{ width: 25, height: 25, cursor: "pointer" }}
              />
            </a>

          </Box>
        </>
      ) : (
        <>
          {/* Links Section */}
          <Box
            sx={{
              mt: 3,
              display: "flex",
              justifyContent: "space-evenly",
              alignItems: "center",
              mb: 3
            }}
          >
            {/* FB Icon */}
            <a href={facebook} target="_blank" rel="noopener noreferrer">
              <img
                src={facebookIcon}
                alt="Facebook"
                style={{ width: 30, height: 30, cursor: "pointer", borderRadius: "50%" }}
              />
            </a>


            {/* Twitter Icon */}
            <a href={twitter} target="_blank" rel="noopener noreferrer">
              <img
                src={twitterIcon}
                alt="Twitter"
                style={{ width: 30, height: 30, cursor: "pointer", borderRadius: "50%" }}
              />
            </a>

            {/* Linkedin Icon */}
            <a href={linkedin} target="_blank" rel="noopener noreferrer">
              <img
                src={linkedinIcon}
                alt="Linkedin"
                style={{ width: 30, height: 30, cursor: "pointer" }}
              />
            </a>

            {/* Linkedin Icon */}
            <a href={youtube} target="_blank" rel="noopener noreferrer">
              <img
                src={youtubeIcon}
                alt="YouTube"
                style={{ width: 30, height: 30, cursor: "pointer" }}
              />
            </a>

          </Box>
        </>
      )}
    </CardContent>
  </Card >
);

const DarkShowTemplate = ({ name, bio, location, avatarUrl, tagLine, phoneNumber, facebook, twitter, linkedin, youtube, website, yelp, google, role, imageList, rating }) => (
  <Card
    sx={{
      width: "100%",
      height: "100%",
      minHeight: "100%",
      maxHeight: "100%",
      background: "linear-gradient(135deg, #120F0E 0%, #263542 50%, #120F0E 100%)",
      borderRadius: 2,
      boxShadow: 3,
      border: "1px solid rgba(255, 255, 255, 0.1)",
      overflowY: "auto",
      flexGrow: 1, 
      "::-webkit-scrollbar": {
        width: "5px",
      },
      "::-webkit-scrollbar-track": {
        background: "rgba(255, 255, 255, 0.1)",
        borderRadius: "10px",
      },
      "::-webkit-scrollbar-thumb": {
        background: "rgba(255, 255, 255, 0.3)",
        backdropFilter: "blur(5px)",
        "&:hover": {
          background: "rgba(255, 255, 255, 0.6)", // Brighter on hover
        },
      },
    }}
  >
    <CardContent sx={{ pt: 3, px: 3, pb: 3 }}>
      {/* Name Section */}
      <Typography
        variant="h5"
        sx={{
          mb: 2,
          textAlign: "center",
          color: "#CAAC44",
          fontFamily: "'Playfair Display', serif",
          fontWeight: "bold",
          fontSize: "2rem",
          letterSpacing: "0.05em",
        }}
      >
        {name}
      </Typography>

      {/* Avatar Section */}
      <Box
        sx={{
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 5,
          mt: 5
        }}
      >
        {/* Left Avatar */}
        <Avatar
          // src={imageList?.[0]}
          src={typeof imageList?.[0] === "object" && imageList?.[0] !== null
            ? URL.createObjectURL(imageList[0].file)
            : (typeof imageList?.[0] === "string" ? imageList?.[0] : null)}
          sx={{
            width: 120,
            height: 120,
            border: 3,
            borderColor: "white",
            boxShadow: 3,
            zIndex: 1,
          }}
        >
          {!avatarUrl && <Person />} {/* Fallback icon if no avatar */}
        </Avatar>

        {/* Right Avatar */}
        <Avatar
          src={typeof imageList?.[1] === "object" && imageList?.[1] !== null
            ? URL.createObjectURL(imageList[1].file)
            : (typeof imageList?.[1] === "string" ? imageList?.[1] : null)}
          sx={{
            width: 120,
            height: 120,
            border: 3,
            borderColor: "white",
            boxShadow: 3,
            zIndex: 1,
          }}
        >
          {!avatarUrl && <Person />} {/* Fallback icon if no avatar */}
        </Avatar>

        {/* Center Avatar (Overlapping) */}
        <Avatar
          src={avatarUrl}
          sx={{
            width: 120,
            height: 120,
            border: 3,
            borderColor: "white",
            boxShadow: 3,
            position: "absolute",
            zIndex: 2,
          }}
        >
          {!avatarUrl && <Person />} {/* Fallback icon if no avatar */}
        </Avatar>
      </Box>

      {/* Tagline Section */}
      {tagLine && (
        <Typography
          sx={{
            mt: 4,
            fontSize: "1.5rem",
            maxHeight: "150px",
            overflow: "auto",
            color: "#CAAC44",
            fontFamily: "sans-serif",
            lineHeight: 1.5,
            textAlign: "center"
          }}
        >
          {tagLine}
        </Typography>
      )}

      {/* Bio Section */}
      <Box
        sx={{
          mt: role === "user" ? 3 : 5,
          display: "block",
        }}
      >
        <Box>
          <Typography
            sx={{
              mb: 2,
              fontSize: "1rem",
              color: "#FFFFFF",
              fontFamily: "sans-serif",
              lineHeight: 1.5,
              textAlign: "justify"
            }}
          >
            {bio}
          </Typography>
        </Box>

        {rating && (
          <Box
          sx={{
            display: "flex",
            alignItems: "center",
            color: "text.secondary",
            mb: 2
          }}
        >
          <CommentIcon sx={{ mr: 1, fontSize: 18, color: "#CAAC44" }} />
          <Typography variant="body2" sx={{ color: "#FFFFFF" }}>
            {rating}
          </Typography>
        </Box>
        )}

        {/* Phone Number Section */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            color: "text.secondary",
            mb: 2
          }}
        >
          <PhoneAndroid sx={{ mr: 1, fontSize: 25, color: "#CAAC44" }} />
          <Typography sx={{ color: "#FFFFFF", fontSize: "1rem" }}>
            {phoneNumber}
          </Typography>
        </Box>

        {/* Location Section */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            color: "text.secondary",
          }}
        >
          <LocationOn sx={{ mr: 1, fontSize: 25, color: "#CAAC44" }} />
          <Typography sx={{ color: "#FFFFFF", fontSize: "1rem"}}>
            {location}
          </Typography>
        </Box>
      </Box>

      {role === "business" ? (
        <>
          {/* Links Section */}
          <Box
            sx={{
              mt: 7,
              display: "flex",
              justifyContent: "space-evenly",
              alignItems: "center",
              mb: 3,
            }}
          >
            {/* Website Icon */}
            <a href={website} target="_blank" rel="noopener noreferrer">
              <img
                src={websiteIcon}
                alt="Website"
                style={{ width: 40, height: 40, cursor: "pointer" }}
              />
            </a>


            {/* Yelp Icon */}
            <a href={yelp} target="_blank" rel="noopener noreferrer">
              <img
                src={yelpIcon}
                alt="Yelp"
                style={{ width: 40, height: 40, cursor: "pointer" }}
              />
            </a>

            {/* Google Icon */}
            <a href={google} target="_blank" rel="noopener noreferrer">
              <img
                src={GoogleIcon}
                alt="Google"
                style={{ width: 40, height: 40, cursor: "pointer" }}
              />
            </a>

          </Box>
        </>
      ) : (
        <>
          {/* Links Section */}
          <Box
            sx={{
              mt: 7,
              display: "flex",
              justifyContent: "space-evenly",
              alignItems: "center",
              mb: 3
            }}
          >
            {/* FB Icon */}
            <a href={facebook} target="_blank" rel="noopener noreferrer">
              <img
                src={facebookIcon}
                alt="Facebook"
                style={{ width: 40, height: 40, cursor: "pointer", borderRadius: "50%" }}
              />
            </a>


            {/* Twitter Icon */}
            <a href={twitter} target="_blank" rel="noopener noreferrer">
              <img
                src={twitterIcon}
                alt="Twitter"
                style={{ width: 40, height: 40, cursor: "pointer", borderRadius: "50%" }}
              />
            </a>

            {/* Linkedin Icon */}
            <a href={linkedin} target="_blank" rel="noopener noreferrer">
              <img
                src={linkedinIcon}
                alt="Linkedin"
                style={{ width: 40, height: 40, cursor: "pointer" }}
              />
            </a>

            {/* Linkedin Icon */}
            <a href={youtube} target="_blank" rel="noopener noreferrer">
              <img
                src={youtubeIcon}
                alt="YouTube"
                style={{ width: 40, height: 40, cursor: "pointer" }}
              />
            </a>

          </Box>
        </>
      )}
    </CardContent>
  </Card >
);


// Template 1: Modern Card Layout
const ModernTemplate = ({ name, bio, location, avatarUrl, tagLine, phoneNumber, facebook, twitter, linkedin, youtube, website, yelp, google, role, imageList, rating }) => {
  return (
    <Box 
      sx={{
        width: '250px',
        height: '400px',
        borderRadius: '10px',
        overflow: 'hidden',
        position: 'relative',
        backgroundImage: `url('https://media.istockphoto.com/id/1342155703/photo/synth-wave-portrait-cyberpunk-man-neon-light-blue.jpg?s=612x612&w=0&k=20&c=aZV1dh8bUx2hmz6VF3UzE93LY5gc7X_UHlFEDkmk_fk=')`,
        backgroundSize: "cover",
      }}
    >

      {/* Main Content Area */}
      <Box 
        sx={{
          position: 'absolute',
          bottom: 15,
          left: 7,
          right: 7,
          bgcolor: 'white',
          borderRadius: '10px',
          p: 1,
        }}
      >
        {/* Profile Section */}
        <Box sx={{ display: 'flex', justifyContent: "space-between", alignItems: 'center', mb: 1 }}>
          <Avatar
            src="https://media.istockphoto.com/id/1342155703/photo/synth-wave-portrait-cyberpunk-man-neon-light-blue.jpg?s=612x612&w=0&k=20&c=aZV1dh8bUx2hmz6VF3UzE93LY5gc7X_UHlFEDkmk_fk="
            sx={{
              width: 45,
              height: 45,
              bgcolor: 'black'
            }}
          />
          
          <Box 
            sx={{
              // width: "50%",
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1
            }}
          >
            <Box 
              sx={{
                px: 1,
                mr: 1,
                py: 0.5,
                width: "60px",
                textAlign: "center",
                borderRadius: 20,
                border: "1px solid black",
                fontSize: "8px",
              }}
            >
              Message
            </Box>
            <Box sx={{
              bgcolor: '#EE214E',
              color: 'white',
              width : "60px",
              textAlign: "center",
              px: 1,
              py: 0.5,
              borderRadius: 20,
              fontSize: '8px'
            }}>
              Follow
            </Box>
          </Box>
        </Box>

        {/* Profile Info */}
        <Typography sx={{ fontWeight: 'bold', mb: 0.1, fontSize: "14px"}}>
          Design Profile
        </Typography>
        <Typography color="#DEDDDF" sx={{fontSize: "10px", mb: 0.5 }}>
          Designer
        </Typography>
        <Typography color="text.secondary" sx={{fontSize: "10px", mb: 2 }}>
          Creative designer focused on crafting beautiful digital experiences
        </Typography>

        {/* Stats */}
        <Box 
          sx={{
            width: "100%",
            position: "relative",
            bottom: 0,
            left: 0,
            right: 0,
            bgcolor: '#EE214E',
            borderRadius: "20px",
            display: 'flex',
            justifyContent: "space-evenly",
            // textAlign: 'center',
            mt: 1,
            p: 1,
          }}
        >
          {[Facebook, Instagram, Twitter, YouTube].map((Icon, index) => (
            <Icon key={index} sx={{ color: "white", fontSize: 12, }} />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

const ModernShowTemplate = ({ name, bio, location, avatarUrl, helpTags, needHelpTags, tagLine, phoneNumber, facebook, twitter, linkedin, youtube, website, yelp, google, role, imageList, rating }) => {
  return (
    <Box 
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundImage: `url('https://media.istockphoto.com/id/1342155703/photo/synth-wave-portrait-cyberpunk-man-neon-light-blue.jpg?s=612x612&w=0&k=20&c=aZV1dh8bUx2hmz6VF3UzE93LY5gc7X_UHlFEDkmk_fk=')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Main Content Area */}
      <Box 
        sx={{
          position: 'absolute',
          bottom: '2%',
          left: '2%',
          right: '2%',
          bgcolor: 'white',
          borderRadius: '1rem',
          p: { xs: 1.5, sm: 2 },
          maxHeight: '80%',
        }}
      >
        {/* Profile Section */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: "space-between", 
          alignItems: 'center', 
          mb: { xs: 1, sm: 1.5 } 
        }}>
          <Box sx={{display: "flex", flexDirection: "row", justifyContent: "space-between", width : "20%"}}>
            <Avatar
              src={avatarUrl || "https://media.istockphoto.com/id/1342155703/photo/synth-wave-portrait-cyberpunk-man-neon-light-blue.jpg?s=612x612&w=0&k=20&c=aZV1dh8bUx2hmz6VF3UzE93LY5gc7X_UHlFEDkmk_fk="}
              sx={{
                width: { xs: 48, sm: 56 },
                height: { xs: 48, sm: 56 },
                bgcolor: 'black'
              }}
            />
            <Avatar
              src={avatarUrl || "https://media.istockphoto.com/id/1342155703/photo/synth-wave-portrait-cyberpunk-man-neon-light-blue.jpg?s=612x612&w=0&k=20&c=aZV1dh8bUx2hmz6VF3UzE93LY5gc7X_UHlFEDkmk_fk="}
              sx={{
                width: { xs: 48, sm: 56 },
                height: { xs: 48, sm: 56 },
                bgcolor: 'black'
              }}
            />
          </Box>
          
          <Box 
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: { xs: 1, sm: 2 }
            }}
          >
            <Box 
              sx={{
                px: { xs: 1.5, sm: 2 },
                py: { xs: 0.75, sm: 1 },
                width: { xs: "70px", sm: "80px" },
                textAlign: "center",
                borderRadius: "2rem",
                border: "1px solid black",
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                cursor: "pointer",
                "&:hover": {
                  bgcolor: "rgba(0,0,0,0.05)"
                }
              }}
            >
              Message
            </Box>
            <Box sx={{
              bgcolor: '#EE214E',
              color: 'white',
              width: { xs: "70px", sm: "80px" },
              textAlign: "center",
              px: { xs: 1.5, sm: 2 },
              py: { xs: 0.75, sm: 1 },
              borderRadius: "2rem",
              fontSize: { xs: "0.75rem", sm: "0.875rem" },
              cursor: "pointer",
              "&:hover": {
                bgcolor: "#d91d46"
              }
            }}>
              Follow
            </Box>
          </Box>
        </Box>

        {/* Profile Info */}
        <Typography 
          sx={{ 
            fontWeight: 'bold', 
            mb: 0.5, 
            fontSize: { xs: "1rem", sm: "1.25rem" }
          }}
        >
          {name || "Design Profile"}
        </Typography>
        <Typography 
          color="#DEDDDF" 
          sx={{
            fontSize: { xs: "0.875rem", sm: "1rem" }, 
            mb: 0.5 
          }}
        >
          {tagLine || "Designer"}
        </Typography>
        <Typography 
          color="text.secondary" 
          sx={{
            fontSize: { xs: "0.875rem", sm: "1rem" }, 
            mb: { xs: 1.5, sm: 2 }
          }}
        >
          {bio || "Creative designer focused on crafting beautiful digital experiences"}
        </Typography>

        {/* Help Sections */}
        <Grid item sx={{mt: 3}}>
          <Typography sx={{fontSize: { xs: "0.875rem", sm: "1rem" }, color:"text.secondary", fontWeight: "bold"}}>
            How can I help you!!
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 2, mt: 0.8}}>
            {helpTags?.map((tag, index) => (
              tag && <Chip key={index} label={tag} size="small" sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" }, borderRadius: "7px", border: "1px solid #EE214E", backgroundColor: "transparent", color: "#EE214E"}} />
            ))}
          </Box>

          <Typography sx={{fontSize: { xs: "0.875rem", sm: "1rem" }, color:"text.secondary", fontWeight: "bold"}}>
            How can you help me!!
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.8}}>
            {needHelpTags?.map((tag, index) => (
              tag && <Chip key={index} label={tag} size="small" sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" }, borderRadius: "7px", border: "1px solid black", backgroundColor: "transparent", color: "black"}} />
            ))}
          </Box>
        </Grid>

        {/* Stats */}
        <Box 
          sx={{
            width: "100%",
            bgcolor: '#EE214E',
            borderRadius: "2rem",
            display: 'flex',
            justifyContent: "space-evenly",
            alignItems: "center",
            p: { xs: 1.5, sm: 2 },
            mt: 3
          }}
        >
          {[facebook, twitter, linkedin, youtube].map((link, index) => {
            // if (!link) return null; // Skip rendering if the link is null or undefined
            // console.log(link)
            
            const Icon = [Facebook, Twitter, LinkedIn, YouTube][index];

            return (
              <a 
                key={index} 
                href={link} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ textDecoration: "none" }}
              >
                <Icon 
                  sx={{ 
                    color: "white", 
                    fontSize: { xs: 18, sm: 20 },
                    cursor: "pointer",
                    mx: 1, // Adds spacing between icons
                    "&:hover": {
                      opacity: 0.8
                    }
                  }} 
                />
              </a>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

// Template 2: Minimalist Layout
const MinimalistTemplate = ({ name, bio, location, avatarUrl, tagLine, phoneNumber, facebook, twitter, linkedin, youtube, website, yelp, google, role, imageList, rating }) => {
  const helpTags = ["Web Dev","Marketing", "Design", "SEO"];
  const needHelpTags = ["Networking", "Mentorship", "Collab", "Investment"];

  return (
    <Box
      sx={{
        width: '250px',
        height: '400px',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        bgcolor: 'white',
      }}
    >
      {/* Background Image (Black Area) */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `url('https://i.redd.it/q8aw8rul6rr81.jpg')`,
          backgroundSize: "cover",
          clipPath: 'polygon(0 0, 100% 0, 100% 40%, 0 25%)',
          zIndex: 0,
        }}
      />

      {/* Centered Content (Avatar + Card) */}
      <Box
        sx={{
          position: 'absolute',
          top: '13%',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 2,
        }}
      >
        {/* Card Container */}
        <Box
          sx={{
            position: 'relative',
            width: 220,
            height: "100%",
            bgcolor: 'white',
            borderRadius: 2,
            boxShadow: '0px 4px 20px rgba(0,0,0,0.08)',
          }}
        >
          {/* Profile Avatar */}
          <Avatar
            src= "https://images.rawpixel.com/image_800/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA4L2pvYjEwMzktZWxlbWVudC0yNi0zOTNfMS5qcGc.jpg"
            sx={{
              position: 'absolute',
              top: "-27%",
              left: "50%",
              transform: 'translateX(-50%)',
              width: 50,
              height: 50,
              bgcolor: '#e0e0e0',
              boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
            }}
          />

          <Box sx={{ textAlign: "center", mt: 2, p: 1 }}>
            <Typography sx={{ fontSize: "14px", fontWeight: "bold"}}>
              Dianna Leen
            </Typography>
            <Typography sx={{fontSize: "10px", fontWeight: "100"}} color="text.secondary">
              Lorem ipsum dolor sit amet consectetur adipisicing elit.
            </Typography>
            <Box sx={{display: "flex", flexDirection: "row", justifyContent: "space-around", mt: "15px"}}>
              <Button variant= "contained" sx={{width: "60%", height: "20px", fontSize: "10px", bgcolor: "#16629a", color: "white", boxShadow: "none", borderRadius: 2 }}>
                Follow
              </Button>
              <IconButton sx={{bgcolor: "#C7ddea", width: "30%", height: "25px", borderRadius: 2}}>
                <SendIcon sx={{color: "#3d83b0", fontSize: "14px"}}></SendIcon>
              </IconButton>
            </Box>
          </Box>

        </Box>

        {/* Social Media Links & Help Sections */}
        <Grid container sx={{mt: 2, width: "100%"}}>
          {/* Social Media Section */}
          <Grid item xs={2} sx={{ bgcolor: "#AE323E", p: 1, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "space-evenly", alignItems: "center"}}>
            {[Facebook, Instagram, Twitter, YouTube].map((Icon, index) => (
              <Icon key={index} sx={{ color: "white", fontSize: 16, mb: 0.5 }} />
            ))}
          </Grid>

          {/* Help Sections */}
          <Grid item xs={10} sx={{ p: 1 }}>
            <Typography sx={{fontSize: "12px", fontWeight: "bold"}}>
              How can I help you!!
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1.2, mt: 0.6}}>
              {helpTags.map((tag, index) => (
                <Chip key={index} label={tag} size="small" sx={{ fontSize: "8px", borderRadius: "7px", border: "1px solid #16629a", backgroundColor: "transparent", color: "#16629a"}} />
              ))}
            </Box>

            <Typography sx={{fontSize: "12px", fontWeight: "bold"}}>
              How can you help me!!
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.6}}>
              {needHelpTags.map((tag, index) => (
                <Chip key={index} label={tag} size="small" sx={{ fontSize: "8px", borderRadius: "7px", backgroundColor: "#C7ddea", color: "#16629a"}} />
              ))}
            </Box>
          </Grid>
        </Grid>

      </Box>
    </Box>
  );
};

const MinimalistShowTemplate = ({ name, bio, location, avatarUrl, helpTags, needHelpTags, tagLine, phoneNumber, facebook, twitter, linkedin, youtube, website, yelp, google, role, imageList, rating }) => {

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        bgcolor: 'white',
        flex: 1,
      }}
    >
      {/* Background Image (Black Area) */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `url('https://i.redd.it/q8aw8rul6rr81.jpg')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 35%)',
          zIndex: 0,
        }}
      />

      {/* Centered Content (Avatar + Card) */}
      <Box
        sx={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 2,
          width: '90%',
        }}
      >
        {/* Card Container */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            bgcolor: 'white',
            borderRadius: 2,
            boxShadow: '0px 4px 20px rgba(0,0,0,0.08)',
            minHeight: '150px',
          }}
        >
          {/* Profile Avatar */}
          <Avatar
            src={avatarUrl || "https://images.rawpixel.com/image_800/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA4L2pvYjEwMzktZWxlbWVudC0yNi0zOTNfMS5qcGc.jpg"}
            sx={{
              position: 'absolute',
              top: "-27%",
              left: "50%",
              transform: 'translateX(-50%)',
              width: { xs: 50, sm: 80 },
              height: { xs: 50, sm: 80 },
              bgcolor: '#e0e0e0',
              boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
            }}
          />

          <Box sx={{ textAlign: "center", mt: 4, p: 2 }}>
            <Typography sx={{ fontSize: { xs: "1rem", sm: "1.25rem" }, fontWeight: "bold"}}>
              {name || "Dianna Leen"}
            </Typography>
            <Typography sx={{fontSize: { xs: "0.75rem", sm: "0.875rem" }, fontWeight: "100"}} color="text.secondary">
              {bio || "Lorem ipsum dolor sit amet consectetur adipisicing elit."}
            </Typography>
            <Box sx={{
              display: "flex", 
              flexDirection: "row", 
              justifyContent: "space-around", 
              mt: 2,
              px: 2
            }}>
              <Button 
                variant="contained" 
                sx={{
                  width: "60%",
                  height: { xs: "30px", sm: "36px" },
                  fontSize: { xs: "0.75rem", sm: "0.875rem" },
                  bgcolor: "#16629a",
                  color: "white",
                  boxShadow: "none",
                  borderRadius: 2,
                  '&:hover': {
                    bgcolor: "#12517f"
                  }
                }}
              >
                Follow
              </Button>
              <IconButton 
                sx={{
                  bgcolor: "#C7ddea",
                  width: "30%",
                  height: { xs: "30px", sm: "36px" },
                  borderRadius: 2,
                  '&:hover': {
                    bgcolor: "#b6ccd9"
                  }
                }}
              >
                <SendIcon sx={{color: "#3d83b0", fontSize: { xs: "14px", sm: "18px" }}} />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* Social Media Links & Help Sections */}
        <Grid container sx={{mt: 4, width: "100%"}}>
          {/* Social Media Section */}
          <Grid item xs={4} sx={{ 
            bgcolor: "#AE323E", 
            p: { xs: 1, sm: 1.5 }, 
            textAlign: "center", 
            display: "flex", 
            flexDirection: "column", 
            justifyContent: "space-evenly", 
            alignItems: "center"
          }}>
            {[facebook, twitter, linkedin, youtube].map((link, index) => {
              // if (!link) return null; // Skip rendering if the link is null or undefined
              // console.log(link)
              
              const Icon = [Facebook, Twitter, LinkedIn, YouTube][index];

              return (
                <a 
                  key={index} 
                  href={link} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ textDecoration: "none" }}
                >
                  <Icon 
                    sx={{ 
                      color: "white", 
                      fontSize: { xs: 18, sm: 30 },
                      cursor: "pointer",
                      my: 2.5, // Adds spacing between icons
                      "&:hover": {
                        opacity: 0.8
                      }
                    }} 
                  />
                </a>
              );
            })}
          </Grid>

          {/* Help Sections */}
          <Grid item xs={8} sx={{ p: { xs: 1, sm: 1.5 }}}>
            <Typography sx={{fontSize: { xs: "0.875rem", sm: "1.1rem" }, fontWeight: "bold"}}>
              How can I help you!!
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.2, mb:5, mt: 0.8}}>
              {helpTags.map((tag, index) => (
                tag && <Chip 
                  key={index} 
                  label={tag} 
                  size="medium" 
                  sx={{ 
                    fontSize: { xs: "0.625rem", sm: "0.9rem" }, 
                    borderRadius: "7px", 
                    border: "1px solid #16629a", 
                    backgroundColor: "transparent", 
                    color: "#16629a"
                  }} 
                />
              ))}
            </Box>

            <Typography sx={{fontSize: { xs: "0.875rem", sm: "1.1rem" }, fontWeight: "bold"}}>
              How can you help me!!
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.2, mt: 0.8}}>
              {needHelpTags.map((tag, index) => (
                tag && <Chip 
                  key={index} 
                  label={tag} 
                  size="medium" 
                  sx={{ 
                    fontSize: { xs: "0.625rem", sm: "0.9rem" }, 
                    borderRadius: "7px", 
                    backgroundColor: "#C7ddea", 
                    color: "#16629a"
                  }} 
                />
              ))}
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

// Template 3: Split Layout with Gradient
const SplitTemplate = ({ name, bio, location, avatarUrl, tagLine, phoneNumber, facebook, twitter, linkedin, youtube, website, yelp, google, role, imageList, rating }) => {
  const helpTags = ["Web Dev","Marketing", "SEO", "Design"];
  const needHelpTags = ["Networking", "Mentorship", "Investment", "Collab"];

  return (
    <Box 
      sx={{
        width: 250,
        height: 400,
        position: 'relative',
        bgcolor: "white",
        borderRadius: "10px"
      }}
    >
      {/* background image header  */}
      <Box sx={{
        width: '100%',
        height: '45%',
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        borderRadius: "10px",
        borderBottomLeftRadius: "0px",
        borderBottomRightRadius: "30px"
      }}>
        {/* Background Layer */}
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url('https://static.vecteezy.com/system/resources/thumbnails/026/945/935/small/business-man-on-black-background-free-photo.jpg')`,
          backgroundSize: 'cover',
          // bgcolor: '#000000',
        }}/>

        {/* Content Wrapper */}
        <Box 
          sx={{
            position: 'relative',
            height: '100%',
            zIndex: 1,
            color: 'white',
          }}
        >
          {/* Header with Logo and Button */}
          <Box 
            sx={{
              position: "absolute",
              top: 1,
              right: 1,
              display: 'flex',
              justifyContent: 'space-between',
              flexDirection: 'column',
              alignItems: 'center',
              p: 2
            }}
          >
            {/* Action Button */}
            <Box 
              sx={{
                width: "100%",
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                px: 2,
                textAlign: "center",
                py: 0.5,
                mb: 1,
                borderRadius: '5px',
                fontSize: '8px',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.2)'
                }
              }}
            >
              Follow
            </Box>
            <Box 
              sx={{
                width: "100%",
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                px: 2,
                py: 0.5,
                mb: 1,
                borderRadius: '5px',
                fontSize: '8px',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.2)'
                }
              }}
            >
              Message
            </Box>
          </Box>

          {/* Bottom Content */}
          <Box 
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              p: 3,
            }}
          >
            <Typography sx={{
              fontSize: '16px',
              fontWeight: 700,
              mb: 1,
              lineHeight: 0.5
            }}>
              Test
            </Typography>

            <Typography sx={{
              fontSize: '16px',
              fontWeight: 700,
              mb: 1,
              lineHeight: 1
            }}>
              Williamson
            </Typography>

            <Typography sx={{
              fontSize: '10px',
              color: 'rgba(255, 255, 255, 0.7)',
              lineHeight: 1.4
            }}>
              Actor, comedian, musician and writer
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* card content */}
      <Grid item xs={10} sx={{ p: 1, position: "relative" }}>
        <Typography sx={{ fontSize: "10px", fontWeight: "bold", mb: 0.6 }}>
          About
        </Typography>
        <Typography sx={{ fontSize: "10px", fontWeight: "100", mb: 1 }} color="text.secondary">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum conitue with random ways.
        </Typography>

        <Typography sx={{ fontSize: "10px", fontWeight: "bold" }}>
          How can I help you!!
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1, mt: 0.6 }}>
          {helpTags.map((tag, index) => (
            <Chip key={index} label={tag} size="small" sx={{ fontSize: "8px", borderRadius: "7px", border: "1px solid #333", color: "#333", backgroundColor: "transparent" }} />
          ))}
        </Box>

        <Typography sx={{ fontSize: "10px", fontWeight: "bold" }}>
          How can you help me!!
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.6 }}>
          {needHelpTags.map((tag, index) => (
            <Chip key={index} label={tag} size="small" sx={{ fontSize: "8px", borderRadius: "7px", border: "1px solid #333", color: "#333", backgroundColor: "transparent"}} />
          ))}
        </Box>

        {/* Social media - Centered */}
        <Box
          sx={{
            bgcolor: 'black',
            borderRadius: "20px",
            position: "relative", // Changed from absolute
            width: "80%",
            p: 1,
            display: "flex",
            justifyContent: "space-evenly",
            alignItems: "center",
            mx: "auto", // Centers the box horizontally
            mt: 2, // Adds spacing from content above
          }}
        >
          {[Facebook, Instagram, Twitter, YouTube].map((Icon, index) => (
            <Icon key={index} sx={{ color: "white", fontSize: 12, }} />
          ))}
        </Box>
      </Grid>
    </Box>
  );
};

const SplitShowTemplate = ({ name, bio, location, avatarUrl, helpTags, needHelpTags, tagLine, phoneNumber, facebook, twitter, linkedin, youtube, website, yelp, google, role, imageList, rating }) => {

  return (
    <Box 
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        bgcolor: "white",
        borderRadius: "10px",
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Background Image Header */}
      <Box sx={{
        width: '100%',
        height: '45vh',  // Ensure it takes up space in layout
        position: 'relative', // Changed from absolute
        overflow: 'hidden',
        borderRadius: "10px",
        borderBottomLeftRadius: "0px",
        borderBottomRightRadius: "30px",
        flexShrink: 0 // Prevent shrinking
      }}>
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url(${avatarUrl || 'https://static.vecteezy.com/system/resources/thumbnails/026/945/935/small/business-man-on-black-background-free-photo.jpg'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}/>
        <Box 
          sx={{
            position: 'relative',
            height: '100%',
            zIndex: 1,
            color: 'white',
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: { xs: 8, sm: 12 },
              left: { xs: 8, sm: 12 },
              display: 'flex',
              justifyContent: 'space-between',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Avatar
              src={avatarUrl || "https://images.rawpixel.com/image_800/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA4L2pvYjEwMzktZWxlbWVudC0yNi0zOTNfMS5qcGc.jpg"}
              sx={{
                width: { xs: 50, sm: 60 },
                height: { xs: 50, sm: 60 },
                mb: 1.5,
                bgcolor: '#e0e0e0',
                border: "1px solid white",
                boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
              }}
            />

            <Avatar
              src={avatarUrl || "https://static.vecteezy.com/system/resources/thumbnails/026/945/935/small/business-man-on-black-background-free-photo.jpg"}
              sx={{
                width: { xs: 50, sm: 60 },
                height: { xs: 50, sm: 60 },
                bgcolor: '#e0e0e0',
                border: "1px solid white",
                boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
              }}
            />
          </Box>
          <Box 
            sx={{
              position: "absolute",
              top: { xs: 8, sm: 12 },
              right: { xs: 8, sm: 12 },
              display: 'flex',
              justifyContent: 'space-between',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Box 
              sx={{
                width: { xs: 80, sm: 100 },
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                px: { xs: 2, sm: 3 },
                textAlign: "center",
                py: { xs: 0.75, sm: 1 },
                mb: 1,
                borderRadius: '5px',
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.2)'
                }
              }}
            >
              Follow
            </Box>
            <Box 
              sx={{
                width: { xs: 80, sm: 100 },
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                px: { xs: 2, sm: 3 },
                py: { xs: 0.75, sm: 1 },
                mb: 1,
                borderRadius: '5px',
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.2)'
                }
              }}
            >
              Message
            </Box>
          </Box>
          <Box 
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              p: { xs: 2, sm: 3 },
            }}
          >
            <Typography sx={{ fontSize: { xs: '1.25rem', sm: '2.5rem' }, fontWeight: 700, mb: 1, lineHeight: 0.5 }}>
              {name?.split(' ')[0] || 'Test'}
            </Typography>
            <Typography sx={{ fontSize: { xs: '1.25rem', sm: '2.5rem' }, fontWeight: 100, mb: 1, lineHeight: 1, }}>
              {name?.split(' ')[1] || 'Williamson'}
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.4 }}>
              {tagLine || 'Actor, comedian, musician and writer'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Card Content */}
      <Grid item xs={10} sx={{ p: { xs: 2, sm: 3 }, flex: 1, marginTop: '-10px' }}>
        <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, fontWeight: "bold", mb: 1 }}>
          About
        </Typography>
        <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, fontWeight: "100", mb: 2 }} color="text.secondary">
          {bio || 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum conitue with random ways.'}
        </Typography>

        <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, fontWeight: "bold", mb: 1 }}>
          How can I help you!!
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.2, mb: 2 }}>
          {helpTags.map((tag, index) => (
            tag && <Chip 
              key={index} 
              label={tag} 
              size="medium" 
              sx={{ fontSize: { xs: '0.75rem', sm: '0.9rem' }, borderRadius: "7px", border: "1px solid #333", color: "#333", backgroundColor: "transparent" }} 
            />
          ))}
        </Box>

        <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, fontWeight: "bold", mb: 1 }}>
          How can you help me!!
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.2, mb: 2 }}>
          {needHelpTags.map((tag, index) => (
            tag && <Chip 
              key={index} 
              label={tag} 
              size="medium" 
              sx={{ fontSize: { xs: '0.75rem', sm: '0.9rem' }, borderRadius: "7px", border: "1px solid #333", color: "#333", backgroundColor: "transparent" }} 
            />
          ))}
        </Box>

        {/* Social media */}
        <Box
          sx={{
            bgcolor: 'black',
            borderRadius: "20px",
            width: "80%",
            p: { xs: 1.5, sm: 2 },
            display: "flex",
            justifyContent: "space-evenly",
            alignItems: "center",
            mx: "auto",
            mt: 5,
          }}
        >
          {[facebook, twitter, linkedin, youtube].map((link, index) => {
            const Icon = [Facebook, Twitter, LinkedIn, YouTube][index];
            return (
              <a key={index} href={link} target="_blank" rel="noopener noreferrer">
                <Icon sx={{ color: "white", fontSize: { xs: 16, sm: 21 }, cursor: 'pointer', '&:hover': { opacity: 0.8 }}} />
              </a>
            );
          })}
        </Box>
      </Grid>
    </Box>
  );
};

// Template 4: Creative Layout with Cards
const CreativeTemplate = ({ name, bio, location, avatarUrl, tagLine, phoneNumber, facebook, twitter, linkedin, youtube, website, yelp, google, role, imageList, rating }) => (
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
        @{name}
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

export { DarkTemplate, ModernTemplate, MinimalistTemplate, SplitTemplate, CreativeTemplate, SplitShowTemplate, DarkShowTemplate, ModernShowTemplate, MinimalistShowTemplate };
