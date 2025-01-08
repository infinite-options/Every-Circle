import React, { useState } from "react";
import { Card, CardContent } from "@mui/material";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import InputLabel from "@mui/material/InputLabel";
import {
  ModernTemplate,
  MinimalistTemplate,
  SplitTemplate,
  CreativeTemplate,
} from "./profileTemplate";

const ProfileEditor = () => {
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    bio: "",
    location: "",
    avatarUrl: "",
  });

  const [imageFile, setImageFile] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file type
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        alert("Please upload only JPEG, PNG, or WebP images.");
        return;
      }

      // Create URL for preview
      const imageUrl = URL.createObjectURL(file);
      setImageFile(file);
      setFormData((prev) => ({
        ...prev,
        avatarUrl: imageUrl,
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Input Form */}
        <Card className="mb-8">
          <CardContent>
            <Typography variant="h5" component="h2" gutterBottom>
              Profile Information
            </Typography>
            <div className="grid gap-6 max-w-xl">
              <div>
                <TextField
                  fullWidth
                  id="name"
                  name="name"
                  label="Name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter your name"
                  variant="outlined"
                />
              </div>

              <div>
                <TextField
                  fullWidth
                  id="username"
                  name="username"
                  label="Username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter your username"
                  variant="outlined"
                />
              </div>

              <div>
                <TextField
                  fullWidth
                  id="bio"
                  name="bio"
                  label="Bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  placeholder="Write a short bio"
                  multiline
                  rows={4}
                  variant="outlined"
                />
              </div>

              <div>
                <TextField
                  fullWidth
                  id="location"
                  name="location"
                  label="Location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="Enter your city/neighborhood"
                  variant="outlined"
                />
              </div>

              <div>
                <InputLabel htmlFor="avatar">Profile Picture</InputLabel>
                <TextField
                  fullWidth
                  id="avatar"
                  type="file"
                  inputProps={{
                    accept: ".jpg,.jpeg,.png,.webp",
                  }}
                  onChange={handleImageUpload}
                  variant="outlined"
                />
                <Typography variant="caption" color="textSecondary">
                  Accepted formats: JPEG, PNG, WebP
                </Typography>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Template Previews */}
        <div className="space-y-8">
          <div>
            <Typography variant="h6" gutterBottom>
              Modern Template
            </Typography>
            <ModernTemplate {...formData} />
          </div>

          <div>
            <Typography variant="h6" gutterBottom>
              Minimalist Template
            </Typography>
            <MinimalistTemplate {...formData} />
          </div>

          <div>
            <Typography variant="h6" gutterBottom>
              Split Template
            </Typography>
            <SplitTemplate {...formData} />
          </div>

          <div>
            <Typography variant="h6" gutterBottom>
              Creative Template
            </Typography>
            <CreativeTemplate {...formData} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditor;
