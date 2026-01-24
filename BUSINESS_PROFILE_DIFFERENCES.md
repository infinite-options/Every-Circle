# Business Profile vs Profile Screen Differences

## Unique Business Features (Should be kept)

### BusinessProfileScreen:
1. **Cart Functionality** - Shopping cart for products/services
   - `cartItems`, `quantityModalVisible`, `selectedService`, `quantity`
   - `handleProductPress`, `handleQuantityConfirm`, `handleRemoveItem`, `handleViewCart`
   - Quantity selection modal

2. **Reviews System** - Business reviews and ratings
   - `userReview`, `allReviews`, `reviewerProfiles`
   - `fetchReviewerProfile`, `renderStars`
   - Review display cards with ratings

3. **Products & Services Section** - Display business services/products
   - Uses `ProductCard` component
   - Only shown when no reviews exist (conditional display)

4. **Business Editors/Owners Section** - Shows business team (owner only)
   - `businessUsers` state
   - Displays MiniCard for each editor/owner with role

5. **Custom Tags** - Business-specific tags (owner only)
   - `customTags` array
   - Tag chips display

6. **Business Images** - Multiple images (not single profile image)
   - `business.images` array
   - Horizontal scrollable image gallery

7. **Business Hours** - Operating hours display

8. **Rating & Pricing** - Google rating and price level
   - `google_rating`, `price_level`

9. **Social Links** - Facebook, Instagram, LinkedIn, YouTube
   - Different from Profile's social links structure

10. **Ownership Checking** - Complex ownership verification
    - `isOwner` state
    - `checkBusinessOwnership` function

11. **Viewport Width Tracking** - Web-specific responsiveness
    - `viewportWidth` state for DevTools handling

### EditBusinessProfileScreen:
1. **Business Editors/Owners Management** - Add/remove business users
   - `additionalBusinessUsers`, `existingBusinessUsers`, `deletedBusinessUsers`
   - `addBusinessEditor`, `removeBusinessEditor`, `deleteExistingBusinessUser`

2. **Products & Services Management** - CRUD for services
   - `services`, `serviceForm`, `showServiceForm`
   - `handleAddService`, `handleEditService`, `handleDeleteService`

3. **Custom Tags Management** - Add/remove custom tags
   - `customTagInput`, `addCustomTag`, `removeCustomTag`

4. **Multiple Business Images** - Upload/remove multiple images
   - `formData.images` array
   - `handleImagePick`, `removeImage`

5. **Business-Specific Fields**:
   - EIN Number (with formatting)
   - Business Role (dropdown)
   - Business Category
   - Business Website
   - Business Hours

6. **Social Links Management** - Structured social links object

## Structural Differences to Address

### BusinessProfileScreen should adopt from ProfileScreen:
1. ✅ Use `useFocusEffect` instead of `useEffect` with navigation listener
2. ✅ Add `FeedbackPopup` component
3. ✅ Cleaner section-based layout (use `fieldContainer` pattern)
4. ✅ Better loading/error state handling
5. ✅ Consistent text rendering with `sanitizeText`
6. ✅ Profile header structure (name, ID display)

### EditBusinessProfileScreen should adopt from EditProfileScreen:
1. ✅ Use `isChanged` tracking for save button state
2. ✅ Better keyboard handling (already has it, but ensure consistency)
3. ✅ Consistent `renderField` helper usage
4. ✅ Better image handling structure
5. ✅ Cleaner form layout
6. ✅ Loading state during save

## Functions That Are Different

### Data Loading:
- **ProfileScreen**: Uses `useFocusEffect` with `fetchUserData`
- **BusinessProfileScreen**: Uses `useEffect` with `navigation.addListener("focus")` and `fetchBusinessInfo`
- **Decision**: BusinessProfileScreen should use `useFocusEffect` for consistency

### Image Handling:
- **ProfileScreen**: Single profile image
- **BusinessProfileScreen**: Multiple business images array
- **Decision**: Keep different (business needs multiple images)

### Section Display:
- **ProfileScreen**: Uses `fieldContainer` with conditional rendering based on `isPublic` flags
- **BusinessProfileScreen**: Uses `card` style with different conditional logic
- **Decision**: BusinessProfileScreen should adopt `fieldContainer` pattern for consistency

### Ownership vs Current User:
- **ProfileScreen**: `isCurrentUserProfile` - simple comparison
- **BusinessProfileScreen**: `isOwner` - complex ownership checking
- **Decision**: Keep different (business ownership is more complex)

### Edit Button:
- **ProfileScreen**: Shows edit button when `isCurrentUserProfile`
- **BusinessProfileScreen**: Shows edit button when `isOwner`
- **Decision**: Keep different (different logic, but same pattern)

### Navigation:
- **ProfileScreen**: Has relationship dropdown for other users
- **BusinessProfileScreen**: Has cart button and review button
- **Decision**: Keep different (different features)
