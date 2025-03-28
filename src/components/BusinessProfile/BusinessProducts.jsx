/// public privat 

import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, styled, IconButton, 
  TextField, Paper, InputBase
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import moneyBag from "../../assets/moneybag.png";
import eyeIcon from "../../assets/eye.png";
import closedEyeIcon from "../../assets/closedEye.png";

const SectionTitle = styled(Typography)({
  fontWeight: 500,
  color: '#666',
  fontSize: '28px'
});

const ProductCard = styled(Paper)({
  position: 'relative',
  marginBottom: '16px',
  padding: '12px',
  borderRadius: '24px',
  border: '1px solid #ddd',
  boxShadow: 'none',
  overflow: 'hidden'
});

const ImageBox = styled(Box)({
  width: '110px',
  height: '110px',
  border: '1px solid #ccc',
  borderRadius: '16px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#fff',
});

const StyledInput = styled(InputBase)({
  padding: '12px 16px',
  fontSize: '18px',
  backgroundColor: '#f5f5f5',
  borderRadius: '16px',
  width: '100%',
  '&::placeholder': {
    color: '#999',
  }
});

const PriceBox = styled(Box)({
  padding: '6px 16px',
  backgroundColor: '#f5f5f5',
  borderRadius: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '18px',
  fontWeight: '500',
});

