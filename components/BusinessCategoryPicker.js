import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { Ionicons } from "@expo/vector-icons";
import { CATEGORY_LIST_ENDPOINT } from "../apiConfig";
import { fetchMiddleware as fetch } from "../utils/httpMiddleware";
import {
  categoryIdsFromSelection,
  getSelectedCategoryPathLabel,
  resolveCategorySelection,
  searchBusinessCategories,
} from "../utils/businessCategoryUtils";

const CATEGORY_SEARCH_MIN_LENGTH = 2;

function SearchableCategoryDropdown({ label, data, value, onChange, disabled, placeholder, darkMode, zIndex }) {
  return (
    <>
      {label ? <Text style={[styles.sublabel, darkMode && styles.darkSublabel]}>{label}</Text> : null}
      <Dropdown
        style={[styles.input, darkMode && styles.darkInput, disabled && styles.inputDisabled]}
        data={data}
        labelField='label'
        valueField='value'
        placeholder={placeholder}
        placeholderTextColor={darkMode ? "#cccccc" : "#666"}
        value={value}
        onChange={onChange}
        disable={disabled}
        search
        searchPlaceholder='Type to filter...'
        containerStyle={[{ borderRadius: 10, zIndex }, darkMode && { backgroundColor: "#2d2d2d", borderColor: "#404040" }]}
        itemTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 16 }}
        selectedTextStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 16 }}
        inputSearchStyle={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 16 }}
        activeColor={darkMode ? "#404040" : "#f0f0f0"}
        maxHeight={250}
        renderItem={(item) => (
          <View style={{ paddingVertical: 6, paddingHorizontal: 12 }}>
            <Text style={{ color: darkMode ? "#ffffff" : "#000000", fontSize: 16 }}>{item.label}</Text>
          </View>
        )}
        flatListProps={{
          nestedScrollEnabled: true,
          keyboardShouldPersistTaps: "handled",
          ItemSeparatorComponent: () => <View style={{ height: 2 }} />,
        }}
      />
    </>
  );
}

/**
 * Searchable business category picker with suggest results + optional browse dropdowns.
 */
