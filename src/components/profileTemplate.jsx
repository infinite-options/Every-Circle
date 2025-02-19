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


// Template 0: Dark
const DarkTemplate = ({ name, bio, location, avatarUrl, tagLine, phoneNumber, facebook, twitter, linkedin, youtube, website, yelp, google, role, imageList, rating }) => (
  <Card sx={{ width: 250, height: 400, backgroundColor: "#1a1a1a", color: "white", position: "relative", textAlign: "center", borderRadius: "15px", overflow: "hidden" }}>
    <Box sx={{ position: "absolute", width: "100%", height: "100%", backgroundImage: "url('https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fHJlc3RhdXJhbnR8ZW58MHx8MHx8fDA%3D')", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.15 }} />
    <CardContent>
      <Typography sx={{ fontFamily: "serif", fontWeight: "bold", mb: 1, fontSize: "1rem"}}>Liceria & Co.</Typography>
      
      {/* images */}
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", mt: 2 }}>
        <Box sx={{ width: 60, height: 60, borderRadius: "50%", overflow: "hidden", border: "1px solid white", position: "absolute", left: 42, zIndex: 1}}>
          <img src="https://images.pexels.com/photos/1581384/pexels-photo-1581384.jpeg?cs=srgb&dl=pexels-reneterp-1581384.jpg&fm=jpg" alt="Spring Rolls" width="100%" height="100%" />
        </Box>
        <Box sx={{ width: 90, height: 90, borderRadius: "50%", overflow: "hidden", border: "2px solid white", zIndex: 2 }}>
          <img src="https://images.pexels.com/photos/3434523/pexels-photo-3434523.jpeg?cs=srgb&dl=pexels-bemistermister-3434523.jpg&fm=jpg" alt="Main Dish" width="100%" height="100%" />
        </Box>
        <Box sx={{ width: 60, height: 60, borderRadius: "50%", overflow: "hidden", border: "1px solid white",  position: "absolute", right: 42, zIndex: 1 }}>
          <img src="https://images.pexels.com/photos/995743/pexels-photo-995743.jpeg?cs=srgb&dl=pexels-michelle-riach-276396-995743.jpg&fm=jpg" alt="Noodles" width="100%" height="100%" />
        </Box>
      </Box>

      <Typography sx={{ fontFamily: "cursive", mt: 2, color: "gold", fontSize: "1rem" }}>Chinese Restaurant</Typography>
      <Typography variant="h6" sx={{ fontWeight: "bold", color: "white" }}>FOOD MENU</Typography>
      <Typography sx={{ px: 2, mt: 1, fontSize: "0.87rem" }}>Treat yourself to our exquisite cuisine, where every dish tells a story!</Typography>
      
      <Box sx={{display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "Center", mt: 2}}>
        <a href={yelp} target="_blank" rel="noopener noreferrer" style={{marginRight: 20}}>
          <img
            src={yelpIcon}
            alt="Yelp"
            style={{ width: 20, height: 20, cursor: "pointer" }}
          />
        </a>

        {/* Google Icon */}
        <a href={google} target="_blank" rel="noopener noreferrer">
          <img
            src={GoogleIcon}
            alt="Google"
            style={{ width: 20, height: 20, cursor: "pointer" }}
          />
        </a>
      </Box>

      <Box sx={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "space-evenly", alignItems: "center", flexDirection: "row", gap: 1 }}>
        <Box sx={{display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "row"}}>
          <PhoneAndroid fontSize="9px" sx={{ opacity: 0.6 }} /> 
          <Typography fontSize="10px" sx={{opacity: 0.6}}>123-456-7890</Typography>  
        </Box>
        <Box sx={{display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "row"}}>
          <LocationOn fontSize="9px" sx={{ opacity: 0.6 }} /> 
          <Typography fontSize="10px" sx={{ opacity: 0.6 }}>123 Anywhere St, Any City</Typography>
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const DarkShowTemplate = ({ name, bio, location, avatarUrl, tagLine, phoneNumber, facebook, twitter, linkedin, youtube, website, yelp, google, role, imageList, rating }) => (
  <Card sx={{ 
    width: '100%', 
    height: '97vh', 
    backgroundColor: "#1a1a1a", 
    color: "white", 
    position: "relative", 
    textAlign: "center", 
    borderRadius: "0px", 
    overflow: "hidden", 
    display: "flex", 
    flexDirection: "column", 
    justifyContent: "center", 
    alignItems: "center"
  }}>
    
    <Box sx={{ 
      position: "absolute", 
      width: "100%", 
      height: "100%", 
      backgroundImage: "url('https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fHJlc3RhdXJhbnR8ZW58MHx8MHx8fDA%3D')", 
      backgroundSize: "cover", 
      backgroundPosition: "center", 
      opacity: 0.15 
    }} />
    
    <CardContent sx={{ zIndex: 2, textAlign: "center", maxWidth: "80%" }}>
      <Typography sx={{ fontFamily: "serif", fontWeight: "bold", mb: 2, fontSize: "3rem" }}>{name || "Liceria & Co."}</Typography>
      
      {/* Images */}
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", mt: 7}}>
        <Box sx={{ width: 210, height: 210, borderRadius: "50%", overflow: "hidden", border: "2px solid white", position: "absolute", left: "17%", zIndex: 1 }}>
          <img src= {imageList[0] ? imageList[0] : "https://images.pexels.com/photos/1581384/pexels-photo-1581384.jpeg?cs=srgb&dl=pexels-reneterp-1581384.jpg&fm=jpg"} alt="Spring Rolls" width="100%" height="100%" style={{ objectFit: "cover" }}/>
        </Box>
        <Box sx={{ width: 260, height: 260, borderRadius: "50%", overflow: "hidden", border: "3px solid white", zIndex: 2 }}>
          <img src= { imageList[1] ? imageList[1] : "https://images.pexels.com/photos/3434523/pexels-photo-3434523.jpeg?cs=srgb&dl=pexels-bemistermister-3434523.jpg&fm=jpg"} alt="Main Dish" width="100%" height="100%" style={{ objectFit: "cover" }} />
        </Box>
        <Box sx={{ width: 210, height: 210, borderRadius: "50%", overflow: "hidden", border: "2px solid white", position: "absolute", right: "17%", zIndex: 1 }}>
          <img src={imageList[2] ? imageList[2] : "https://images.pexels.com/photos/995743/pexels-photo-995743.jpeg?cs=srgb&dl=pexels-michelle-riach-276396-995743.jpg&fm=jpg"} alt="Noodles" width="100%" height="100%" style={{ objectFit: "cover" }}/>
        </Box>
      </Box>
      
      <Typography sx={{ fontFamily: "cursive", mt: 3.5, color: "gold", fontSize: "2rem" }}>{tagLine || ""}</Typography>
      {/* <Typography variant="h6" sx={{ fontWeight: "bold", color: "white", mt: 1 }}>FOOD MEN</Typography> */}
      <Typography sx={{ px: 3, mt: 1, fontSize: "1rem", opacity: "0.7" }}>{bio || ""}</Typography>
      
      <Box sx={{ display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "Center", mt: 3, gap: 4 }}>
        <a href={yelp} target="_blank" rel="noopener noreferrer">
          <img src={yelpIcon} alt="Yelp" style={{ width: 40, height: 40, cursor: "pointer" }} />
        </a>
        <a href={google} target="_blank" rel="noopener noreferrer">
          <img src={GoogleIcon} alt="Google" style={{ width: 40, height: 40, cursor: "pointer" }} />
        </a>
      </Box>
      
      <Box sx={{ 
        position: "absolute", 
        bottom: 15, 
        left: 0, 
        right: 0, 
        display: "flex", 
        justifyContent: "space-evenly", 
        alignItems: "center", 
        flexDirection: "row", 
        gap: 3,
        px: 3
      }}>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "row" }}>
          <PhoneAndroid fontSize="small" sx={{ opacity: 0.6 }} /> 
          <Typography fontSize="1rem" sx={{ opacity: 0.6, ml: 1 }}>{phoneNumber || "123-456-7890"}</Typography>  
        </Box>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "row" }}>
          <LocationOn fontSize="small" sx={{ opacity: 0.6 }} /> 
          <Typography fontSize="1rem" sx={{ opacity: 0.6, ml: 1 }}>{location !== ", , " ? location : "Address"}</Typography>
        </Box>
      </Box>
    </CardContent>
  </Card>
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
        backgroundImage: `url(${imageList[0] ? imageList[0] : 'https://media.istockphoto.com/id/1342155703/photo/synth-wave-portrait-cyberpunk-man-neon-light-blue.jpg?s=612x612&w=0&k=20&c=aZV1dh8bUx2hmz6VF3UzE93LY5gc7X_UHlFEDkmk_fk='})`,
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
              src={imageList[2] || "https://media.istockphoto.com/id/1342155703/photo/synth-wave-portrait-cyberpunk-man-neon-light-blue.jpg?s=612x612&w=0&k=20&c=aZV1dh8bUx2hmz6VF3UzE93LY5gc7X_UHlFEDkmk_fk="}
              sx={{
                width: { xs: 48, sm: 56 },
                height: { xs: 48, sm: 56 },
                bgcolor: 'black'
              }}
            />
            <Avatar
              src={imageList[1] || "https://media.istockphoto.com/id/1342155703/photo/synth-wave-portrait-cyberpunk-man-neon-light-blue.jpg?s=612x612&w=0&k=20&c=aZV1dh8bUx2hmz6VF3UzE93LY5gc7X_UHlFEDkmk_fk="}
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
          backgroundImage: `url(${imageList[0] ? imageList[0] : 'https://i.redd.it/q8aw8rul6rr81.jpg'})`,
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
              border: "1px solid black",
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
          backgroundImage: `url(${imageList[0] || 'https://static.vecteezy.com/system/resources/thumbnails/026/945/935/small/business-man-on-black-background-free-photo.jpg'})`,
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
              src={imageList[1] || "https://static.vecteezy.com/system/resources/thumbnails/026/945/935/small/business-man-on-black-background-free-photo.jpg"}
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
          {helpTags?.map((tag, index) => (
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
          {needHelpTags?.map((tag, index) => (
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
  <Box sx={{
    position: 'relative',
    width: '250px',
    height: '400px',
    backgroundColor: '#fff',
    overflow: 'hidden'
  }}>
    {/* Top yellow circle */}
    <Box sx={{
      position: 'absolute',
      width: '144px',
      height: '144px',
      backgroundColor: '#fdd835',
      borderRadius: '50%',
      top: -32,
      left: -32
    }}>
      <Box sx={{ position: 'absolute', top: 45, left: 40, width: "50px"}}>
        <Typography sx={{ fontWeight: 'bold', mt: 0.5, fontSize: "1.2rem", textAlign: "center",}}>
          Air Kitchen
        </Typography>
      </Box>
    </Box>

    {/* Middle right yellow circle */}
    <Box 
      sx={{
        position: 'absolute',
        width: '144px',
        height: '144px',
        backgroundColor: '#fdd835',
        border: "7px solid black",
        borderRadius: '50%',
        top: '18%',
        right: -38,
        backgroundImage: `url('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRTdVokvqSsvBSn7vkPA_v9dFUUgyaR-9abWg&s')`,
        backgroundSize: "cover"
      }} 
    />

    {/* Content section */}
    <Box sx={{ position: 'absolute', top: '32%', left: 18, width: "150px" }}>
      <Typography sx={{ mb: 1.5, fontFamily: "cursive", fontSize: "1rem", color: "black"}}>
        Best American Cuisine
      </Typography>
      <Box sx={{display: "flex", flexDirection: "row", justifyContent: "start", alignItems: "Center", mt: 1.5}}>
        <a href={yelp} target="_blank" rel="noopener noreferrer" style={{marginRight: 20}}>
          <img
            src={yelpIcon}
            alt="Yelp"
            style={{ width: 20, height: 20, cursor: "pointer" }}
          />
        </a>

        {/* Google Icon */}
        <a href={google} target="_blank" rel="noopener noreferrer">
          <img
            src={GoogleIcon}
            alt="Google"
            style={{ width: 20, height: 20, cursor: "pointer" }}
          />
        </a>
      </Box>
    </Box>

    {/* First black circle */}
    <Box sx={{
      position: 'absolute',
      width: '400px',
      height: '400px',
      backgroundColor: '#000',
      border: "7px solid #fdd835",
      borderRadius: '50%',
      top: '57%',
      left: -64
    }}>
      <Box sx={{width: "250px", position: 'absolute', top: 34, left: 96, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-evenly"}}>
        <Box sx={{width: "110px"}}>
          <Typography sx={{fontSize: "1rem", fontWeight: "bold", color: '#C1C122' }}>
            About Us
          </Typography>
          <Typography sx={{fontSize: "0.5rem", color: 'white', opacity: 0.6}}>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Nulla obcaecati illum at officia
          </Typography>
        </Box>
        <Box sx={{
          width: '64px',
          height: '64px',
          backgroundColor: '#e0e0e0',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mt: 1,
          ml: 1,
          mr: 6,
          border: "1px solid white",
          backgroundImage: `url('https://media.istockphoto.com/id/1162911786/photo/the-team-of-cooks-backs-in-the-work-in-the-modern-kitchen-the-workflow-of-the-restaurant-in.jpg?s=612x612&w=0&k=20&c=Nn1xO1gbUGnEzTHp4Sitg_ouob_co3jY5hDv_kHWzxE=')`,
          backgroundSize: "cover",
        }}/>
      </Box>
    </Box>

    <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, bgcolor: "#fdd835", position: "absolute", bottom: 0, left: 0, right: 0, height: "30px", justifyContent: "space-evenly", alignItems: "center"}}>
      <Typography variant="caption" sx={{ color: '#fff' }}>
        Phone Number
      </Typography>
      <Typography variant="caption" sx={{ color: '#fff' }}>
        Address
      </Typography>
    </Box>
  </Box>
);

const CreativeShowTemplate = ({ name, bio, location, avatarUrl, tagLine, phoneNumber, facebook, twitter, linkedin, youtube, website, yelp, google, role, imageList, rating }) => (
  <Box sx={{
    position: 'relative',
    width: '100%',
    height: '97vh',  // Full height of viewport
    maxHeight: '100vh',  // Ensures minimum height
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  }}>
    {/* Top yellow circle */}
    <Box sx={{
      position: 'absolute',
      width: '35%',
      height: '35%',
      backgroundColor: '#fdd835',
      borderRadius: '50%',
      top: '-10%',
      left: '-10%'
    }}>
      <Box sx={{ 
        position: 'absolute', 
        top: '47%', 
        left: '40%', 
        width: "40%" 
      }}>
        <Typography sx={{ 
          fontWeight: 'bold', 
          mt: '2%', 
          fontSize: "1.6rem", 
          textAlign: "center",
        }}>
          {name || ""}
        </Typography>
      </Box>
    </Box>

    {/* Middle right yellow circle */}
    <Box sx={{
      position: 'absolute',
      width: '500px',
      height: '500px',
      backgroundColor: '#fdd835',
      border: "7px solid black",
      borderRadius: '50%',
      top: '-3%',
      right: '-30%',
      backgroundImage: `url(${imageList[0] ? imageList[0] : 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRTdVokvqSsvBSn7vkPA_v9dFUUgyaR-9abWg&s'})`,
      backgroundSize: "cover"
    }} />

    {/* Content section */}
    <Box sx={{ 
      position: 'absolute', 
      top: '31%', 
      left: '7%', 
      width: "60%" 
    }}>
      <Typography sx={{ 
        mb: '4%', 
        fontFamily: "cursive", 
        fontSize: "2rem",
        opacity: 0.6 
      }}>
        {tagLine || ""}
      </Typography>
      <Box sx={{
        display: "flex", 
        flexDirection: "row", 
        justifyContent: "start", 
        alignItems: "center", 
        mt: '4%'
      }}>
        <a href={yelp} target="_blank" rel="noopener noreferrer" style={{marginRight: '8%'}}>
          <img
            src={yelpIcon}
            alt="Yelp"
            style={{ 
              width: '35px', 
              height: '35px', 
              cursor: "pointer" 
            }}
          />
        </a>
        <a href={google} target="_blank" rel="noopener noreferrer">
          <img
            src={GoogleIcon}
            alt="Google"
            style={{ 
              width: '35px', 
              height: '35px', 
              cursor: "pointer" 
            }}
          />
        </a>
      </Box>
    </Box>

    {/* First black circle */}
    <Box sx={{
      position: 'absolute',
      width: '140%',
      height: '120%',
      backgroundColor: '#000',
      border: "7px solid #fdd835",
      borderRadius: '50%',
      top: '57%',
      left: '-20%'
    }}>
      <Box sx={{
        width: "700px", 
        position: 'absolute', 
        top: '8%', 
        left: '15%', 
        display: "flex", 
        flexDirection: "row", 
        alignItems: "center", 
        justifyContent: "space-evenly"
      }}>
        <Box sx={{width: "35%"}}>
          <Typography sx={{
            fontSize: "1.2rem", 
            fontWeight: "bold", 
            color: '#C1C122'
          }}>
            About Us
          </Typography>
          <Typography sx={{
            fontSize: "1rem", 
            color: 'white', 
            opacity: 0.6
          }}>
            {bio || "Lorem ipsum dolor sit amet consectetur adipisicing elit. Nulla obcaecati illum at officia"}
          </Typography>
        </Box>
        <Box sx={{
          width: '120px',
          height: "120px",
          aspectRatio: '1',
          backgroundColor: '#e0e0e0',
          borderRadius: '8%',
          mt: '2%',
          mr: 6,
          border: "1px solid white",
          backgroundImage: `url(${imageList[1] ? imageList[1] : 'https://media.istockphoto.com/id/1162911786/photo/the-team-of-cooks-backs-in-the-work-in-the-modern-kitchen-the-workflow-of-the-restaurant-in.jpg?s=612x612&w=0&k=20&c=Nn1xO1gbUGnEzTHp4Sitg_ouob_co3jY5hDv_kHWzxE='})`,
          backgroundSize: "cover",
        }}/>
      </Box>
    </Box>

    {/* Footer */}
    <Box sx={{ 
      display: 'flex', 
      gap: '5%', 
      bgcolor: "#fdd835", 
      position: "absolute", 
      bottom: 0, 
      left: 0, 
      right: 0, 
      height: "8%", 
      color: "white",
      justifyContent: "space-evenly", 
      alignItems: "center"
    }}>
      <Box sx={{display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "row"}}>
        <PhoneAndroid fontSize="0.875rem"/> 
        <Typography fontSize="0.875rem" sx={{ml:1}}>{phoneNumber || "Phone Number"}</Typography>  
      </Box>
      <Box sx={{display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "row"}}>
        <LocationOn fontSize="0.875rem"/> 
        <Typography fontSize="0.875rem" sx={{ml:1}}>{location !== ", , " ? location : "Address"}</Typography>
      </Box>
    </Box>
  </Box>
);

export { DarkTemplate, ModernTemplate, MinimalistTemplate, SplitTemplate, CreativeTemplate, SplitShowTemplate, DarkShowTemplate, ModernShowTemplate, MinimalistShowTemplate, CreativeShowTemplate };
