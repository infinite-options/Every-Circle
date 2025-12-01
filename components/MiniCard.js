import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useDarkMode } from "../contexts/DarkModeContext";
import { sanitizeText, isSafeForConditional } from "../utils/textSanitizer";

const MiniCard = ({ user, business, showRelationship = false }) => {
  const { darkMode } = useDarkMode();

  if (__DEV__) {
    console.log("🔵 MiniCard - RENDER START", { hasUser: !!user, hasBusiness: !!business });
  }

  // --------------------------
  // HANDLE BUSINESS CARD
  // --------------------------
  if (business) {
    if (__DEV__) console.log("🔵 MiniCard - Rendering BUSINESS card");
    if (__DEV__) {
      console.log("🔍 MiniCard - Business data received:", {
        business_name: business.business_name,
        business_address_line_1: business.business_address_line_1,
        business_zip_code: business.business_zip_code,
        business_phone_number: business.business_phone_number,
        business_website: business.business_website,
      });
    }

    const businessName = sanitizeText(business.business_name);
    const location = sanitizeText(business.business_address_line_1);
    const zipCode = sanitizeText(business.business_zip_code);
    const phone = sanitizeText(business.business_phone_number);
    const website = sanitizeText(business.business_website);
    const phoneIsPublic = business.phoneIsPublic;

    if (__DEV__) {
      const sanitized = { businessName, location, zipCode, phone, website };
      if (Object.values(sanitized).some((v) => v === ".")) {
        console.error("🚨 MiniCard - PERIOD DETECTED in sanitized values:", sanitized);
      }
    }

    let businessImage = null;
    if (business.first_image) {
      if (typeof business.first_image === "string") businessImage = business.first_image;
      else if (business.first_image.url) businessImage = business.first_image.url;
      else if (business.first_image.photo_url) businessImage = business.first_image.photo_url;
    }

    return (
      <View style={[styles.cardContainer, darkMode && styles.darkCardContainer]}>
        {(() => {
          if (__DEV__) console.log("🔵 MiniCard - Rendering business image");
          return (
            <Image
              source={businessImage && businessImage.trim() !== "" ? { uri: businessImage } : require("../assets/profile.png")}
              style={[styles.profileImage, darkMode && styles.darkProfileImage]}
              onError={(error) => {
                console.log("MiniCard business image failed to load:", error.nativeEvent.error);
                console.log("Problematic business image URI:", businessImage);
              }}
              defaultSource={require("../assets/profile.png")}
            />
          );
        })()}

        <View style={styles.textContainer}>
          {/* BUSINESS NAME */}
          {(() => {
            if (__DEV__) console.log("🔵 MiniCard - Rendering business name:", businessName);
            const name = businessName || "Business";
            if (name === "." || name.trim() === "") {
              if (__DEV__) console.log("🔵 MiniCard - Invalid business name, using fallback");
              return <Text style={[styles.name, darkMode && styles.darkName]}>Business</Text>;
            }
            return <Text style={[styles.name, darkMode && styles.darkName]}>{name}</Text>;
          })()}

          {/* LOCATION + ZIP */}
          {(() => {
            if (__DEV__) console.log("🔵 MiniCard - Rendering location:", { location, zipCode });
            const loc = location && location !== "." && location.trim() !== "" ? location : null;
            const zip = zipCode && zipCode !== "." && zipCode.trim() !== "" ? zipCode : null;

            if (!loc && !zip) {
              if (__DEV__) console.log("🔵 MiniCard - No valid location, skipping");
              return null;
            }
            const parts = [loc, zip].filter(Boolean);
            const locationText = parts.join(", ");
            if (__DEV__) console.log("🔵 MiniCard - Location text:", locationText);

            if (!locationText || locationText === "." || locationText.trim() === "") {
              if (__DEV__) console.log("🔵 MiniCard - Invalid location text, skipping");
              return null;
            }

            return <Text style={[styles.location, darkMode && styles.darkText]}>{locationText}</Text>;
          })()}

          {/* BUSINESS PHONE — FIXED  */}
          {(() => {
            if (__DEV__) console.log("🔵 MiniCard - Checking business phone:", { phone, phoneIsPublic, isSafe: isSafeForConditional(phone) });
            if (phoneIsPublic && isSafeForConditional(phone) && phone !== "." && phone.trim() !== "") {
              if (__DEV__) console.log("🔵 MiniCard - Rendering business phone");
              return <Text style={[styles.phone, darkMode && styles.darkText]}>{phone}</Text>;
            }
            return null;
          })()}

          {/* BUSINESS WEBSITE — FIXED */}
          {(() => {
            if (__DEV__) console.log("🔵 MiniCard - Checking business website:", { website, isSafe: isSafeForConditional(website) });
            if (isSafeForConditional(website) && website !== "." && website.trim() !== "") {
              if (__DEV__) console.log("🔵 MiniCard - Rendering business website");
              return <Text style={[styles.website, darkMode && styles.darkText]}>{website}</Text>;
            }
            return null;
          })()}
        </View>
      </View>
    );
  }

  // --------------------------
  // HANDLE USER CARD
  // --------------------------
  if (__DEV__) console.log("🔵 MiniCard - Rendering USER card, user data:", user);
  const firstName = sanitizeText(user?.firstName || user?.personal_info?.profile_personal_first_name);
  const lastName = sanitizeText(user?.lastName || user?.personal_info?.profile_personal_last_name);
  const tagLine = sanitizeText(user?.tagLine || user?.personal_info?.profile_personal_tagline);
  const email = sanitizeText(user?.email || user?.user_email);
  const phone = sanitizeText(user?.phoneNumber || user?.personal_info?.profile_personal_phone_number);
  const profileImage = sanitizeText(user?.profileImage);

  if (__DEV__) {
    console.log("🔵 MiniCard - After sanitization:", { firstName, lastName, tagLine, email, phone, profileImage });
    const hasPeriod = [firstName, lastName, tagLine, email, phone, profileImage].some((v) => v === ".");
    if (hasPeriod) {
      console.error("🚨 MiniCard - PERIOD DETECTED in user data after sanitization!");
    }
  }

  const emailIsPublic = user?.personal_info?.profile_personal_email_is_public == 1 || user?.emailIsPublic;
  const phoneIsPublic = user?.personal_info?.profile_personal_phone_number_is_public == 1 || user?.phoneIsPublic;
  const tagLineIsPublic = user?.personal_info?.profile_personal_tagline_is_public == 1 || user?.tagLineIsPublic;
  const imageIsPublic = user?.personal_info?.profile_personal_image_is_public == 1 || user?.imageIsPublic;

  return (
    <View style={[styles.cardContainer, darkMode && styles.darkCardContainer]}>
      {(() => {
        if (__DEV__) console.log("🔵 MiniCard - Rendering user image:", { profileImage, imageIsPublic, isSafe: isSafeForConditional(profileImage) });
        return (
          <Image
            source={isSafeForConditional(profileImage) && imageIsPublic ? { uri: String(profileImage) } : require("../assets/profile.png")}
            style={[styles.profileImage, darkMode && styles.darkProfileImage]}
            onError={(error) => {
              console.log("MiniCard user image failed to load:", error.nativeEvent.error);
              console.log("Problematic user image URI:", profileImage);
            }}
            defaultSource={require("../assets/profile.png")}
          />
        );
      })()}

      <View style={styles.textContainer}>
        {/* NAME */}
        {(() => {
          if (__DEV__) console.log("🔵 MiniCard - Rendering user name:", { firstName, lastName });
          const nameParts = [firstName, lastName].filter((part) => part && part !== "." && part.trim() !== "" && !part.match(/^[\s.,;:!?\-_=+]*$/));

          const name = nameParts.length ? nameParts.join(" ") : "Unknown";
          if (__DEV__) console.log("🔵 MiniCard - User name result:", name);

          if (!name || name === "." || name.trim() === "") {
            if (__DEV__) console.log("🔵 MiniCard - Invalid user name, using fallback");
            return <Text style={[styles.name, darkMode && styles.darkName]}>Unknown</Text>;
          }

          return <Text style={[styles.name, darkMode && styles.darkName]}>{name}</Text>;
        })()}

        {/* TAGLINE */}
        {(() => {
          if (__DEV__) console.log("🔵 MiniCard - Checking tagline:", { tagLine, tagLineIsPublic, isSafe: isSafeForConditional(tagLine) });
          if (tagLineIsPublic && isSafeForConditional(tagLine) && tagLine !== "." && tagLine.trim() !== "") {
            if (__DEV__) console.log("🔵 MiniCard - Rendering tagline");
            return <Text style={[styles.tagline, darkMode && styles.darkText]}>{tagLine}</Text>;
          }
          return null;
        })()}

        {/* EMAIL */}
        {(() => {
          if (__DEV__) console.log("🔵 MiniCard - Checking email:", { email, emailIsPublic, isSafe: isSafeForConditional(email) });
          if (emailIsPublic && isSafeForConditional(email) && email !== "." && email.trim() !== "") {
            if (__DEV__) console.log("🔵 MiniCard - Rendering email");
            return <Text style={[styles.email, darkMode && styles.darkText]}>{email}</Text>;
          }
          return null;
        })()}

        {/* PHONE */}
        {(() => {
          if (__DEV__) console.log("🔵 MiniCard - Checking phone:", { phone, phoneIsPublic, isSafe: isSafeForConditional(phone) });
          if (phoneIsPublic && isSafeForConditional(phone) && phone !== "." && phone.trim() !== "") {
            if (__DEV__) console.log("🔵 MiniCard - Rendering phone");
            return <Text style={[styles.phone, darkMode && styles.darkText]}>{phone}</Text>;
          }
          return null;
        })()}

        {/* RELATIONSHIP - Only show if showRelationship prop is true */}
        {showRelationship &&
          (() => {
            const relationship = user?.relationship || user?.circle_relationship;
            if (__DEV__) console.log("🔵 MiniCard - Checking relationship:", relationship);
            const relationshipText = relationship && relationship !== null && relationship.trim() !== "" ? relationship.charAt(0).toUpperCase() + relationship.slice(1) : "Relationship not Assigned";
            if (__DEV__) console.log("🔵 MiniCard - Rendering relationship:", relationshipText);
            return <Text style={[styles.relationship, darkMode && styles.darkText]}>{relationshipText}</Text>;
          })()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginVertical: 5,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  phone: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  relationship: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
    fontStyle: "italic",
  },
  location: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  website: {
    fontSize: 14,
    color: "#1a73e8",
    marginBottom: 2,
  },
  darkCardContainer: {
    backgroundColor: "#2d2d2d",
    shadowColor: "#000",
    shadowOpacity: 0.3,
  },
  darkName: {
    color: "#ffffff",
  },
  darkText: {
    color: "#cccccc",
  },
  darkProfileImage: {
    tintColor: "#ffffff",
  },
});

export default MiniCard;
