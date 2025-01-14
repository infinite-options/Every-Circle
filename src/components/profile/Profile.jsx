import React, { useState, useEffect } from "react";
import { Box, Typography, styled, } from "@mui/material";
import { SocialLink } from "./SocialLink";
import { InputField } from "../common/InputField";
import { ImageUpload } from "../common/ImageUpload";
import { HelpItem } from "./HelpItem";
import StyledContainer from "../common/StyledContainer";
import Header from "../common/Header";
import facebook from "../../assets/facebook-icon.png";
import youtube from "../../assets/youtube-icon.png";
import linkedin from "../../assets/linkedin-icon.png";
import twitter from "../../assets/twitter-icon.png";
import CircleButton from "../common/CircleButton";
import NavigationBar from "../navigation/NavigationBar";
import axios from "axios";
import { useLocation } from "react-router-dom";

const FormBox = styled(Box)({
  padding: "0 16px",
});

export default function Profile() {
  const { userId } = useLocation().state;
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    tagLine: "",
    shortBio: "",
    images: [],
    facebookLink: "",
    twitterLink: "",
    linkedinLink: "",
    youtubeLink: "",
    template: "",
    weHelp: ["Item 1", "Item 2", "Item 1", "Item 2", "Item 1"],
    youHelp: ["", "", "", ""],
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(`https://ioec2testsspm.infiniteoptions.com/profile/${userId}`);
        console.log("Profile response", response);
        if (response.status === 200) {
          const user = response.data.result[0];
          setFormData(
            { ...formData, firstName: user.first_name || "", 
              lastName: user.last_name || "", 
              phoneNumber: user.phone_number || "", 
              tagLine: user.profile_tag_line || "", 
              shortBio: user.profile_short_bio || "", 
              images: user.profile_images || [],
              facebookLink: user.profile_facebook_link || "",
              twitterLink: user.profile_twitter_link || "",
              linkedinLink: user.profile_linkedin_link || ""  ,
              youtubeLink: user.profile_youtube_link || "",
              template: user.profile_template || "", 
              youHelp: user.profile_how_can_you_help ? user.profile_how_can_you_help : ["", "", "", ""], 
              weHelp: user.profile_how_can_we_help ? user.profile_how_can_we_help : ["", "", "", ""]
            });
        } else {
          console.log("Error fetching profile: ", response.status);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };
    fetchProfile();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(formData);
  };

  return (
    <StyledContainer>
      <Header title="Profile" />
      <Box sx={{ borderRadius: '10px', margin: "10px 25px" }}>
        <form onSubmit={handleSubmit}>
          <FormBox>
            <InputField
              label="First Name"
              value={formData.firstName}
              onChange={(value) => setFormData({ ...formData, firstName: value })}
            />
            <InputField
              label="Last Name"
              value={formData.lastName}
              onChange={(value) => setFormData({ ...formData, lastName: value })}
            />
            <InputField
              label="Phone Number"
              value={formData.phoneNumber}
              onChange={(value) =>
                setFormData({ ...formData, phoneNumber: value })
              }
            />
            <InputField
              label="Tag Line"
              optional
              value={formData.tagLine}
              onChange={(value) => setFormData({ ...formData, tagLine: value })}
            />
            <InputField
              label="Short Bio"
              optional
              multiline
              rows={4}
              value={formData.shortBio}
              onChange={(value) => setFormData({ ...formData, shortBio: value })}
            />

            <Box sx={{ display: "flex", gap: 2, my: 3, justifyContent: "space-between" }}>
              {[0, 1, 2].map((index) => (
                <ImageUpload
                  key={index}
                  index={index}
                  onUpload={(file) => {
                    const newImages = [...formData.images];
                    newImages[index] = file;
                    setFormData({ ...formData, images: newImages });
                  }}
                />
              ))}
            </Box>

            <SocialLink
              iconSrc={facebook}
              alt="Facebook"
              value={formData.facebookLink}
              onChange={(value) => setFormData({ ...formData, facebookLink: value })}
            />

            <SocialLink
              iconSrc={twitter}
              alt="Twitter"
              value={formData.twitterLink}
              onChange={(value) => setFormData({ ...formData, twitterLink: value })}
            />

            <SocialLink
              iconSrc={linkedin}
              alt="LinkedIn"
              value={formData.linkedinLink}
              onChange={(value) => setFormData({ ...formData, linkedinLink: value })}
            />

            <SocialLink
              iconSrc={youtube}
              alt="YouTube"
              value={formData.youtubeLink}
              onChange={(value) => setFormData({ ...formData, youtubeLink: value })}
            />

            <InputField
              label="Template"
              value={formData.template}
              onChange={(value) => setFormData({ ...formData, template: value })}
            />

            <Typography variant="subtitle2" sx={{ mt: 4, mb: 2 }}>
              How Can We Help You
            </Typography>
            {formData.weHelp.map((item, index) => (
              <HelpItem
                key={index}
                text={item}
                onChange={(value) => {
                  const newItems = [...formData.weHelp];
                  newItems[index] = value;
                  setFormData({ ...formData, weHelp: newItems });
                }}
              />
            ))}

            <Typography variant="subtitle2" sx={{ mt: 4, mb: 2 }}>
              How Can You Help Others
            </Typography>
            {formData.youHelp.map((item, index) => (
              <HelpItem
                key={index}
                text={item}
                onChange={(value) => {
                  const newItems = [...formData.youHelp];
                  newItems[index] = value;
                  setFormData({ ...formData, youHelp: newItems });
                }}
              />
            ))}

            <CircleButton onClick={handleSubmit} width={135} height={135} text="Save" />
          </FormBox>
        </form>
        <NavigationBar />
      </Box>

    </StyledContainer>
  );
};