export default function BusinessCategoryPicker({ categoryIds = [], onCategoryIdsChange, darkMode = false, showBrowseDropdowns = true }) {
  const [allCategories, setAllCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimeoutRef = useRef(null);

  const selectedMain = categoryIds[0] || null;
  const selectedSub = categoryIds[1] || null;
  const selectedSubSub = categoryIds[2] || null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(CATEGORY_LIST_ENDPOINT);
        const json = await res.json();
        if (!cancelled) setAllCategories(Array.isArray(json.result) ? json.result : []);
      } catch (e) {
        console.error("BusinessCategoryPicker - fetch categories:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const mainCategories = useMemo(() => allCategories.filter((cat) => cat.category_parent_id === null), [allCategories]);
  const subCategories = useMemo(() => allCategories.filter((c) => c.category_parent_id === selectedMain), [allCategories, selectedMain]);
  const subSubCategories = useMemo(() => allCategories.filter((c) => c.category_parent_id === selectedSub), [allCategories, selectedSub]);

  const suggestions = useMemo(() => searchBusinessCategories(searchQuery, allCategories), [searchQuery, allCategories]);
  const selectedPathLabel = useMemo(() => getSelectedCategoryPathLabel(categoryIds, allCategories), [categoryIds, allCategories]);

  const applySelection = (main, sub, subSub) => {
    onCategoryIdsChange?.(categoryIdsFromSelection(main, sub, subSub));
  };

  const handleSuggestionSelect = (match) => {
    applySelection(match.main, match.sub, match.subSub);
    setSearchQuery("");
    setShowSuggestions(false);
  };

  const handleSearchFocus = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    if (searchQuery.trim().length >= CATEGORY_SEARCH_MIN_LENGTH) setShowSuggestions(true);
  };

  const handleSearchBlur = () => {
    blurTimeoutRef.current = setTimeout(() => setShowSuggestions(false), 150);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, darkMode && styles.darkLabel]}>Category *</Text>
      <Text style={[styles.helperText, darkMode && styles.darkHelperText]}>Search by name (e.g. plumbing, hair salon) or browse below.</Text>

      <View style={styles.searchWrap}>
        <TextInput
          style={[styles.input, styles.searchInput, darkMode && styles.darkInput]}
          placeholder='Search categories...'
          placeholderTextColor={darkMode ? "#cccccc" : "#666"}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            setShowSuggestions(text.trim().length >= CATEGORY_SEARCH_MIN_LENGTH);
          }}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
          autoCorrect={false}
          autoCapitalize='none'
        />
        <Ionicons name='search-outline' size={18} color={darkMode ? "#aaa" : "#666"} style={styles.searchIcon} />

        {showSuggestions && searchQuery.trim().length >= CATEGORY_SEARCH_MIN_LENGTH ? (
          <View style={[styles.suggestionsList, darkMode && styles.darkSuggestionsList]}>
            {loading ? (
              <Text style={[styles.suggestionEmpty, darkMode && styles.darkSuggestionEmpty]}>Loading categories...</Text>
            ) : suggestions.length > 0 ? (
              suggestions.map((item, idx) => (
                <TouchableOpacity
                  key={`${item.category_uid}-${idx}`}
                  style={[styles.suggestionRow, darkMode && styles.darkSuggestionRow, idx === suggestions.length - 1 && styles.suggestionRowLast]}
                  onPress={() => handleSuggestionSelect(item)}
                  {...(Platform.OS === "web"
                    ? {
                        onMouseDown: (e) => {
                          e.preventDefault();
                        },
                      }
                    : {})}
                >
                  <Text style={[styles.suggestionTitle, darkMode && styles.darkSuggestionTitle]}>{item.category_name}</Text>
                  <Text style={[styles.suggestionPath, darkMode && styles.darkSuggestionPath]} numberOfLines={2}>
                    {item.pathLabel}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={[styles.suggestionEmpty, darkMode && styles.darkSuggestionEmpty]}>No matching categories. Try another keyword.</Text>
            )}
          </View>
        ) : null}
      </View>

      {selectedPathLabel ? (
        <View style={[styles.selectedPathBox, darkMode && styles.darkSelectedPathBox]}>
          <Text style={[styles.selectedPathLabel, darkMode && styles.darkSelectedPathLabel]}>Selected</Text>
          <Text style={[styles.selectedPathText, darkMode && styles.darkSelectedPathText]}>{selectedPathLabel}</Text>
        </View>
      ) : null}

      {showBrowseDropdowns ? (
        <>
          <Text style={[styles.browseLabel, darkMode && styles.darkBrowseLabel]}>Or browse categories</Text>
          <SearchableCategoryDropdown
            label='Main Category *'
            data={mainCategories.map((c) => ({ label: c.category_name, value: c.category_uid }))}
            value={selectedMain}
            onChange={(item) => applySelection(item.value, null, null)}
            disabled={loading || mainCategories.length === 0}
            placeholder='Select Main Category'
            darkMode={darkMode}
            zIndex={3000}
          />
          <SearchableCategoryDropdown
            label='Sub Category (Optional)'
            data={subCategories.map((c) => ({ label: c.category_name, value: c.category_uid }))}
            value={selectedSub}
            onChange={(item) => applySelection(selectedMain, item.value, null)}
            disabled={subCategories.length === 0}
            placeholder={subCategories.length > 0 ? "Select Sub Category" : "Select Main Category first"}
            darkMode={darkMode}
            zIndex={2000}
          />
          <SearchableCategoryDropdown
            label='Sub-Sub Category (Optional)'
            data={subSubCategories.map((c) => ({ label: c.category_name, value: c.category_uid }))}
            value={selectedSubSub}
            onChange={(item) => applySelection(selectedMain, selectedSub, item.value)}
            disabled={subSubCategories.length === 0}
            placeholder={subSubCategories.length > 0 ? "Select Sub-Sub Category" : "Select Sub Category first"}
            darkMode={darkMode}
            zIndex={1000}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    marginBottom: 4,
  },
  label: {
    alignSelf: "flex-start",
    color: "#333",
    fontWeight: "bold",
    marginBottom: 4,
    marginTop: 10,
  },
  darkLabel: {
    color: "#ffffff",
  },
  helperText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  darkHelperText: {
    color: "#cccccc",
  },
  searchWrap: {
    position: "relative",
    zIndex: 4000,
    marginBottom: 12,
  },
  searchInput: {
    paddingRight: 36,
    marginBottom: 0,
  },
  searchIcon: {
    position: "absolute",
    right: 12,
    top: 13,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    width: "100%",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 16,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  darkInput: {
    backgroundColor: "#404040",
    color: "#ffffff",
    borderColor: "#404040",
  },
  suggestionsList: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    maxHeight: 240,
    overflow: "hidden",
    zIndex: 4001,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  darkSuggestionsList: {
    backgroundColor: "#2d2d2d",
    borderColor: "#404040",
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  suggestionRowLast: {
    borderBottomWidth: 0,
  },
  darkSuggestionRow: {
    borderBottomColor: "#404040",
  },
  suggestionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222",
    marginBottom: 2,
  },
  darkSuggestionTitle: {
    color: "#fff",
  },
  suggestionPath: {
    fontSize: 12,
    color: "#666",
  },
  darkSuggestionPath: {
    color: "#aaa",
  },
  suggestionEmpty: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
    padding: 12,
  },
  darkSuggestionEmpty: {
    color: "#aaa",
  },
  selectedPathBox: {
    backgroundColor: "#f3f8f6",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cfe8df",
    padding: 12,
    marginBottom: 12,
  },
  darkSelectedPathBox: {
    backgroundColor: "#2a3532",
    borderColor: "#3d5248",
  },
  selectedPathLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4F8A8B",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  darkSelectedPathLabel: {
    color: "#8fd4c8",
  },
  selectedPathText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  darkSelectedPathText: {
    color: "#eee",
  },
  browseLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 4,
    alignSelf: "flex-start",
  },
  darkBrowseLabel: {
    color: "#ccc",
  },
  sublabel: {
    alignSelf: "flex-start",
    color: "#555",
    fontWeight: "600",
    marginBottom: 4,
    marginTop: 4,
    fontSize: 13,
  },
  darkSublabel: {
    color: "#ddd",
  },
});
