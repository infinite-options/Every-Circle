import React, { useState, useEffect, useRef } from "react";
import { Box, Typography, TextField, Chip, ClickAwayListener } from "@mui/material";
import axios from "axios";

const CustomSelect = ({ label, options, selectedValues, onSelect, onRemove }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleClickAway = () => {
    setIsOpen(false);
  };

  const handleSelect = (value) => {
    onSelect(value);
    // Don't close the dropdown to allow multiple selections
  };

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box sx={{ position: "relative", width: "100%" }}>
        <Box
          onClick={toggleDropdown}
          sx={{
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "8px 12px",
            minHeight: "40px",
            cursor: "pointer",
            display: "flex",
            flexWrap: "wrap",
            gap: 0.5,
          }}
          ref={selectRef}
        >
          {selectedValues.length === 0 ? (
            <Typography sx={{ color: "#757575" }}>Select {label}</Typography>
          ) : (
            selectedValues.map((value) => {
              const option = options.find((opt) => opt.value === value);
              return (
                <Chip
                  key={value}
                  label={option?.label || value}
                  onDelete={(e) => {
                    e.stopPropagation();
                    onRemove(value);
                  }}
                  sx={{ margin: "2px" }}
                />
              );
            })
          )}
        </Box>
        {isOpen && (
          <Box
            sx={{
              position: "absolute",
              width: "100%",
              maxHeight: "250px",
              overflowY: "auto",
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "4px",
              mt: 0.5,
              zIndex: 1000,
              boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
            }}
          >
            {options.map((option) => (
              <Box
                key={option.value}
                onClick={() => handleSelect(option.value)}
                sx={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  backgroundColor: selectedValues.includes(option.value) ? "#f0f7ff" : "white",
                  "&:hover": {
                    backgroundColor: "#f5f5f5",
                  },
                }}
              >
                {option.label}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </ClickAwayListener>
  );
};

const CategorySelector = () => {
  const [allCategories, setAllCategories] = useState([]);
  const [mainCategories, setMainCategories] = useState([]);
  const [selectedMainCategories, setSelectedMainCategories] = useState([]);
  const [filteredSubCategories, setFilteredSubCategories] = useState([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState([]);
  const [filteredSubSubCategories, setFilteredSubSubCategories] = useState([]);
  const [selectedSubSubCategories, setSelectedSubSubCategories] = useState([]);
  const [customTags, setCustomTags] = useState([]);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get("https://ioEC2testsspm.infiniteoptions.com/category_list/all");
        setAllCategories(response.data.result);

        const mainCats = response.data.result
          .filter((cat) => cat.category_parent_id === null)
          .map((cat) => ({ value: cat.category_uid, label: cat.category_name }));

        setMainCategories(mainCats);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    const subCategories = allCategories
      .filter((cat) => selectedMainCategories.includes(cat.category_parent_id))
      .map((cat) => ({ value: cat.category_uid, label: cat.category_name }));
    
    setFilteredSubCategories(subCategories);

    // Filter out subcategories that no longer belong to selected main categories
    setSelectedSubCategories((prev) =>
      prev.filter((catId) => 
        subCategories.some((subCat) => subCat.value === catId)
      )
    );
  }, [selectedMainCategories, allCategories]);

  useEffect(() => {
    const subSubCategories = allCategories
      .filter((cat) => selectedSubCategories.includes(cat.category_parent_id))
      .map((cat) => ({ value: cat.category_uid, label: cat.category_name }));
    
    setFilteredSubSubCategories(subSubCategories);

    // Filter out sub-subcategories that no longer belong to selected subcategories
    setSelectedSubSubCategories((prev) =>
      prev.filter((catId) => 
        subSubCategories.some((subSubCat) => subSubCat.value === catId)
      )
    );
  }, [selectedSubCategories, allCategories]);

  const handleSelectMainCategory = (categoryId) => {
    if (!selectedMainCategories.includes(categoryId)) {
      setSelectedMainCategories([...selectedMainCategories, categoryId]);
    }
  };

  const handleRemoveMainCategory = (categoryId) => {
    setSelectedMainCategories(selectedMainCategories.filter((id) => id !== categoryId));
  };

  const handleSelectSubCategory = (categoryId) => {
    if (!selectedSubCategories.includes(categoryId)) {
      setSelectedSubCategories([...selectedSubCategories, categoryId]);
    }
  };

  const handleRemoveSubCategory = (categoryId) => {
    setSelectedSubCategories(selectedSubCategories.filter((id) => id !== categoryId));
  };

  const handleSelectSubSubCategory = (categoryId) => {
    if (!selectedSubSubCategories.includes(categoryId)) {
      setSelectedSubSubCategories([...selectedSubSubCategories, categoryId]);
    }
  };

  const handleRemoveSubSubCategory = (categoryId) => {
    setSelectedSubSubCategories(selectedSubSubCategories.filter((id) => id !== categoryId));
  };

  const addCustomTag = () => {
    if (newTag.trim() !== "" && !customTags.includes(newTag.trim())) {
      setCustomTags([...customTags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeCustomTag = (tag) => {
    setCustomTags(customTags.filter((t) => t !== tag));
  };

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Main Categories */}
      <Typography sx={{ color: "#fff", marginTop: "20px", fontSize: "13px" }}>
        Main Categories
      </Typography>
      <CustomSelect
        label="Main Categories"
        options={mainCategories}
        selectedValues={selectedMainCategories}
        onSelect={handleSelectMainCategory}
        onRemove={handleRemoveMainCategory}
      />

      {/* Sub Categories */}
      {filteredSubCategories.length > 0 && (
        <>
          <Typography sx={{ color: "#fff", marginTop: "20px", fontSize: "13px" }}>
            Sub Categories
          </Typography>
          <CustomSelect
            label="Sub Categories"
            options={filteredSubCategories}
            selectedValues={selectedSubCategories}
            onSelect={handleSelectSubCategory}
            onRemove={handleRemoveSubCategory}
          />
        </>
      )}

      {/* Sub-Sub Categories */}
      {filteredSubSubCategories.length > 0 && (
        <>
          <Typography sx={{ color: "#fff", marginTop: "20px", fontSize: "13px" }}>
            Sub-Sub Categories
          </Typography>
          <CustomSelect
            label="Sub-Sub Categories"
            options={filteredSubSubCategories}
            selectedValues={selectedSubSubCategories}
            onSelect={handleSelectSubSubCategory}
            onRemove={handleRemoveSubSubCategory}
          />
        </>
      )}

      {/* Custom Tags */}
      <Typography sx={{ color: "#fff", marginTop: "20px", fontSize: "13px" }}>
        Custom Tags
      </Typography>
      <TextField
        sx={{ backgroundColor: "white" }}
        value={newTag}
        onChange={(e) => setNewTag(e.target.value)}
        placeholder="Add custom tag (Press 'enter')"
        fullWidth
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            addCustomTag();
            e.preventDefault();
          }
        }}
      />
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {customTags.map((tag, index) => (
          <Chip
            key={index}
            label={tag}
            sx={{ backgroundColor: "#ebebeb" }}
            onDelete={() => removeCustomTag(tag)}
          />
        ))}
      </Box>
    </Box>
  );
};

export default CategorySelector;