function BusinessProducts({ 
  editMode, 
  businessId, 
  products = [], 
  onProductsChange, 
  onDeleteProduct, 
  publicFieldValue, 
  onPublicToggle, 
  PublicLabelComponent 
}) {
  // Initialize with default empty products if none are provided
  useEffect(() => {
    if (products.length === 0 && editMode) {
      onProductsChange([
        { bs_service_name: "", bs_cost: "", bs_bounty: "", bs_service_desc: "", bs_is_visible: 1 }
      ]);
    }
  }, [editMode, products.length, onProductsChange]);

  const handleAddProduct = () => {
    const newProduct = {
      bs_service_name: "",
      bs_cost: "",
      bs_bounty: "",
      bs_service_desc: "",
      bs_is_visible: 1
    };
    onProductsChange([...products, newProduct]);
  };

  const handleDeleteProduct = (index) => {
    const updatedProducts = [...products];
    const removedItem = updatedProducts[index];
    
    // Debugging info
    console.log("Deleting product:", removedItem);
    
    // If the product has a bs_uid (exists in backend), call the parent's onDeleteProduct
    if (removedItem.bs_uid) {
        console.log("Product has UID, calling onDeleteProduct with:", removedItem.bs_uid);
        onDeleteProduct(removedItem.bs_uid);
    } else {
        console.log("Product does not have UID, only removing from UI");
    }
    
    // Remove from UI state
    updatedProducts.splice(index, 1);
    onProductsChange(updatedProducts);
  };

  const handleProductChange = (index, field, value) => {
    const updatedProducts = [...products];
    updatedProducts[index] = {
      ...updatedProducts[index],
      [field]: value
    };
    
    onProductsChange(updatedProducts);
  };

  // Display products or a message if no products and not in edit mode
  const displayProducts = products.length > 0 || editMode;

  return (
    <Box sx={{ mt: 4, mb: 4, position: 'relative' }}>
      {/* Header with Products title and Add button */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        {/* Title with plus sign next to it */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SectionTitle>
            Products
          </SectionTitle>
          
          {/* Add button positioned next to the title */}
          {editMode && (
            <IconButton 
              onClick={handleAddProduct}
              sx={{ 
                color: '#2196f3',
                fontSize: '32px',
                ml: 1, // Add margin to separate from title
              }}
            >
              <AddIcon fontSize="inherit" />
            </IconButton>
          )}
        </Box>
      </Box>
      
      {/* Public/Private toggle positioned at the top-right of the Products section */}
      <Box sx={{ 
        position: 'absolute', 
        top: 0, 
        right: 0, 
        display: 'flex', 
        alignItems: 'center' 
      }}>
        {PublicLabelComponent ? (
          <PublicLabelComponent 
            onClick={onPublicToggle}
          >
            {publicFieldValue === 1 ? 'Public' : <span style={{ color: 'orange' }}>Private</span>}
          </PublicLabelComponent>
        ) : (
          <Typography
            onClick={editMode ? onPublicToggle : undefined}
            sx={{
              color: '#666',
              fontSize: '20px',
              cursor: editMode ? 'pointer' : 'default',
            }}
          >
            {publicFieldValue === 1 ? 'Public' : <span style={{ color: 'orange' }}>Private</span>}
          </Typography>
        )}
      </Box>

      {!displayProducts ? (
        <Typography color="text.secondary" align="center" sx={{ my: 2 }}>
          No products or services listed
        </Typography>
      ) : (
        products.map((product, index) => (
          <Box key={index}>
            {/* Bounty Section above the card with Delete and Eye icons */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, ml: 2, justifyContent: 'space-between' }}>
              {/* Left side - Money bag and bounty */}
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  component="img"
                  src={moneyBag}
                  alt="Bounty"
                  sx={{ width: 30, height: 30, mr: 2 }}
                />
                {editMode ? (
                  <Box
                    component="input"
                    placeholder="Free"
                    value={product.bs_bounty || ""}
                    onChange={(e) => handleProductChange(index, "bs_bounty", e.target.value)}
                    sx={{
                      border: 'none',
                      outline: 'none',
                      backgroundColor: '#f5f5f5',
                      padding: '8px 16px',
                      borderRadius: '16px',
                      fontSize: '18px',
                      width: '120px'
                    }}
                  />
                ) : (
                  <Typography
                    sx={{
                      backgroundColor: '#f5f5f5',
                      padding: '8px 16px',
                      borderRadius: '16px',
                      fontSize: '18px',
                      color: '#666'
                    }}
                  >
                    {product.bs_bounty ? `${product.bs_bounty}` : 'Free'}
                  </Typography>
                )}
              </Box>
              
              {/* Right side - Delete and Eye icons */}
              {editMode && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton onClick={() => handleDeleteProduct(index)}>
                    <DeleteIcon />
                  </IconButton>
                  
                  <IconButton 
                    onClick={() => {
                      const currentValue = parseInt(product.bs_is_visible || 0, 10);
                      const newValue = currentValue === 1 ? 0 : 1;
                      handleProductChange(index, "bs_is_visible", newValue);
                    }}
                  >
                    <img 
                      src={parseInt(product.bs_is_visible || 0, 10) === 1 ? eyeIcon : closedEyeIcon} 
                      alt={parseInt(product.bs_is_visible || 0, 10) === 1 ? "Visible" : "Hidden"} 
                      style={{ width: '24px', height: '24px' }}
                    />
                  </IconButton>
                </Box>
              )}
            </Box>
            
            {/* Main Product Card */}
            <ProductCard>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {/* Image upload area */}
                <ImageBox>
                  <Typography align="center" sx={{ color: '#888', fontSize: '16px' }}>
                    Upload
                  </Typography>
                  <Typography align="center" sx={{ color: '#888', fontSize: '16px' }}>
                    Image
                  </Typography>
                  <Typography align="center" sx={{ color: '#888', fontSize: '12px' }}>
                    (png, jpeg)
                  </Typography>
                  <Typography align="center" sx={{ color: '#888', fontSize: '12px' }}>
                    &lt; 2.5MB
                  </Typography>
                </ImageBox>
                
                {/* Content Area */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Top row with service name and price */}
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {/* Service name */}
                    {editMode ? (
                      <StyledInput
                        placeholder="Service"
                        value={product.bs_service_name || ""}
                        onChange={(e) => handleProductChange(index, "bs_service_name", e.target.value)}
                        sx={{ flex: 1 }}
                      />
                    ) : (
                      <Box sx={{ 
                        flex: 1, 
                        backgroundColor: '#f5f5f5', 
                        borderRadius: '16px',
                        padding: '12px 16px'
                      }}>
                        <Typography>{product.bs_service_name || "Service Name"}</Typography>
                      </Box>
                    )}
                    
                    {/* Price */}
                    {editMode ? (
                      <Box
                        component="input"
                        type="text"
                        placeholder="$0"
                        value={product.bs_cost ? `$${product.bs_cost}` : ""}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          handleProductChange(index, "bs_cost", value);
                        }}
                        sx={{
                          border: 'none',
                          outline: 'none',
                          backgroundColor: '#f5f5f5',
                          padding: '8px 16px',
                          borderRadius: '16px',
                          fontSize: '18px',
                          width: '80px',
                          textAlign: 'center'
                        }}
                      />
                    ) : (
                      <PriceBox>
                        ${product.bs_cost || "0"}
                      </PriceBox>
                    )}
                  </Box>
                  
                  {/* Description */}
                  {editMode ? (
                    <StyledInput
                      placeholder="Two lines of description"
                      multiline
                      rows={2}
                      value={product.bs_service_desc || ""}
                      onChange={(e) => handleProductChange(index, "bs_service_desc", e.target.value)}
                    />
                  ) : (
                    <Box sx={{ 
                      backgroundColor: '#f5f5f5', 
                      borderRadius: '16px',
                      padding: '12px 16px'
                    }}>
                      <Typography>{product.bs_service_desc || "Description"}</Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </ProductCard>
          </Box>
        ))
      )}
    </Box>
  );
}

export default BusinessProducts;