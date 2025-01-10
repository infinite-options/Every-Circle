import React, { useState } from "react";
import { Box, Typography, Container, styled } from "@mui/material";
import { SocialLink } from "./SocialLink";
import { InputField } from "../common/InputField";
import { ImageUpload } from "../common/ImageUpload";
import { HelpItem } from "./HelpItem";
import StyledContainer from "../common/StyledContainer";
import Header from "../common/Header";
import facebook from "../../assets/facebook-icon.png";
import instagram from "../../assets/youtube-icon.png";
import linkedin from "../../assets/linkedin-icon.png";
import twitter from "../../assets/twitter-icon.png";
import CircleButton from "../common/CircleButton";
import NavigationBar from "../navigation/NavigationBar";


// const StyledContainer = styled(Container)({
//   width: '500px',
//   backgroundColor: "#f5f5f5",
//   overflow: "hidden",
//   padding: 0,
// });

const FormBox = styled(Box)({
  padding: "0 16px",
});

export default function Profile () {
  const [formData, setFormData] = useState({
    firstName: "Orbit",
    lastName: "Ellison",
    phoneNumber: "408-000-0000",
    tagLine: "",
    shortBio: "",
    images: [],
    socialLinks: ["", "", "", ""],
    template: "Template 1A",
    helpNeeded: ["Item 1", "Item 2", "Item 1", "Item 2", "Item 1"],
    helpOffered: ["Item 1", "Item 2", "Item 1", "Item 2", "Item 1"],
  });

  const socialLinks = [
    { iconSrc: facebook, alt: "Social media icon 1" },
    { iconSrc: instagram, alt: "Social media icon 2" },
    { iconSrc: linkedin, alt: "Social media icon 3" },
    { iconSrc: twitter, alt: "Social media icon 4" },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(formData);
  };

  return (
    <StyledContainer>
      <form onSubmit={handleSubmit}>
        <Header title="Profile" />
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

          {socialLinks.map((link, index) => (
            <SocialLink
              key={index}
              {...link}
              value={formData.socialLinks[index]}
              onChange={(value) => {
                const newLinks = [...formData.socialLinks];
                newLinks[index] = value;
                setFormData({ ...formData, socialLinks: newLinks });
              }}
            />
          ))}

          <InputField
            label="Template"
            value={formData.template}
            onChange={(value) => setFormData({ ...formData, template: value })}
          />

          <Typography variant="subtitle2" sx={{ mt: 4, mb: 2 }}>
            How Can We Help You
          </Typography>
          {formData.helpNeeded.map((item, index) => (
            <HelpItem
              key={index}
              text={item}
              onChange={(value) => {
                const newItems = [...formData.helpNeeded];
                newItems[index] = value;
                setFormData({ ...formData, helpNeeded: newItems });
              }}
            />
          ))}

          <Typography variant="subtitle2" sx={{ mt: 4, mb: 2 }}>
            How Can You Help Others
          </Typography>
          {formData.helpOffered.map((item, index) => (
            <HelpItem
              key={index}
              text={item}
              onChange={(value) => {
                const newItems = [...formData.helpOffered];
                newItems[index] = value;
                setFormData({ ...formData, helpOffered: newItems });
              }}
            />
          ))}

          {/* <SaveButton type="submit" variant="contained">
            Save
          </SaveButton> */}
          <CircleButton onClick={handleSubmit} width={135} height={135} text="Save" />
        </FormBox>

        <NavigationBar />
      </form>
    </StyledContainer>
  );
};
